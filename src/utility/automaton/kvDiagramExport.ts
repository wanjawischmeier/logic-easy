import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type {
  AutomatonDerivedFormulaBundle,
  AutomatonKVFeatureFlagInput,
  AutomatonKVMode,
  AutomatonKVModeInput,
  AutomatonState,
  BinaryTransitionLike,
  KVDiagramBinding,
  KVDiagramCellChange,
  KVDiagramExportData,
  KVDiagramExportOptions,
} from '@/projects/automaton/AutomatonTypes'
import { Minimizer, type QMCResult } from '@/utility/truthtable/minimizer'
import {
  detectTautologyOrContradiction,
  flattenCouplingTermsToFormula,
} from '@/utility/truthtable/expressionParser'
import { getCouplingTermLatex } from '@/utility/truthtable/latexGenerator'
import {
  mapFormulaTermsToPIColors,
  type TermColor,
} from '@/utility/truthtable/colorGenerator'
import { createEdgeCaseResult, mapResultColorsByPiTerm } from '@/utility/truthtable/qmcResultUtils'
import {
  normalizeBinaryBits,
  normalizeBits,
  setBit,
} from '@/utility/automaton/bitOperations'
import {
  buildArtificialTruthTableFromComputedColumns,
  type TransitionTableComputedColumns,
  type TransitionTableComputedRow,
} from '@/utility/automaton/transitionTableArtificialTruthTable'

export type {
  AutomatonDerivedFormulaBundle,
  AutomatonKVFeatureFlagInput,
  AutomatonKVMode,
  AutomatonKVModeInput,
  BinaryTransitionLike,
  KVDiagramBinding,
  KVDiagramCellChange,
  KVDiagramExportData,
  KVDiagramExportOptions,
} from '@/projects/automaton/AutomatonTypes'

// Enables automaton KV logic only for automaton-related panels.
function isAutomatonKVFeatureEnabled(input: AutomatonKVFeatureFlagInput): boolean {
  if (input.enabled === true) return true
  if (input.enabled === false) return false
  if (!input.hasAutomatonState) return false

  const panelId = input.panelId ?? ''
  const knownPrefixes = ['state-table', 'fsm-engine', 'transition-table', 'state-machine']
  return knownPrefixes.some((prefix) => panelId === prefix || panelId.startsWith(prefix))
}

// Truth-table data is usable when all core arrays are populated.
export function hasUsableTruthTableData(state: {
  inputVars?: string[]
  outputVars?: string[]
  values?: TruthTableState['values']
}): boolean {
  return (state.inputVars?.length ?? 0) > 0 && (state.outputVars?.length ?? 0) > 0 && (state.values?.length ?? 0) > 0
}

// Resolves operational KV mode flags from project/panel context.
export function resolveAutomatonKVMode(input: AutomatonKVModeInput): AutomatonKVMode {
  const shouldForceAutomatonMode = input.hasAutomatonState && !input.hasUsableTruthTableData

  const explicitAutomatonFlag = input.panelParams?.enableAutomatonKV
  const automatonEnabled =
    typeof explicitAutomatonFlag === 'boolean'
      ? explicitAutomatonFlag
      : input.isAutomatonProject || shouldForceAutomatonMode

  const isAutomatonTransitionKV = isAutomatonKVFeatureEnabled({
    panelId: input.panelId,
    hasAutomatonState: input.hasAutomatonState,
    enabled: automatonEnabled,
  })

  const explicitExportFlag = input.panelParams?.enableAutomatonKVExportToTable
  const aliasExportFlag = input.panelParams?.updateTruthTable
  const exportToTable =
    typeof explicitExportFlag === 'boolean'
      ? explicitExportFlag
      : typeof aliasExportFlag === 'boolean'
        ? aliasExportFlag
        : true

  return {
    shouldForceAutomatonMode,
    isAutomatonTransitionKV,
    exportToTable,
  }
}

// Chooses automaton-backed binding only when export exists and mode requires it.
export function resolveUseAutomatonBinding(input: {
  hasTransitionTableExport: boolean
  isAutomatonTransitionKV: boolean
  shouldForceAutomatonMode: boolean
}): boolean {
  return input.hasTransitionTableExport && (input.isAutomatonTransitionKV || input.shouldForceAutomatonMode)
}

// Runs QMC derivation and maps resulting formulas/colors for automaton KV mode.
export async function deriveAutomatonFormulaBundle(
  truthTable: TruthTableState,
): Promise<AutomatonDerivedFormulaBundle> {
  const edgeCase = detectTautologyOrContradiction(truthTable.values, truthTable.outputVariableIndex)
  if (edgeCase !== null) {
    const edgeResult = createEdgeCaseResult(
      edgeCase,
      truthTable.functionType,
      truthTable.functionRepresentation,
      truthTable.inputVars,
    )

    return {
      qmcResult: edgeResult.qmcResult,
      selectedFormula: edgeResult.formula,
      formulaTermColors: edgeResult.qmcResult.termColors,
      couplingTermLatex: edgeResult.couplingTermLatex,
    }
  }

  const result = await Minimizer.runQMC(truthTable)
  if (!result || !result.expressions.length) {
    return {
      qmcResult: result,
      selectedFormula: undefined,
      formulaTermColors: undefined,
      couplingTermLatex: undefined,
    }
  }

  const variableMap = buildQmcVariableNameMap(truthTable.inputVars)
  const remappedExpressions = result.expressions.map((expression) =>
    remapExpressionVariables(expression as unknown, variableMap),
  ) as unknown as QMCResult['expressions']
  const remappedResult: QMCResult = {
    ...result,
    expressions: remappedExpressions,
    termColors: mapResultColorsByPiTerm(truthTable.qmcResult, result),
  }

  const selectedFormula = flattenCouplingTermsToFormula(
    remappedResult.expressions[0]!,
    truthTable.functionType,
  )
  const couplingTermLatex = getCouplingTermLatex(
    remappedResult,
    truthTable.functionType,
    truthTable.functionRepresentation,
    truthTable.inputVars,
    truthTable.values,
    truthTable.outputVariableIndex,
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
    console.warn('[deriveAutomatonFormulaBundle] Failed to map formula term colors:', error)
    formulaTermColors = remappedResult.termColors
  }

  return {
    qmcResult: remappedResult,
    selectedFormula,
    formulaTermColors,
    couplingTermLatex,
  }
}

// Returns a cloned values matrix with one changed cell.
export function applyCellChangeToValues(
  values: TruthTableState['values'],
  change: KVDiagramCellChange,
): TruthTableState['values'] | null {
  const target = resolveCellChangeTarget(values, change)
  if (!target) return null

  const nextValues = values.map((existingRow) => [...existingRow])
  nextValues[target.rowIndex]![target.outputIndex] = change.value
  return nextValues
}

// Deep-clones truth-table values matrix.
export function cloneTruthTableValues(
  values: TruthTableState['values'],
): TruthTableState['values'] {
  return values.map((row) => [...row])
}

// Applies a single cell edit directly into mutable truth-table state.
export function applyCellChangeToTruthTable(
  truthTable: TruthTableState | undefined,
  change: KVDiagramCellChange,
): boolean {
  if (!truthTable) return false
  const target = resolveCellChangeTarget(truthTable.values, change)
  if (!target) return false

  truthTable.values[target.rowIndex]![target.outputIndex] = change.value
  return true
}

// Writes edited truth-table rows back into normalized automaton transitions.
export function applyTruthTableStateToAutomaton(
  automaton: AutomatonState,
  truthTable: TruthTableState,
): AutomatonState {
  const sortedStates = [...(automaton.states ?? [])].sort((left, right) => left.id - right.id)
  if (sortedStates.length === 0) return automaton

  const inferredInputBits = Math.max(
    0,
    ...(automaton.transitions ?? []).map((transition) => String(transition.input ?? '').length),
  )
  const totalInputVars = truthTable.inputVars?.length ?? 0
  const inferredStateBitsFromStateCount =
    sortedStates.length <= 1 ? 0 : Math.ceil(Math.log2(sortedStates.length))
  const inputBits = Math.min(inferredInputBits, totalInputVars)
  const stateBits = Math.max(totalInputVars - inputBits, inferredStateBitsFromStateCount)
  const rowBitCount = stateBits + inputBits
  if (rowBitCount <= 0) {
    return {
      ...automaton,
      states: sortedStates,
      transitions: [...(automaton.transitions ?? [])],
    }
  }

  const transitionByKey = new Map<string, AutomatonState['transitions'][number]>()
  for (const transition of automaton.transitions ?? []) {
    const normalizedInput = normalizeBits(String(transition.input ?? ''), inputBits, '0')
    transitionByKey.set(`${transition.from}:${normalizedInput}`, {
      ...transition,
      input: normalizedInput,
    })
  }

  const stateBitWidth = Math.max(stateBits, 1)
  const outputBitWidth = Math.max(
    1,
    ...(automaton.transitions ?? []).map((transition) => String(transition.output ?? '').length),
  )

  const outputDescriptors = (truthTable.outputVars ?? []).map((name) =>
    parseAutomatonOutputDescriptor(name, stateBitWidth, outputBitWidth),
  )

  const maxRows = Math.min(truthTable.values.length, 1 << rowBitCount)
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const row = truthTable.values[rowIndex]
    if (!row) continue

    const rowBits = rowIndex.toString(2).padStart(rowBitCount, '0')
    const fromStateBits = rowBits.slice(0, stateBits)
    const inputBitsValue = rowBits.slice(stateBits)
    const fromStateIndex = stateBits > 0 ? parseInt(fromStateBits, 2) : 0
    if (
      Number.isNaN(fromStateIndex) ||
      fromStateIndex < 0 ||
      fromStateIndex >= sortedStates.length
    ) {
      continue
    }

    const fromState = sortedStates[fromStateIndex]
    if (!fromState) continue

    const key = `${fromState.id}:${inputBitsValue}`
    const existing = transitionByKey.get(key)
    if (!existing) continue

    let nextStateBits = resolveTransitionNextStateBits(existing, stateBitWidth, sortedStates)
    let outputBitsValue = normalizeBits(String(existing.output ?? ''), outputBitWidth, 'x')

    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const descriptor = outputDescriptors[columnIndex]
      if (!descriptor) continue

      const cellValue = row[columnIndex]
      if (cellValue === undefined) continue
      const bit = toBitChar(cellValue)
      if (descriptor.kind === 'next-state') {
        nextStateBits = setBit(nextStateBits, descriptor.bitIndex, bit)
      } else {
        outputBitsValue = setBit(outputBitsValue, descriptor.bitIndex, bit)
      }
    }

    transitionByKey.set(key, {
      ...existing,
      output: outputBitsValue,
      ...resolveTransitionTarget(nextStateBits, sortedStates),
    })
  }

  const transitions = Array.from(transitionByKey.values()).sort((left, right) => {
    if (left.from !== right.from) return left.from - right.from
    return String(left.input ?? '').localeCompare(String(right.input ?? ''))
  })

  return {
    ...automaton,
    states: sortedStates,
    transitions,
  }
}

// Output column descriptor: either next-state bit or output bit.
type AutomatonOutputDescriptor =
  | { kind: 'next-state'; bitIndex: number }
  | { kind: 'output'; bitIndex: number }
  | null

// Parses output variable names like Z_0^(n+1) and Y_0^n.
function parseAutomatonOutputDescriptor(
  variableName: string,
  stateBitWidth: number,
  outputBitWidth: number,
): AutomatonOutputDescriptor {
  const nextStateMatch = /^[A-Za-z]_(\d+)\^\(n\+1\)$/i.exec(variableName)
  if (nextStateMatch) {
    const displayIndex = parseInt(nextStateMatch[1] ?? '', 10)
    if (Number.isNaN(displayIndex)) return null
    return {
      kind: 'next-state',
      bitIndex: Math.max(0, stateBitWidth - 1 - displayIndex),
    }
  }

  const outputMatch = /^[A-Za-z]_(\d+)\^n$/i.exec(variableName)
  if (outputMatch) {
    const displayIndex = parseInt(outputMatch[1] ?? '', 10)
    if (Number.isNaN(displayIndex)) return null
    return {
      kind: 'output',
      bitIndex: Math.max(0, outputBitWidth - 1 - displayIndex),
    }
  }

  return null
}

// Builds next-state bits from concrete targets or wildcard patterns.
function resolveTransitionNextStateBits(
  transition: AutomatonState['transitions'][number],
  bitWidth: number,
  states: AutomatonState['states'],
): string {
  if (transition.toPattern && transition.toPattern.length > 0) {
    return normalizeBits(transition.toPattern, bitWidth, 'x')
  }

  const toIndex = states.findIndex((state) => state.id === transition.to)
  if (toIndex < 0) {
    return 'x'.repeat(bitWidth)
  }

  return toIndex.toString(2).padStart(bitWidth, '0')
}

// Converts next-state bits back to either concrete state id or toPattern.
function resolveTransitionTarget(
  nextStateBits: string,
  states: AutomatonState['states'],
): Pick<AutomatonState['transitions'][number], 'to' | 'toPattern'> {
  const unresolvedTarget = {
    to: -1,
    toPattern: nextStateBits,
  }

  if (!/^[01]+$/.test(nextStateBits)) {
    return unresolvedTarget
  }

  const stateIndex = parseInt(nextStateBits, 2)
  const state = states[stateIndex]
  if (!state) {
    return unresolvedTarget
  }

  return {
    to: state.id,
    toPattern: undefined,
  }
}

// Converts truth-table cell values into bit chars used by transitions.
function toBitChar(value: TruthTableState['values'][number][number] | undefined): '0' | '1' | 'x' {
  if (value === 0) return '0'
  if (value === 1) return '1'
  return 'x'
}

// Adapts generic binary rows to computed transition columns.
export function buildComputedColumnsFromBinaryTransitions(
  rows: BinaryTransitionLike[],
  dimensions: Pick<TransitionTableComputedColumns, 'bitNumber' | 'inputBits' | 'outputBits'> & {
    stateCount?: number
  },
): TransitionTableComputedColumns {
  const binaryTransitions: TransitionTableComputedRow[] = rows.map((row, index) => ({
    id: Number.isInteger(row.id) ? Number(row.id) : index,
    input: String(row.input ?? ''),
    output: String(row.output ?? ''),
    fromBinary: String(row.fromBinary ?? ''),
    toBinary: String(row.toBinary ?? ''),
  }))

  return {
    binaryTransitions,
    bitNumber: resolveStateBitCount(binaryTransitions, dimensions.bitNumber, dimensions.stateCount),
    inputBits:
      dimensions.stateCount === 0 && binaryTransitions.length === 0
        ? 0
        : Math.max(dimensions.inputBits, 0),
    outputBits: Math.max(dimensions.outputBits, 0),
  }
}

// Computes required state-bit width from observed rows or fallback metadata.
function resolveStateBitCount(
  rows: TransitionTableComputedRow[],
  fallbackBits: number,
  stateCount?: number,
): number {
  if (stateCount === 0) return 0

  let maxFromStateIndex = -1

  for (const row of rows) {
    const normalized = normalizeBinaryBits(row.fromBinary)
    if (!normalized) continue

    const stateIndex = parseInt(normalized, 2)
    if (Number.isNaN(stateIndex)) continue
    maxFromStateIndex = Math.max(maxFromStateIndex, stateIndex)
  }

  if (maxFromStateIndex >= 0) {
    if (maxFromStateIndex === 0) return 0
    return Math.max(Math.ceil(Math.log2(maxFromStateIndex + 1)), 1)
  }

  if (typeof stateCount === 'number') {
    if (stateCount <= 1) return 0
    return Math.max(Math.ceil(Math.log2(stateCount)), 1)
  }

  return Math.max(fallbackBits, 0)
}

// Builds KV binding from base truth-table or automaton export snapshot.
export function buildKVDiagramBinding(
  baseTruthTable: TruthTableState,
  automatonExport: KVDiagramExportData | null,
  useAutomatonBinding: boolean,
): KVDiagramBinding {
  if (!useAutomatonBinding || !automatonExport) return toKVDiagramBinding(baseTruthTable)
  return toKVDiagramBinding(automatonExport.truthTable, automatonExport.immutableCellMask)
}

// Shared mapping from TruthTableState shape to KVDiagramBinding shape.
function toKVDiagramBinding(
  truthTable: TruthTableState,
  immutableCellMask?: KVDiagramBinding['immutableCellMask'],
): KVDiagramBinding {
  return {
    inputVars: truthTable.inputVars,
    outputVars: truthTable.outputVars,
    values: truthTable.values,
    outputVariableIndex: truthTable.outputVariableIndex,
    functionType: truthTable.functionType,
    functionRepresentation: truthTable.functionRepresentation,
    selectedFormula: truthTable.selectedFormula,
    qmcResult: truthTable.qmcResult,
    formulaTermColors: truthTable.formulaTermColors,
    couplingTermLatex: truthTable.couplingTermLatex,
    ...(immutableCellMask ? { immutableCellMask } : {}),
  }
}

// Exports transition columns to artificial truth-table data for KV/QMC.
export function exportTransitionColumnsToKVDiagram(
  columns: TransitionTableComputedColumns,
  previousState?: TruthTableState,
  options: KVDiagramExportOptions = {},
): KVDiagramExportData {
  const truthTable = buildArtificialTruthTableFromComputedColumns(columns, previousState, options)

  const selectedOutputIndex = clamp(
    options.outputVariableIndex ?? truthTable.outputVariableIndex,
    0,
    Math.max(truthTable.outputVars.length - 1, 0),
  )

  const normalizedTruthTable: TruthTableState = {
    ...truthTable,
    outputVariableIndex: selectedOutputIndex,
  }

  const possibleRows = collectPossibleRows(
    columns.binaryTransitions,
    columns.bitNumber,
    columns.inputBits,
  )

  const immutableCellMask = normalizedTruthTable.values.map((row, rowIndex) => {
    return row.map(() => !possibleRows.has(rowIndex))
  })

  return {
    truthTable: normalizedTruthTable,
    immutableCellMask,
  }
}

// Maps placeholder minimizer vars (a,b,c,...) to visible input var names.
function buildQmcVariableNameMap(inputVars: string[]): Record<string, string> {
  const map: Record<string, string> = {}

  inputVars.forEach((inputVar, index) => {
    const placeholder = String.fromCharCode(97 + index)
    map[placeholder] = inputVar
    map[placeholder.toUpperCase()] = inputVar
  })

  return map
}

// Recursively remaps variable names inside QMC expression trees.
function remapExpressionVariables(
  expression: unknown,
  variableMap: Record<string, string>,
): unknown {
  if (!expression || typeof expression !== 'object') {
    return expression
  }

  const source = expression as { name?: unknown; args?: unknown[] }
  const remappedArgs = Array.isArray(source.args)
    ? source.args.map((arg) => remapExpressionVariables(arg as unknown, variableMap))
    : source.args

  if (typeof source.name === 'string') {
    const mappedName = variableMap[source.name as string]
    if (!mappedName) {
      return {
        ...source,
        ...(Array.isArray(source.args) ? { args: remappedArgs } : {}),
      }
    }

    return {
      ...source,
      name: mappedName,
      ...(Array.isArray(source.args) ? { args: remappedArgs } : {}),
    }
  }

  if (Array.isArray(source.args)) return { ...source, args: remappedArgs }

  return { ...source }
}

// Validates and resolves one cell change target against values matrix bounds.
function resolveCellChangeTarget(
  values: TruthTableState['values'],
  change: KVDiagramCellChange,
): { rowIndex: number; outputIndex: number } | null {
  if (!Number.isInteger(change.rowIndex) || !Number.isInteger(change.outputIndex)) return null
  if (change.rowIndex < 0 || change.outputIndex < 0) return null

  const row = values[change.rowIndex]
  if (!row || change.outputIndex >= row.length) return null

  return {
    rowIndex: change.rowIndex,
    outputIndex: change.outputIndex,
  }
}

// Computes row indices that correspond to real transitions (non-artificial).
function collectPossibleRows(
  rows: TransitionTableComputedRow[],
  stateBits: number,
  inputBits: number,
): Set<number> {
  const possibleRows = new Set<number>()

  for (const row of rows) {
    const fromBits = normalizeBits(row.fromBinary, stateBits, '0', 'left')
    const inputBitsValue = normalizeBits(row.input, inputBits, '0', 'left')

    if (!/^[01]*$/.test(fromBits) || !/^[01]*$/.test(inputBitsValue)) {
      continue
    }

    const rowIndex = parseInt(`${fromBits}${inputBitsValue}`, 2)
    if (Number.isNaN(rowIndex) || rowIndex < 0) {
      continue
    }

    possibleRows.add(rowIndex)
  }

  return possibleRows
}

// Inclusive clamp helper.
function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
