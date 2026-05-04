import type { Operation } from 'logi.js'
import type { FsmState } from '@/projects/state-machine/FsmTypes'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import { calcBinaryID, normalizeBits } from '@/utility/fsm/bitOperations'
import { defaultFunctionRepresentation, defaultFunctionType } from '@/utility/types'
import type { QMCResult } from '@/utility/truthtable/minimizer'
import { flattenCouplingTermsToFormula } from '@/utility/truthtable/expressionParser'
import { getCouplingTermLatex } from '@/utility/truthtable/latexGenerator'
import {
  generateTermColor,
  mapFormulaTermsToPIColors,
  type TermColor,
} from '@/utility/truthtable/colorGenerator'
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager'
import { stateManager } from '@/projects/stateManager'

function buildNames(prefix: string, bits: number, suffix: string): string[] {
  return Array.from({ length: bits }, (_, index) => `${prefix}_${bits - 1 - index}^${suffix}`)
}

function toTruthTableCell(bit: string): TruthTableState['values'][number][number] {
  if (bit === '0') return 0
  if (bit === '1') return 1
  return '-'
}

function buildPlaceholderVariableMap(inputVars: string[]): Record<string, string> {
  const map: Record<string, string> = {}

  inputVars.forEach((inputVar, index) => {
    const placeholder = String.fromCharCode(97 + index)
    map[placeholder] = inputVar
    map[placeholder.toUpperCase()] = inputVar
  })

  return map
}

function remapExpressionVariables(
  expression: unknown,
  variableMap: Record<string, string>,
): unknown {
  if (!expression || typeof expression !== 'object') return expression

  const source = expression as { name?: unknown; args?: unknown[] }
  const remappedArgs = Array.isArray(source.args)
    ? source.args.map((arg) => remapExpressionVariables(arg, variableMap))
    : source.args

  if (typeof source.name === 'string') {
    const mappedName = variableMap[source.name]
    if (mappedName) {
      return {
        ...source,
        name: mappedName,
        ...(Array.isArray(remappedArgs) ? { args: remappedArgs } : {}),
      }
    }
  }

  return {
    ...source,
    ...(Array.isArray(remappedArgs) ? { args: remappedArgs } : {}),
  }
}

function remapQmcResultToInputVars(result: QMCResult, inputVars: string[]): QMCResult {
  if (!result?.expressions?.length) return result

  const variableMap = buildPlaceholderVariableMap(inputVars)
  return {
    ...result,
    expressions: result.expressions.map(
      (expression) => remapExpressionVariables(expression as Operation, variableMap) as Operation,
    ),
  }
}

function mapResultColorsByPiTerm(
  previousQmcResult: QMCResult | undefined,
  result: QMCResult,
): TermColor[] {
  if (!result?.pis?.length) return []

  const existingPIs = previousQmcResult?.pis || []
  const existingColors = previousQmcResult?.termColors || []
  const termColorMap = new Map<string, TermColor>()

  existingPIs.forEach((pi: { term?: string }, index: number) => {
    const color = existingColors[index]
    if (pi.term && color) {
      termColorMap.set(pi.term, color)
    }
  })

  const allColors = Array.from(termColorMap.values())
  return result.pis.map((pi: { term?: string }) => {
    const term = String(pi.term ?? '')
    const reused = term ? termColorMap.get(term) : undefined
    if (reused) return reused

    const generatedColor = generateTermColor(allColors)
    allColors.push(generatedColor)
    return generatedColor
  })
}

export interface FsmKVDiagramPresentation {
  qmcResult?: QMCResult
  selectedFormula?: TruthTableState['selectedFormula']
  formulaTermColors?: TermColor[]
  couplingTermLatex?: string
}

export function buildFsmImmutableCellMask(
  fsm: FsmState | undefined,
  truthTable: TruthTableState | undefined,
): boolean[][] | undefined {
  if (!fsm || !truthTable?.values?.length) return undefined

  const nodeCount = (fsm.nodes || []).length
  const stateBits = nodeCount <= 1 ? 0 : Math.max(0, Math.ceil(Math.log2(Math.max(1, nodeCount))))
  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)

  const possibleRows = new Set<number>()
  for (const transition of fsm.transitions || []) {
    const fromBinary = normalizeBits(
      calcBinaryID(transition.fromNodeId ?? 0, Math.max(1, stateBits)),
      stateBits,
      '0',
      'left',
    )
    const input = normalizeBits(transition.input ?? '', inputBits, 'x', 'right')
    if (!/^[01]*$/.test(fromBinary) || !/^[01]*$/.test(input)) continue

    const rowIndex = parseInt(`${fromBinary}${input}`, 2)
    if (!Number.isNaN(rowIndex)) {
      possibleRows.add(rowIndex)
    }
  }

  return truthTable.values.map((row, rowIndex) => row.map(() => !possibleRows.has(rowIndex)))
}

export function buildFsmKVDiagramPresentation(
  truthTable: TruthTableState | undefined,
): FsmKVDiagramPresentation {
  if (!truthTable?.qmcResult) return {}

  const remappedResult = remapQmcResultToInputVars(truthTable.qmcResult, truthTable.inputVars)
  const remappedTermColors = mapResultColorsByPiTerm(truthTable.qmcResult, remappedResult)

  if (!remappedResult.expressions.length) {
    return {
      qmcResult: remappedResult,
      couplingTermLatex: truthTable.couplingTermLatex,
      selectedFormula: truthTable.selectedFormula,
      formulaTermColors: truthTable.formulaTermColors ?? remappedTermColors,
    }
  }

  remappedResult.termColors = remappedTermColors

  const selectedFormula = flattenCouplingTermsToFormula(
    remappedResult.expressions[0]!,
    truthTable.functionType,
    { preserveVariableCase: true },
  )

  let formulaTermColors: TermColor[] | undefined
  try {
    formulaTermColors = mapFormulaTermsToPIColors(
      selectedFormula,
      remappedResult.pis,
      remappedResult.termColors,
      truthTable.inputVars,
    )
  } catch (error) {
    console.warn('[buildFsmKVDiagramPresentation] Failed to map formula term colors:', error)
    formulaTermColors = remappedResult.termColors
  }

  return {
    qmcResult: remappedResult,
    selectedFormula,
    formulaTermColors,
    couplingTermLatex: getCouplingTermLatex(
      remappedResult,
      truthTable.functionType,
      truthTable.functionRepresentation,
      truthTable.inputVars,
      truthTable.values,
      truthTable.outputVariableIndex,
      { lowercaseInputVars: true },
    ),
  }
}

export function exportFsmToTruthTable(
  fsm: FsmState,
  previousState?: TruthTableState,
): TruthTableState {
  const nodeCount = (fsm.nodes || []).length
  const stateBits = nodeCount <= 1 ? 0 : Math.max(0, Math.ceil(Math.log2(Math.max(1, nodeCount))))
  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)

  const inputVars = [...buildNames('Z', stateBits, 'n'), ...buildNames('X', inputBits, 'n')]
  const outputVars = [...buildNames('Z', stateBits, '(n+1)'), ...buildNames('Y', outputBits, 'n')]

  const rowCount = 1 << (stateBits + inputBits)
  const values: TruthTableState['values'] = Array.from({ length: rowCount }, () =>
    Array.from({ length: outputVars.length }, () => '-'),
  )

  for (const tr of fsm.transitions || []) {
    const fromBinary = normalizeBits(
      calcBinaryID(tr.fromNodeId ?? 0, Math.max(1, stateBits)),
      stateBits,
      '0',
      'left',
    )
    const input = normalizeBits(tr.input ?? '', inputBits, 'x', 'right')
    if (!/^[01]*$/.test(fromBinary) || !/^[01]*$/.test(input)) continue

    const rowIndex = parseInt(`${fromBinary}${input}`, 2)
    if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= rowCount) continue

    const toBinary =
      tr.toNodeId >= 0
        ? normalizeBits(calcBinaryID(tr.toNodeId, Math.max(1, stateBits)), stateBits, 'x', 'left')
        : normalizeBits(tr.toBinaryId ?? '', stateBits, 'x', 'left')
    const nextStateCells = toBinary.split('').map(toTruthTableCell)
    const outputCells = normalizeBits(tr.mealyOutput ?? '', outputBits, 'x', 'right')
      .split('')
      .map(toTruthTableCell)

    values[rowIndex] = [...nextStateCells, ...outputCells]
  }

  const selectedOutputIndex = Math.min(
    Math.max(previousState?.outputVariableIndex ?? 0, 0),
    Math.max(outputVars.length - 1, 0),
  )

  return {
    inputVars,
    outputVars,
    values,
    formulas: {},
    outputVariableIndex: selectedOutputIndex,
    functionType: previousState?.functionType ?? defaultFunctionType,
    functionRepresentation: previousState?.functionRepresentation ?? defaultFunctionRepresentation,
    qmcResult: previousState?.qmcResult,
    couplingTermLatex: previousState?.couplingTermLatex,
    selectedFormula: previousState?.selectedFormula,
    formulaTermColors: previousState?.formulaTermColors,
    fsmMode: true,
  }
}

export function syncFsmStateToTruthTable(fsm: FsmState): void {
  stateManager.state.truthTable = exportFsmToTruthTable(fsm, stateManager.state.truthTable)
  truthTableWorkerManager.update()
}

export function applyTruthTableToFsm(fsm: FsmState, truthTable: TruthTableState): void {
  const nodeCount = (fsm.nodes || []).length
  const stateBits = nodeCount <= 1 ? 0 : Math.max(0, Math.ceil(Math.log2(Math.max(1, nodeCount))))
  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)

  const rowCount = 1 << Math.max(0, stateBits + inputBits)
  if (!truthTable.values || truthTable.values.length === 0) return

  const transitionByKey = new Map<string, FsmState['transitions'][number]>()
  for (const tr of fsm.transitions || []) {
    const fromBinary = normalizeBits(
      calcBinaryID(tr.fromNodeId ?? 0, Math.max(1, stateBits)),
      stateBits,
      '0',
      'left',
    )
    const input = normalizeBits(tr.input ?? '', inputBits, 'x', 'right')
    transitionByKey.set(`${fromBinary}:${input}`, tr)
  }

  for (let rowIndex = 0; rowIndex < Math.min(rowCount, truthTable.values.length); rowIndex++) {
    const row = truthTable.values[rowIndex]
    if (!row) continue

    const combinedBits = rowIndex.toString(2).padStart(stateBits + inputBits, '0')
    const fromBinary = combinedBits.slice(0, stateBits).padStart(stateBits, '0')
    const input = combinedBits.slice(stateBits).padStart(inputBits, '0')
    const transition = transitionByKey.get(`${fromBinary}:${input}`)
    if (!transition) continue

    const nextStateBits = row
      .slice(0, stateBits)
      .map((cell) => (cell === 0 ? '0' : cell === 1 ? '1' : 'x'))
      .join('')
    const outputBitsValue = row
      .slice(stateBits)
      .map((cell) => (cell === 0 ? '0' : cell === 1 ? '1' : 'x'))
      .join('')

    if (stateBits > 0) {
      if (/^[01]+$/.test(nextStateBits)) {
        const target = fsm.nodes.find(
          (node) => calcBinaryID(node.nodeId, Math.max(1, stateBits)) === nextStateBits,
        )
        transition.toNodeId = target ? target.nodeId : -1
        transition.toBinaryId = target ? undefined : nextStateBits
      } else {
        transition.toNodeId = -1
        transition.toBinaryId = nextStateBits
      }
    }

    if (outputBits > 0) {
      transition.mealyOutput = outputBitsValue
    }
  }
}
