import { stateManager } from "@/projects/stateManager";
import type { TruthTableData } from "@/projects/truth-table/TruthTableProject";
import { minifyTruthTable } from "@/utility/truthtable/espresso";
import { FunctionType, type Formula, type Literal, type Term } from "@/utility/types";
import { Minimizer, type QMCResult } from "./minimizer";
import type { Operation } from "logi.js";

// ========== New Interpreter =========

/**
 * Convert Operation to custom LaTeX string (lowercase variables, no operators)
 */
function operationToLatex(op: Operation, isCNF: boolean = false): string {
  if ((op as any).name !== undefined) {
    // It's a VAR
    return (op as any).name.toLowerCase()
  }

  if ((op as any).priority === 15) {
    // It's a NOT
    const inner = (op as any).args[0]
    return `\\bar{${operationToLatex(inner, isCNF)}}`
  }

  if ((op as any).priority === 8) {
    // It's an AND
    const args = (op as any).args as Operation[]
    if (isCNF) {
      // For CNF: AND joins product terms (parentheses groups)
      return args.map(arg => operationToLatex(arg, isCNF)).join('')
    } else {
      // For DNF: AND concatenates literals
      return args.map(arg => operationToLatex(arg, isCNF)).join('')
    }
  }

  if ((op as any).priority === 6) {
    // It's an OR
    const args = (op as any).args as Operation[]
    if (isCNF) {
      // For CNF: OR creates sum terms (wrapped in parentheses)
      const sum = args.map(arg => operationToLatex(arg, isCNF)).join(' + ')
      // Wrap in parentheses if more than one literal
      return args.length > 1 ? `(${sum})` : sum
    } else {
      // For DNF: OR separates product terms with +
      return args.map(arg => operationToLatex(arg, isCNF)).join(' + ')
    }
  }

  return ''
}

/**
 * Parse an expression into individual terms
 */
function getTerms(expr: Operation, isCNF: boolean): string[] {
  const latex = operationToLatex(expr, isCNF)
  if (isCNF) {
    // For CNF: split by product terms (parentheses groups)
    // Match parentheses groups or single variables
    const matches = latex.match(/\([^)]+\)|[^()\s]+/g) || []
    return matches.map(t => t.trim())
  } else {
    // For DNF: split by + for sum terms
    return latex.split(' + ').map(t => t.trim())
  }
}

/**
 * Analyze expressions to find common terms and variable positions
 */
function analyzeExpressions(exprs: Operation[], isCNF: boolean): { constantTerms: string[], variablePositions: string[][] } {
  if (exprs.length === 0) return { constantTerms: [], variablePositions: [] }
  if (exprs.length === 1) return { constantTerms: getTerms(exprs[0]!, isCNF), variablePositions: [] }

  const allTerms = exprs.map(expr => getTerms(expr, isCNF))
  const maxLength = Math.max(...allTerms.map(t => t.length))

  // Pad shorter expressions with empty strings
  const paddedTerms = allTerms.map(terms => {
    const padded = [...terms]
    while (padded.length < maxLength) padded.push('')
    return padded
  })

  // For each position, check if all expressions have the same term
  const constantTerms: string[] = []
  const variablePositions: string[][] = []

  for (let pos = 0; pos < maxLength; pos++) {
    const termsAtPos = paddedTerms.map(terms => terms[pos]!).filter(t => t !== '')
    const uniqueTerms = Array.from(new Set(termsAtPos))

    if (uniqueTerms.length === 1) {
      // All expressions have the same term at this position
      constantTerms.push(uniqueTerms[0]!)
    } else if (uniqueTerms.length > 1) {
      // This position varies across expressions - collect all variations
      variablePositions.push(termsAtPos)
    }
  }

  return { constantTerms, variablePositions }
}

/**
 * Helper to parse a single literal (VAR or NOT(VAR))
 */
function parseLiteral(expression: Operation): Literal | null {
  // Handle NOT
  if ((expression as any).priority === 15) {
    const inner = (expression as any).args?.[0]
    if (inner && (inner as any).name !== undefined) {
      return {
        variable: (inner as any).name.toLowerCase(),
        negated: true
      }
    }
  }

  // Handle VAR
  if ((expression as any).name !== undefined) {
    return {
      variable: (expression as any).name.toLowerCase(),
      negated: false
    }
  }

  return null
}

/**
 * Convert QMC expression to Formula, choosing first option when there are multiple
 */
function flattenCouplingTermsToFormula(
  expression: Operation,
  functionType: FunctionType
): Formula {
  const terms: Term[] = []
  // For CNF: top level is AND (priority 8), each arg is an OR clause (priority 6)
  // For DNF: top level is OR (priority 6), each arg is an AND term (priority 8)

  if (functionType === 'CNF') {
    // CNF: AND of OR clauses
    if ((expression as any).priority === 8) {
      // Top level AND - each arg is a clause (OR of literals)
      const args = (expression as any).args as Operation[]

      for (const clauseOp of args) {
        const literals: Literal[] = []

        if ((clauseOp as any).priority === 6) {
          // OR clause - collect all literals
          const orArgs = (clauseOp as any).args as Operation[]
          for (const lit of orArgs) {
            const literal = parseLiteral(lit)
            if (literal) literals.push(literal)
          }
        } else {
          // Single literal clause
          const literal = parseLiteral(clauseOp)
          if (literal) literals.push(literal)
        }

        if (literals.length > 0) {
          terms.push({ literals })
        }
      }
    } else if ((expression as any).priority === 6) {
      // Single clause (OR of literals)
      const literals: Literal[] = []
      const args = (expression as any).args as Operation[]
      for (const lit of args) {
        const literal = parseLiteral(lit)
        if (literal) literals.push(literal)
      }
      if (literals.length > 0) {
        terms.push({ literals })
      }
    } else {
      // Single literal
      const literal = parseLiteral(expression)
      if (literal) {
        terms.push({ literals: [literal] })
      }
    }
  } else {
    // DNF: OR of AND terms
    if ((expression as any).priority === 6) {
      // Top level OR - each arg is a term (AND of literals)
      const args = (expression as any).args as Operation[]

      for (const termOp of args) {
        const literals: Literal[] = []

        if ((termOp as any).priority === 8) {
          // AND term - collect all literals
          const andArgs = (termOp as any).args as Operation[]
          for (const lit of andArgs) {
            const literal = parseLiteral(lit)
            if (literal) literals.push(literal)
          }
        } else {
          // Single literal term
          const literal = parseLiteral(termOp)
          if (literal) literals.push(literal)
        }

        if (literals.length > 0) {
          terms.push({ literals })
        }
      }
    } else if ((expression as any).priority === 8) {
      // Single term (AND of literals)
      const literals: Literal[] = []
      const args = (expression as any).args as Operation[]
      for (const lit of args) {
        const literal = parseLiteral(lit)
        if (literal) literals.push(literal)
      }
      if (literals.length > 0) {
        terms.push({ literals })
      }
    } else {
      // Single literal
      const literal = parseLiteral(expression)
      if (literal) {
        terms.push({ literals: [literal] })
      }
    }
  }

  console.log('[qmcExpressionToFormula] Input:', expression, 'Output terms:', terms)
  return {
    type: functionType,
    terms: terms
  }
}

/**
 * Extract variable letters from a LaTeX term for sorting (remove \bar{} notation)
 */
function getTermSortKey(term: string): string {
  // Remove \bar{x} and replace with just x
  // This regex matches \bar{letter} and captures just the letter
  return term.replace(/\\bar\{([a-z])\}/g, '$1')
}

function getCouplingTermLatex(
  qmcResult: QMCResult,
  functionType: FunctionType,
  inputVars: string[]
): string {
  if (qmcResult.expressions.length === 0) return ''

  const isCNF = functionType === 'CNF'
  const { constantTerms, variablePositions } = analyzeExpressions(qmcResult.expressions, isCNF)

  const formType = functionType === 'DNF' ? 'DMF' : 'CMF'
  const signature = `f_{${formType}}(${inputVars.join(', ')}) = `

  // If no variable positions, all expressions are identical
  if (variablePositions.length === 0) {
    // Sort constant terms alphabetically by their sort key and join
    const termJoiner = isCNF ? '' : ' + '
    return signature + constantTerms.sort((a, b) =>
      getTermSortKey(a).localeCompare(getTermSortKey(b))
    ).join(termJoiner)
  }

  // Build list of parts with their sort keys
  const partsWithKeys: Array<{ sortKey: string, latex: string }> = []

  // Add constant terms
  for (const term of constantTerms) {
    partsWithKeys.push({ sortKey: getTermSortKey(term), latex: term })
  }

  // Add matrices for each variable position
  for (const variations of variablePositions) {
    // Get unique variations only
    const uniqueVars = Array.from(new Set(variations))
    const matrixRows = uniqueVars.join(' \\\\ ')
    const latex = `\\left\\{ \\begin{matrix} ${matrixRows} \\end{matrix} \\right\\}`
    // Use first variation as sort key (with bars removed)
    partsWithKeys.push({ sortKey: getTermSortKey(uniqueVars[0] || ''), latex })
  }

  // Sort parts alphabetically by their sort key
  partsWithKeys.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const termJoiner = isCNF ? '' : ' + '
  return signature + partsWithKeys.map(p => p.latex).join(termJoiner)
}




// ========== Old Interpreter =========


/**
 * Interprets a minified truth table into a logical function (list of terms).
 * @param data Rows of the minified truth table
 * @param inputVars List of input variable names
 */
export function interpretMinifiedTable(
  data: TruthTableData,
  formulaType: FunctionType,
  inputVars: string[]
): Formula {
  let terms: Term[] = [];
  const numInputs = inputVars.length;

  // We assume the first column after inputs is the output we care about.
  const outputColIndex = numInputs;

  for (const row of data) {
    if (row.length <= outputColIndex) continue;

    const outputVal = row[outputColIndex];

    // Espresso output for a cover usually has '1' in the output column for the covered terms.
    // We process all rows that are part of the cover.
    if (outputVal !== 1) continue;

    const literals: Literal[] = [];
    for (let i = 0; i < numInputs; i++) {
      const val = row[i];
      const variable = inputVars[i];
      if (!variable) continue;

      if (formulaType === 'DNF') {
        // DNF (Sum of Products): 1 -> var, 0 -> !var
        if (val === 1) {
          literals.push({ variable, negated: false });
        } else if (val === 0) {
          literals.push({ variable, negated: true });
        }
      } else {
        // CNF (Product of Sums):
        // Input data is minified !F (OFF-set).
        // Row represents term T in !F.
        // We want clause C = !T.
        // 1 in T -> var in T -> !var in C
        // 0 in T -> !var in T -> var in C
        if (val === 1) {
          literals.push({ variable, negated: true });
        } else if (val === 0) {
          literals.push({ variable, negated: false });
        }
      }
    }
    terms.push({ literals });
  }

  // Sort terms to ensure consistent order (e.g. !a before b)
  terms.sort((a, b) => compareTerms(a, b, inputVars));

  // Handle edge cases: tautology and contradiction
  if (terms.length === 0) {
    // No terms at all
    if (formulaType === 'DNF') {
      // DNF with no terms = always false (contradiction)
      terms = [{ literals: [{ variable: '0', negated: false }] }];
    } else {
      // CNF with no clauses = always true (tautology)
      terms = [{ literals: [{ variable: '1', negated: false }] }];
    }
  } else if (terms.some(t => t.literals.length === 0)) {
    // At least one term has no literals (from all don't-cares)
    if (formulaType === 'DNF') {
      // DNF with term that has no literals = always true (tautology)
      terms = [{ literals: [{ variable: '1', negated: false }] }];
    } else {
      // CNF with clause that has no literals = always false (contradiction)
      terms = [{ literals: [{ variable: '0', negated: false }] }];
    }
  }

  return { type: formulaType, terms };
}

function compareTerms(t1: Term, t2: Term, inputVars: string[]): number {
  for (const variable of inputVars) {
    const v1 = getVariableValue(t1, variable);
    const v2 = getVariableValue(t2, variable);
    if (v1 !== v2) {
      return v1 - v2;
    }
  }
  return 0;
}

function getVariableValue(term: Term, variable: string): number {
  const literal = term.literals.find(l => l.variable === variable);
  if (!literal) return 2; // Missing
  return literal.negated ? 0 : 1;
}

export const updateTruthTable = async () => {
  console.log('[updateTruthTable] Called with new values:', stateManager.state);
  if (!stateManager.state.truthTable) {
    console.warn('[updateTruthTable] No truth table state found');
    return;
  }

  const truthTable = stateManager.state.truthTable

  /*
  console.log('[updateTruthTable] Current state before update:', {
    hasValues: !!stateManager.state.truthTable.values,
    currentValues: stateManager.state.truthTable.values,
    newValues
  });
  
  // Replace the entire truthTable object to trigger computed refs in components
  Object.assign(stateManager.state.truthTable.values, newValues);
  console.log('[updateTruthTable] State updated, values are now:', stateManager.state.truthTable.values);
  */
  const qmcResult = Minimizer.runQMC(truthTable)
  truthTable.qmcResult = qmcResult;

  if (qmcResult) {
    truthTable.couplingTermLatex = getCouplingTermLatex(
      qmcResult,
      truthTable.functionType,
      truthTable.inputVars
    )

    // Convert first QMC expression to Formula (flattened, choosing first option)
    if (qmcResult.expressions && qmcResult.expressions.length > 0) {
      truthTable.selectedFormula = flattenCouplingTermsToFormula(
        qmcResult.expressions[0]!,
        truthTable.functionType
      )
    }
  }
  /*
  // Calculate formulas for each output variable
  const formulas: Record<string, Record<string, Formula>> = {}

  for (let outputIdx = 0; outputIdx < truthTable.outputVars.length; outputIdx++) {
    const outputVar = truthTable.outputVars[outputIdx]
    if (!outputVar) continue

    // Extract single output column
    const singleOutputValues = truthTable.values.map(row => [row[outputIdx]]) as TruthTableData

    // Check if output is all zeros or all ones (trivial cases)
    const hasOne = singleOutputValues.some(row => row[0] === 1)
    const hasZero = singleOutputValues.some(row => row[0] === 0)
    const hasDontCare = singleOutputValues.some(row => row[0] === '-')

    // 1. DNF: Minify ON-set
    let minifiedDNF: TruthTableData
    if (!hasOne && !hasDontCare) {
      // All zeros - empty ON-set, no need to run Espresso
      minifiedDNF = []
    } else {
      minifiedDNF = await minifyTruthTable(
        truthTable.inputVars,
        [outputVar],
        singleOutputValues
      )
    }

    // 2. CNF: Minify OFF-set (invert output)
    const invertedValues = singleOutputValues.map(row => {
      const val = row[0]
      if (val === 1) return [0]
      if (val === 0) return [1]
      return [val]
    }) as TruthTableData

    let minifiedCNF: TruthTableData
    if (!hasZero && !hasDontCare) {
      // All ones - empty OFF-set, no need to run Espresso
      minifiedCNF = []
    } else {
      minifiedCNF = await minifyTruthTable(
        truthTable.inputVars,
        [outputVar],
        invertedValues
      )
    }

    formulas[outputVar] = {
      DNF: interpretMinifiedTable(minifiedDNF, FunctionType.DNF, truthTable.inputVars),
      CNF: interpretMinifiedTable(minifiedCNF, FunctionType.CNF, truthTable.inputVars)
    }
  }

  Object.assign(truthTable.formulas, formulas);
  */
  console.log('[updateTruthTable] Full stateManager.state:', stateManager.state);
}
