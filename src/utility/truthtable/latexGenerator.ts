import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type { Formula, FunctionType, FunctionRepresentation, Literal, Term } from '../types'
import { analyzeExpressions } from './expressionParser'
import type { QMCResult } from './minimizer'

export function formatLatexIdentifier(
  identifier: string,
  options?: { lowercase?: boolean },
): string {
  const normalized = options?.lowercase ? identifier.toLowerCase() : identifier

  return normalized
    .replace(/_(?!\{)([A-Za-z0-9]+)/g, '_{$1}')
    .replace(/\^\(([^)]+)\)/g, '^{$1}')
    .replace(/\^(?!\{)([A-Za-z0-9+\-]+)/g, '^{$1}')
}

export function getFunctionSignature(
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  options?: { lowercaseInputVars?: boolean },
): string {
  const formType = functionType === 'Disjunctive' ? 'D' : 'C'
  const formRepresentation = functionRepresentation === 'Normal' ? 'N' : 'M'
  const formattedInputVars = inputVars.map((inputVar) =>
    formatLatexIdentifier(inputVar, { lowercase: options?.lowercaseInputVars ?? false }),
  )
  return `f_{${formType}${formRepresentation}F}(${formattedInputVars.join(', ')}) = `
}

/**
 * Generate a binary minterm from a row index
 */
function getBinaryMinterm(rowIdx: number, inputVars: string[]): string {
  const binary = rowIdx.toString(2).padStart(inputVars.length, '0')
  const literals: string[] = []

  for (let i = 0; i < inputVars.length; i++) {
    const bit = binary[i]
    const variable = formatLatexIdentifier(inputVars[i]!)
    if (bit === '1') {
      literals.push(variable)
    } else {
      literals.push(`\\bar{${variable}}`)
    }
  }

  return literals.join('')
}

/**
 * Generate a binary maxterm from a row index
 */
function getBinaryMaxterm(rowIdx: number, inputVars: string[]): string {
  const binary = rowIdx.toString(2).padStart(inputVars.length, '0')
  const literals: string[] = []

  for (let i = 0; i < inputVars.length; i++) {
    const bit = binary[i]
    const variable = formatLatexIdentifier(inputVars[i]!)
    // Maxterm negates the bits (opposite of minterm)
    if (bit === '0') {
      literals.push(variable)
    } else {
      literals.push(`\\bar{${variable}}`)
    }
  }

  return '(' + literals.join(' + ') + ')'
}

/**
 * Extract variable letters from a LaTeX term for sorting (remove \bar{} notation)
 */
function getTermSortKey(term: string): string {
  return term.replace(/\\bar\{([a-z])\}/g, '$1')
}

function buildVariableTokens(inputVars: string[], lowercaseInputVars: boolean): string[] {
  return inputVars
    .map((inputVar) => formatLatexIdentifier(inputVar, { lowercase: lowercaseInputVars }))
    .sort((left, right) => right.length - left.length)
}

function makeConstantFormula(functionType: FunctionType, constant: '0' | '1'): Formula {
  return {
    type: functionType,
    terms: [{ literals: [{ variable: constant, negated: false }] }],
  }
}

function parseFormulaTermText(
  termText: string,
  inputVars: string[],
  lowercaseInputVars: boolean,
): Term {
  const normalizedTerm = termText.trim()
  if (normalizedTerm === '0' || normalizedTerm === '1') {
    return {
      literals: [{ variable: normalizedTerm, negated: false }],
    }
  }

  const variableTokens = buildVariableTokens(inputVars, lowercaseInputVars)
  const literals: Literal[] = []
  let cursor = 0

  while (cursor < normalizedTerm.length) {
    const remaining = normalizedTerm.slice(cursor)

    if (/^[\s()+]+$/.test(remaining[0] ?? '')) {
      cursor += 1
      continue
    }

    const negatedToken = variableTokens.find((token) => remaining.startsWith(`\\bar{${token}}`))
    if (negatedToken) {
      literals.push({ variable: negatedToken, negated: true })
      cursor += `\\bar{${negatedToken}}`.length
      continue
    }

    const directToken = variableTokens.find((token) => remaining.startsWith(token))
    if (directToken) {
      literals.push({ variable: directToken, negated: false })
      cursor += directToken.length
      continue
    }

    cursor += 1
  }

  if (literals.length === 0) {
    return {
      literals: [{ variable: '0', negated: false }],
    }
  }

  return { literals }
}

function buildFormulaFromTerms(
  termTexts: string[],
  functionType: FunctionType,
  inputVars: string[],
  lowercaseInputVars: boolean,
): Formula {
  const terms = termTexts.map((termText) =>
    parseFormulaTermText(termText, inputVars, lowercaseInputVars),
  )

  if (terms.length === 0) {
    return makeConstantFormula(functionType, functionType === 'Disjunctive' ? '0' : '1')
  }

  return {
    type: functionType,
    terms,
  }
}

function getNormalFormFormula(
  values: TruthTableState['values'],
  functionType: FunctionType,
  inputVars: string[],
  outputVariableIndex: number,
): Formula {
  const terms: Term[] = []

  if (functionType === 'Disjunctive') {
    for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx]
      if (!row || row[outputVariableIndex] !== 1) continue

      const binary = rowIdx.toString(2).padStart(inputVars.length, '0')
      const literals: Literal[] = []
      for (let i = 0; i < inputVars.length; i++) {
        literals.push({
          variable: inputVars[i]!,
          negated: binary[i] !== '1',
        })
      }
      terms.push({ literals })
    }

    if (terms.length === 0) return makeConstantFormula(functionType, '0')
    if (terms.length === Math.pow(2, inputVars.length))
      return makeConstantFormula(functionType, '1')

    return { type: functionType, terms }
  }

  for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
    const row = values[rowIdx]
    if (!row || row[outputVariableIndex] !== 0) continue

    const binary = rowIdx.toString(2).padStart(inputVars.length, '0')
    const literals: Literal[] = []
    for (let i = 0; i < inputVars.length; i++) {
      literals.push({
        variable: inputVars[i]!,
        negated: binary[i] === '1',
      })
    }
    terms.push({ literals })
  }

  if (terms.length === 0) return makeConstantFormula(functionType, '1')
  if (terms.length === Math.pow(2, inputVars.length)) return makeConstantFormula(functionType, '0')

  return { type: functionType, terms }
}

export function formulaToLatex(formula: Formula): string {
  if (formula.terms.length === 0) {
    return formula.type === 'Disjunctive' ? '0' : '1'
  }

  const isCNF = formula.type === 'Conjunctive'

  const renderLiteral = (literal: Literal): string => {
    if (literal.variable === '0' || literal.variable === '1') {
      return literal.variable
    }

    const variable = formatLatexIdentifier(literal.variable)
    return literal.negated ? `\\bar{${variable}}` : variable
  }

  const renderedTerms = formula.terms.map((term) => {
    if (term.literals.length === 1) {
      return renderLiteral(term.literals[0]!)
    }

    const text = term.literals.map(renderLiteral).join(isCNF ? ' + ' : '')
    return isCNF ? `(${text})` : text
  })

  return renderedTerms.join(isCNF ? '' : ' + ')
}

/**
 * Get LaTeX for normal form (canonical form without minimization)
 */
function getNormalFormLatex(
  values: TruthTableState['values'],
  functionType: FunctionType,
  inputVars: string[],
  outputVariableIndex: number,
): string {
  if (functionType === 'Disjunctive') {
    // DNF: collect all minterms (rows where output is 1)
    const minterms: string[] = []

    for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx]
      if (!row) continue
      const outputValue = row[outputVariableIndex]
      if (outputValue === 1) {
        minterms.push(getBinaryMinterm(rowIdx, inputVars))
      }
    }

    if (minterms.length === 0) {
      return '0' // Contradiction
    }
    if (minterms.length === Math.pow(2, inputVars.length)) {
      return '1' // Tautology
    }

    return minterms.join(' + ')
  } else {
    // CNF: collect all maxterms (rows where output is 0)
    const maxterms: string[] = []

    for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx]
      if (!row) continue
      const outputValue = row[outputVariableIndex]
      if (outputValue === 0) {
        maxterms.push(getBinaryMaxterm(rowIdx, inputVars))
      }
    }

    if (maxterms.length === 0) {
      return '1' // Tautology
    }
    if (maxterms.length === Math.pow(2, inputVars.length)) {
      return '0' // Contradiction
    }

    return maxterms.join('')
  }
}

/**
 * Generate the Cartesian product of arrays
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  if (arrays.length === 1) return arrays[0]!.map((item) => [item])

  const [first, ...rest] = arrays
  const restProduct = cartesianProduct(rest)

  return first!.flatMap((item) => restProduct.map((combo) => [item, ...combo]))
}

/**
 * Get all possible equivalent minimal forms as complete formulas
 * Returns { signature, formulas } where each formula is a complete minimal expression
 */
export function getAlternativeMinimalForms(
  qmcResult: QMCResult,
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  truthTableValues?: TruthTableState['values'],
  outputVariableIndex?: number,
  options?: { lowercaseInputVars?: boolean },
): { signature: string; formulas: Formula[] } {
  const signature = getFunctionSignature(functionType, functionRepresentation, inputVars, options)
  const lowercaseInputVars = options?.lowercaseInputVars ?? false

  // If normal form requested and values provided, return canonical form
  if (
    functionRepresentation === 'Normal' &&
    truthTableValues &&
    outputVariableIndex !== undefined
  ) {
    return {
      signature,
      formulas: [
        getNormalFormFormula(truthTableValues, functionType, inputVars, outputVariableIndex),
      ],
    }
  }

  if (qmcResult.expressions.length === 0) {
    return { signature, formulas: [makeConstantFormula(functionType, '0')] }
  }

  const firstExpr = qmcResult.expressions[0]
  if ((firstExpr as any).name === '1') {
    return { signature, formulas: [makeConstantFormula(functionType, '1')] }
  }
  if ((firstExpr as any).name === '0') {
    return { signature, formulas: [makeConstantFormula(functionType, '0')] }
  }

  const isCNF = functionType === 'Conjunctive'
  const { constantTerms, variablePositions } = analyzeExpressions(qmcResult.expressions, isCNF)

  // Sort constant terms
  const sortedConstantTerms = constantTerms.sort((a, b) =>
    getTermSortKey(a).localeCompare(getTermSortKey(b)),
  )

  // If no variable positions, return single formula with just constant terms
  if (variablePositions.length === 0) {
    return {
      signature,
      formulas: [
        buildFormulaFromTerms(sortedConstantTerms, functionType, inputVars, lowercaseInputVars),
      ],
    }
  }

  // Generate all combinations of variable position choices
  const combinations = cartesianProduct(variablePositions)

  const formulas = Array.from(
    new Set(combinations.map((combo) => JSON.stringify([...sortedConstantTerms, ...combo]))),
  ).map((serializedTerms) =>
    buildFormulaFromTerms(
      JSON.parse(serializedTerms) as string[],
      functionType,
      inputVars,
      lowercaseInputVars,
    ),
  )

  return { signature, formulas }
}

/**
 * Get all coupling terms as an array of LaTeX expressions
 * Returns { signature, terms } where signature is the function signature
 * and terms is an array of LaTeX expressions for each term
 */
export function getCouplingTermsLatexArray(
  qmcResult: QMCResult,
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  truthTableValues?: TruthTableState['values'],
  outputVariableIndex?: number,
  options?: { lowercaseInputVars?: boolean },
): { signature: string; terms: string[] } {
  const { signature, formulas } = getAlternativeMinimalForms(
    qmcResult,
    functionType,
    functionRepresentation,
    inputVars,
    truthTableValues,
    outputVariableIndex,
    options,
  )

  return { signature, terms: formulas.map((formula) => formulaToLatex(formula)) }
}

export function getCouplingTermLatex(
  qmcResult: QMCResult,
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  truthTableValues?: TruthTableState['values'],
  outputVariableIndex?: number,
  options?: { lowercaseInputVars?: boolean },
): string {
  const { signature, formulas } = getAlternativeMinimalForms(
    qmcResult,
    functionType,
    functionRepresentation,
    inputVars,
    truthTableValues,
    outputVariableIndex,
    options,
  )

  if (formulas.length === 0) {
    return signature + '0'
  }

  return signature + formulaToLatex(formulas[0]!)
}
