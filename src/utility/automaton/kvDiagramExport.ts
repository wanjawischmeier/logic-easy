import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type {
  AutomatonDerivedFormulaBundle,
  AutomatonKVFeatureFlagInput,
  AutomatonKVMode,
  AutomatonKVModeInput,
  AutomatonState,
  BinaryTransitionLike,
  KVDiagramBaseTruthTableInput,
  KVDiagramBinding,
  KVDiagramCellChange,
  KVDiagramExportData,
  KVDiagramExportOptions,
} from '@/projects/automaton/AutomatonTypes'
import { Minimizer, type QMCResult } from '@/utility/truthtable/minimizer'
import { flattenCouplingTermsToFormula } from '@/utility/truthtable/expressionParser'
import { getCouplingTermLatex } from '@/utility/truthtable/latexGenerator'
import { mapFormulaTermsToPIColors, type TermColor } from '@/utility/truthtable/colorGenerator'
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
  KVDiagramBaseTruthTableInput,
  KVDiagramBinding,
  KVDiagramCellChange,
  KVDiagramExportData,
  KVDiagramExportOptions,
} from '@/projects/automaton/AutomatonTypes'

// Checks if automaton-specific KV behavior should be enabled.
function isAutomatonKVFeatureEnabled(input: AutomatonKVFeatureFlagInput): boolean {
  if (!input.hasAutomatonState) return false
  if (input.enabled === true) return true
  if (input.enabled === false) return false

  const panelId = input.panelId ?? ''
  const isAutomatonPanel =
    panelId === 'state-table' ||
    panelId === 'fsm-engine' ||
    panelId.startsWith('state-table') ||
    panelId.startsWith('fsm-engine') ||
    // old panel ids kept for backward compatibility
    panelId === 'transition-table' ||
    panelId === 'state-machine' ||
    panelId.startsWith('transition-table') ||
    panelId.startsWith('state-machine')

  return isAutomatonPanel
}

// True if truth-table data is present and usable.
export function hasUsableTruthTableData(state: {
  inputVars?: string[]
  outputVars?: string[]
  values?: TruthTableState['values']
}): boolean {
  return (
    (state.inputVars?.length ?? 0) > 0 &&
    (state.outputVars?.length ?? 0) > 0 &&
    (state.values?.length ?? 0) > 0
  )
}

// Forces automaton mode when no usable truth-table data exists.
function resolveShouldForceAutomatonMode(input: {
  hasAutomatonState: boolean
  hasUsableTruthTableData: boolean
}): boolean {
  return input.hasAutomatonState && !input.hasUsableTruthTableData
}

// Builds the final mode flags for automaton KV behavior.
export function resolveAutomatonKVMode(input: AutomatonKVModeInput): AutomatonKVMode {
  const shouldForceAutomatonMode = resolveShouldForceAutomatonMode({
    hasAutomatonState: input.hasAutomatonState,
    hasUsableTruthTableData: input.hasUsableTruthTableData,
  })

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

// Decides whether KV should read/write via automaton data.
export function resolveUseAutomatonBinding(input: {
  hasTransitionTableExport: boolean
  isAutomatonTransitionKV: boolean
  shouldForceAutomatonMode: boolean
}): boolean {
  return (
    input.hasTransitionTableExport &&
    (input.isAutomatonTransitionKV || input.shouldForceAutomatonMode)
  )
}

// Creates a clean truth-table state object from current panel inputs.
export function buildBaseTruthTableState(input: KVDiagramBaseTruthTableInput): TruthTableState {
  return {
    inputVars: input.inputVars,
    outputVars: input.outputVars,
    values: input.values,
    formulas: {},
    outputVariableIndex: input.outputVariableIndex,
    functionType: input.functionType,
    functionRepresentation: input.functionRepresentation,
    selectedFormula: input.selectedFormula,
    qmcResult: input.qmcResult,
    couplingTermLatex: input.couplingTermLatex,
    formulaTermColors: input.formulaTermColors,
  }
}

// Runs minimization and prepares formulas for automaton KV mode.
export async function deriveAutomatonFormulaBundle(
  truthTable: TruthTableState,
): Promise<AutomatonDerivedFormulaBundle> {
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
    formulaTermColors = undefined
  }

  return {
    qmcResult: remappedResult,
    selectedFormula,
    formulaTermColors,
    couplingTermLatex,
  }
}

// Returns a copied values matrix with one changed cell.
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

// Copies the 2D truth-table values array.
export function cloneTruthTableValues(
  values: TruthTableState['values'],
): TruthTableState['values'] {
  return values.map((row) => [...row])
}

// Builds a patched truth-table state for writing changes back to the automaton.
export function buildPatchedAutomatonTruthTable(input: {
  truthTable: TruthTableState
  values: TruthTableState['values']
  outputVariableIndex: TruthTableState['outputVariableIndex']
  functionType: TruthTableState['functionType']
  functionRepresentation: TruthTableState['functionRepresentation']
}): TruthTableState {
  return {
    ...input.truthTable,
    values: cloneTruthTableValues(input.values),
    outputVariableIndex: input.outputVariableIndex,
    functionType: input.functionType,
    functionRepresentation: input.functionRepresentation,
  }
}

// Applies one cell change directly to an existing truth-table state.
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

// Writes edited KV output values back into automaton transitions.
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

// Describes how one KV output column maps to automaton data.
type AutomatonOutputDescriptor =
  | { kind: 'next-state'; bitIndex: number }
  | { kind: 'output'; bitIndex: number }
  | null

// Parses names like Z_0^(n+1) or Y_0^n into mapping descriptors.
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

// Builds next-state bits from concrete target or wildcard pattern.
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

// Converts next-state bits back into transition target fields.
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

// Replaces one bit in a string when the index is valid.
function setBit(value: string, bitIndex: number, bit: '0' | '1' | 'x'): string {
  if (bitIndex < 0 || bitIndex >= value.length) return value
  const chars = value.split('')
  chars[bitIndex] = bit
  return chars.join('')
}

// Normalizes a bit string to a fixed width (left padded).
function normalizeBits(value: string, length: number, fill: '0' | '1' | 'x'): string {
  return String(value).padStart(length, fill).slice(-length)
}

// Converts truth-table cell values to bit characters.
function toBitChar(value: TruthTableState['values'][number][number] | undefined): '0' | '1' | 'x' {
  if (value === 0) return '0'
  if (value === 1) return '1'
  return 'x'
}

// Builds computed transition columns from raw binary rows.
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
    inputBits: resolveInputBitCount(binaryTransitions, dimensions.inputBits, dimensions.stateCount),
    outputBits: Math.max(dimensions.outputBits, 0),
  }
}

// Determines how many state bits are needed.
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

// Determines input bit count and handles empty automata.
function resolveInputBitCount(
  rows: TransitionTableComputedRow[],
  fallbackBits: number,
  stateCount?: number,
): number {
  return stateCount === 0 && rows.length === 0 ? 0 : Math.max(fallbackBits, 0)
}

// Returns a cleaned binary string, or empty if invalid.
function normalizeBinaryBits(value: string | undefined): string {
  const normalized = String(value ?? '').trim()
  if (!/^[01]+$/.test(normalized)) return ''
  return normalized
}

// Converts truth-table fields into the binding shape consumed by KV components.
function createKVDiagramBindingFromTruthTable(truthTable: TruthTableState): KVDiagramBinding {
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
  }
}

// Builds the final KV data binding (truth-table or automaton export).
export function buildKVDiagramBinding(
  baseTruthTable: TruthTableState,
  automatonExport: KVDiagramExportData | null,
  useAutomatonBinding: boolean,
): KVDiagramBinding {
  if (!useAutomatonBinding || !automatonExport) {
    return createKVDiagramBindingFromTruthTable(baseTruthTable)
  }

  return {
    ...createKVDiagramBindingFromTruthTable(automatonExport.truthTable),
    immutableCellMask: automatonExport.immutableCellMask,
  }
}

// Converts transition columns into truth-table data for KV and QMC.
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
    latexInputVars: normalizedTruthTable.inputVars.map(toLatexVariableName),
    latexOutputVars: normalizedTruthTable.outputVars.map(toLatexVariableName),
    immutableCellMask,
  }
}

// Maps placeholder variable names from QMC to visible input variable names.
function buildQmcVariableNameMap(inputVars: string[]): Record<string, string> {
  const map: Record<string, string> = {}

  inputVars.forEach((inputVar, index) => {
    const placeholder = String.fromCharCode(97 + index)
    map[placeholder] = inputVar
    map[placeholder.toUpperCase()] = inputVar
  })

  return map
}

// Recursively replaces variable names inside a QMC expression tree.
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

// Validates and resolves a single cell change against a values matrix.
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

// Collects row indices that are actually represented by transitions.
function collectPossibleRows(
  rows: TransitionTableComputedRow[],
  stateBits: number,
  inputBits: number,
): Set<number> {
  const possibleRows = new Set<number>()

  for (const row of rows) {
    const fromBits = normalizeBitString(row.fromBinary, stateBits)
    const inputBitsValue = normalizeBitString(row.input, inputBits)

    if (!isBinaryBits(fromBits) || !isBinaryBits(inputBitsValue)) {
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

// Normalizes a bit string to a fixed width for row index calculation.
function normalizeBitString(value: string | undefined, length: number): string {
  const normalized = String(value ?? '')
  if (length <= 0) return ''
  return normalized.padStart(length, '0').slice(-length)
}

// True when a string contains only 0/1 bits.
function isBinaryBits(value: string): boolean {
  return /^[01]*$/.test(value)
}

// Converts internal variable names to LaTeX names.
function toLatexVariableName(variableName: string): string {
  const nextStateMatch = /^([A-Za-z])_(\d+)\^\(n\+1\)$/i.exec(variableName)
  if (nextStateMatch) {
    const symbol = nextStateMatch[1]!.toUpperCase()
    const index = nextStateMatch[2]!
    return `${symbol}_{${index}}^{(n+1)}`
  }

  const currentStateMatch = /^([A-Za-z])_(\d+)\^n$/i.exec(variableName)
  if (currentStateMatch) {
    const symbol = currentStateMatch[1]!.toUpperCase()
    const index = currentStateMatch[2]!
    return `${symbol}_{${index}}^{n}`
  }

  return variableName
}

// Clamps a number to an inclusive min/max range.
function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
