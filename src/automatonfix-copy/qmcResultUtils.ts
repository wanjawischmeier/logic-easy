import type { FunctionRepresentation, FunctionType, Formula } from '@/utility/types'
import type { QMCResult } from '@/utility/truthtable/minimizer'
import { defaultColor, generateTermColor, type TermColor } from '@/utility/truthtable/colorGenerator'
import { getFunctionSignature } from '@/utility/truthtable/latexGenerator'

export interface EdgeCaseResult {
  qmcResult: QMCResult
  formula: Formula
  couplingTermLatex: string
}

// Shared edge-case construction used by worker and automaton KV mode.
export function createEdgeCaseResult(
  type: 'tautology' | 'contradiction',
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
): EdgeCaseResult {
  const constant: '0' | '1' = type === 'tautology' ? '1' : '0'
  const signature = getFunctionSignature(functionType, functionRepresentation, inputVars)

  return {
    qmcResult: {
      iterations: [],
      minterms: [],
      pis: [],
      chart: null,
      expressions: [{ name: constant } as never],
      termColors: [defaultColor],
    },
    formula: {
      type: functionType,
      terms: [{ literals: [{ variable: constant, negated: false }] }],
    },
    couplingTermLatex: signature + constant,
  }
}

// Reuse PI colors by PI term string and assign new colors only when needed.
export function mapResultColorsByPiTerm(
  previousQmcResult: QMCResult | undefined,
  result: QMCResult,
): TermColor[] {
  if (!result?.pis?.length) return []

  const existingPIs = previousQmcResult?.pis || []
  const existingColors = previousQmcResult?.termColors || []
  const termColorMap = new Map<string, TermColor>()

  existingPIs.forEach((pi: { term?: string }, index: number) => {
    const color = existingColors[index]
    if (pi.term && color) termColorMap.set(pi.term, color)
  })

  const allColors = Array.from(termColorMap.values())
  return result.pis.map((pi: { term?: string }) => {
    const term = String(pi.term ?? '')
    const reused = term ? termColorMap.get(term) : undefined
    if (reused) return reused

    const nextColor = generateTermColor(allColors)
    allColors.push(nextColor)
    return nextColor
  })
}
