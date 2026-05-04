import type { Operation } from 'logi.js'
import type { Formula, FunctionType, Literal, Term } from '../types'
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject'

function getOperationRecord(operation: Operation): Record<string, unknown> {
  return operation as unknown as Record<string, unknown>
}

function getOperationName(operation: Operation): string | undefined {
  const name = getOperationRecord(operation).name
  if (typeof name === 'string') return name
  if (name === undefined || name === null) return undefined
  return String(name)
}

function getOperationPriority(operation: Operation): number | undefined {
  const priority = getOperationRecord(operation).priority
  return typeof priority === 'number' ? priority : undefined
}

function getOperationArgs(operation: Operation): Operation[] {
  const args = getOperationRecord(operation).args
  return Array.isArray(args) ? (args as Operation[]) : []
}

/**
 * Detects if a truth table represents a tautology (all 1s/don't cares) or contradiction (all 0s/don't cares)
 * @param values Truth table data
 * @param outputIndex Index of the output column to check
 * @returns 'tautology' if all values are 1 or '-', 'contradiction' if all are 0 or '-', null otherwise
 */
export function detectTautologyOrContradiction(
  values: TruthTableData,
  outputIndex: number,
): 'tautology' | 'contradiction' | null {
  if (values.length === 0) return null

  let hasOne = false
  let hasZero = false

  for (const row of values) {
    const cell = row[outputIndex]
    if (cell === 1) hasOne = true
    if (cell === 0) hasZero = true

    // If we have both 1s and 0s, it's neither
    if (hasOne && hasZero) return null
  }

  // All are 1s or don't cares
  if (hasOne && !hasZero) return 'tautology'

  // All are 0s or don't cares
  if (hasZero && !hasOne) return 'contradiction'

  // All are don't cares (treat as contradiction for simplicity)
  return 'contradiction'
}

/**
 * Parses a single literal (VAR or NOT(VAR))
 */
function parseLiteral(expression: Operation, preserveVariableCase = false): Literal | null {
  // Handle NOT
  if (getOperationPriority(expression) === 15) {
    const inner = getOperationArgs(expression)[0]
    const innerName = inner ? getOperationName(inner) : undefined
    if (innerName !== undefined) {
      return {
        variable: preserveVariableCase ? innerName : innerName.toLowerCase(),
        negated: true,
      }
    }
  }

  // Handle VAR
  const name = getOperationName(expression)
  if (name !== undefined) {
    return {
      variable: preserveVariableCase ? name : name.toLowerCase(),
      negated: false,
    }
  }

  return null
}

/**
 * Convert QMC expression to Formula, choosing first option when there are multiple
 */
export function flattenCouplingTermsToFormula(
  expression: Operation,
  functionType: FunctionType,
  options?: { preserveVariableCase?: boolean },
): Formula {
  const terms: Term[] = []
  const preserveVariableCase = options?.preserveVariableCase ?? false

  // Check for constant expressions (tautology '1' or contradiction '0')
  if (getOperationName(expression) === '1') {
    return {
      type: functionType,
      terms: [{ literals: [{ variable: '1', negated: false }] }],
    }
  }
  if (getOperationName(expression) === '0') {
    return {
      type: functionType,
      terms: [{ literals: [{ variable: '0', negated: false }] }],
    }
  }

  if (functionType === 'Conjunctive') {
    // CNF: AND of OR clauses
    if (getOperationPriority(expression) === 8) {
      const args = getOperationArgs(expression)
      for (const clauseOp of args) {
        const literals: Literal[] = []
        if (getOperationPriority(clauseOp) === 6) {
          const orArgs = getOperationArgs(clauseOp)
          for (const lit of orArgs) {
            const literal = parseLiteral(lit, preserveVariableCase)
            if (literal) literals.push(literal)
          }
        } else {
          const literal = parseLiteral(clauseOp, preserveVariableCase)
          if (literal) literals.push(literal)
        }
        if (literals.length > 0) {
          terms.push({ literals })
        }
      }
    } else if (getOperationPriority(expression) === 6) {
      const literals: Literal[] = []
      const args = getOperationArgs(expression)
      for (const lit of args) {
        const literal = parseLiteral(lit, preserveVariableCase)
        if (literal) literals.push(literal)
      }
      if (literals.length > 0) {
        terms.push({ literals })
      }
    } else {
      const literal = parseLiteral(expression, preserveVariableCase)
      if (literal) {
        terms.push({ literals: [literal] })
      }
    }
  } else {
    // DNF: OR of AND terms
    if (getOperationPriority(expression) === 6) {
      const args = getOperationArgs(expression)
      for (const termOp of args) {
        const literals: Literal[] = []
        if (getOperationPriority(termOp) === 8) {
          const andArgs = getOperationArgs(termOp)
          for (const lit of andArgs) {
            const literal = parseLiteral(lit, preserveVariableCase)
            if (literal) literals.push(literal)
          }
        } else {
          const literal = parseLiteral(termOp, preserveVariableCase)
          if (literal) literals.push(literal)
        }
        if (literals.length > 0) {
          terms.push({ literals })
        }
      }
    } else if (getOperationPriority(expression) === 8) {
      const literals: Literal[] = []
      const args = getOperationArgs(expression)
      for (const lit of args) {
        const literal = parseLiteral(lit, preserveVariableCase)
        if (literal) literals.push(literal)
      }
      if (literals.length > 0) {
        terms.push({ literals })
      }
    } else {
      const literal = parseLiteral(expression, preserveVariableCase)
      if (literal) {
        terms.push({ literals: [literal] })
      }
    }
  }

  console.log('[qmcExpressionToFormula] Input:', expression, 'Output terms:', terms)
  return {
    type: functionType,
    terms: terms,
  }
}

/**
 * Convert Operation to custom LaTeX string (lowercase variables, no operators)
 */
function operationToLatex(op: Operation, isCNF: boolean = false): string {
  const name = getOperationName(op)
  if (name !== undefined) {
    return name.toLowerCase()
  }

  if (getOperationPriority(op) === 15) {
    const inner = getOperationArgs(op)[0]
    if (!inner) return ''
    return `\\bar{${operationToLatex(inner, isCNF)}}`
  }

  if (getOperationPriority(op) === 8) {
    const args = getOperationArgs(op)
    if (isCNF) {
      return args.map((arg) => operationToLatex(arg, isCNF)).join('')
    } else {
      return args.map((arg) => operationToLatex(arg, isCNF)).join('')
    }
  }

  if (getOperationPriority(op) === 6) {
    const args = getOperationArgs(op)
    if (isCNF) {
      const sum = args.map((arg) => operationToLatex(arg, isCNF)).join(' + ')
      return args.length > 1 ? `(${sum})` : sum
    } else {
      return args.map((arg) => operationToLatex(arg, isCNF)).join(' + ')
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
    const matches = latex.match(/\([^)]+\)|[^()\s]+/g) || []
    return matches.map((t) => t.trim())
  } else {
    return latex.split(' + ').map((t) => t.trim())
  }
}

/**
 * Analyze expressions to find common terms and variable positions
 */
export function analyzeExpressions(
  exprs: Operation[],
  isCNF: boolean,
): { constantTerms: string[]; variablePositions: string[][] } {
  if (exprs.length === 0) return { constantTerms: [], variablePositions: [] }
  if (exprs.length === 1)
    return { constantTerms: getTerms(exprs[0]!, isCNF), variablePositions: [] }

  const allTerms = exprs.map((expr) => getTerms(expr, isCNF))

  // Find common terms across all expressions
  let commonTerms = allTerms[0] ?? []
  for (let i = 1; i < allTerms.length; i++) {
    const terms = allTerms[i]!
    commonTerms = commonTerms.filter((t) => terms.includes(t))
  }

  // For each expression, just keep the terms that are not common
  const remainingTerms = allTerms.map((terms) => terms.filter((t) => !commonTerms.includes(t)))

  const maxLength = Math.max(...remainingTerms.map((t) => t.length))

  const constantTerms: string[] = [...commonTerms]
  const variablePositions: string[][] = []

  for (let pos = 0; pos < maxLength; pos++) {
    const termsAtPos = remainingTerms
      .map((terms) => terms[pos]!)
      .filter((t) => t !== undefined && t !== '')
    const uniqueTerms = Array.from(new Set(termsAtPos))

    if (uniqueTerms.length > 0) {
      variablePositions.push(termsAtPos)
    }
  }

  return { constantTerms, variablePositions }
}
