import type { TruthTableData } from "@/projects/Project";
import { stateManager } from "@/states/stateManager";
import { minifyTruthTable } from "@/utility/truthtable/espresso";
import { FunctionType, type Formula, type Literal, type Term } from "@/utility/types";

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

export const updateTruthTable = async (newValues: TruthTableData) => {
  console.log('[updateTruthTable] Called with new values:', newValues);

  if (!stateManager.state.truthTable) {
    console.warn('[updateTruthTable] No truth table state found');
    return;
  }

  console.log('[updateTruthTable] Current state before update:', {
    hasValues: !!stateManager.state.truthTable.values,
    currentValues: stateManager.state.truthTable.values,
    newValues
  });

  // Replace the entire truthTable object to trigger computed refs in components
  Object.assign(stateManager.state.truthTable.values, newValues);
  console.log('[updateTruthTable] State updated, values are now:', stateManager.state.truthTable.values);

  // Calculate formulas for each output variable
  const formulas: Record<string, Record<string, Formula>> = {}

  for (let outputIdx = 0; outputIdx < stateManager.state.truthTable.outputVars.length; outputIdx++) {
    const outputVar = stateManager.state.truthTable.outputVars[outputIdx]
    if (!outputVar) continue

    // Extract single output column
    const singleOutputValues = newValues.map(row => [row[outputIdx]]) as TruthTableData

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
        stateManager.state.truthTable.inputVars,
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
        stateManager.state.truthTable.inputVars,
        [outputVar],
        invertedValues
      )
    }

    formulas[outputVar] = {
      DNF: interpretMinifiedTable(minifiedDNF, FunctionType.DNF, stateManager.state.truthTable.inputVars),
      CNF: interpretMinifiedTable(minifiedCNF, FunctionType.CNF, stateManager.state.truthTable.inputVars)
    }
  }

  Object.assign(stateManager.state.truthTable.formulas, formulas);
  console.log('[updateTruthTable] Full stateManager.state:', stateManager.state);
}
