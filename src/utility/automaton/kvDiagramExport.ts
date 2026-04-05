import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type { AutomatonState } from '@/projects/automaton/AutomatonTypes'
import { Minimizer, type QMCResult } from '@/utility/truthtable/minimizer'
import { flattenCouplingTermsToFormula } from '@/utility/truthtable/expressionParser'
import { getCouplingTermLatex } from '@/utility/truthtable/latexGenerator'
import { mapFormulaTermsToPIColors, type TermColor } from '@/utility/truthtable/colorGenerator'
import type { Formula } from '@/utility/types'
import {
  buildArtificialTruthTableFromComputedColumns,
  type TransitionColumnsTruthTableOptions,
  type TransitionTableComputedColumns,
  type TransitionTableComputedRow,
} from '@/utility/automaton/transitionTableArtificialTruthTable'

export interface KVDiagramExportOptions extends TransitionColumnsTruthTableOptions {
  outputVariableIndex?: number
}

export interface KVDiagramExportData {
  truthTable: TruthTableState
  latexInputVars: string[]
  latexOutputVars: string[]
  immutableCellMask: boolean[][]
  impossibleRowMask: boolean[]
}

export interface BinaryTransitionLike {
  id?: number
  input?: string
  output?: string
  fromBinary?: string
  toBinary?: string
}

export interface AutomatonKVFeatureFlagInput {
  panelId?: string
  hasAutomatonState: boolean
  enabled?: boolean
}

export interface AutomatonKVModeInput {
  panelId?: string
  panelParams?: Record<string, unknown>
  hasAutomatonState: boolean
  hasUsableTruthTableData: boolean
  isAutomatonProject: boolean
}

export interface AutomatonKVMode {
  shouldForceAutomatonMode: boolean
  isAutomatonTransitionKV: boolean
  exportToTable: boolean
}

export interface KVDiagramBinding {
  inputVars: TruthTableState['inputVars']
  outputVars: TruthTableState['outputVars']
  values: TruthTableState['values']
  outputVariableIndex: TruthTableState['outputVariableIndex']
  functionType: TruthTableState['functionType']
  functionRepresentation: TruthTableState['functionRepresentation']
  selectedFormula: TruthTableState['selectedFormula']
  qmcResult: TruthTableState['qmcResult']
  formulaTermColors: TruthTableState['formulaTermColors']
  couplingTermLatex: TruthTableState['couplingTermLatex']
  immutableCellMask?: boolean[][]
}

export interface KVDiagramCellChange {
  rowIndex: number
  outputIndex: number
  value: TruthTableState['values'][number][number]
}

export interface KVDiagramBaseTruthTableInput {
  inputVars: TruthTableState['inputVars']
  outputVars: TruthTableState['outputVars']
  values: TruthTableState['values']
  outputVariableIndex: TruthTableState['outputVariableIndex']
  functionType: TruthTableState['functionType']
  functionRepresentation: TruthTableState['functionRepresentation']
  selectedFormula: TruthTableState['selectedFormula']
  qmcResult: TruthTableState['qmcResult']
  couplingTermLatex: TruthTableState['couplingTermLatex']
  formulaTermColors: TruthTableState['formulaTermColors']
}

export interface AutomatonDerivedFormulaBundle {
  qmcResult?: QMCResult
  selectedFormula?: Formula
  formulaTermColors?: TermColor[]
  couplingTermLatex?: string
}

export function isAutomatonKVFeatureEnabled(input: AutomatonKVFeatureFlagInput): boolean {
  if (!input.hasAutomatonState) return false
  if (input.enabled === true) return true
  if (input.enabled === false) return false

  const panelId = input.panelId ?? ''
  const isAutomatonPanel =
    panelId === 'transition-table' ||
    panelId === 'state-machine' ||
    panelId.startsWith('transition-table') ||
    panelId.startsWith('state-machine')

  return isAutomatonPanel
}

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

export function resolveShouldForceAutomatonMode(input: {
  hasAutomatonState: boolean
  hasUsableTruthTableData: boolean
}): boolean {
  return input.hasAutomatonState && !input.hasUsableTruthTableData
}

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

export function resolveUseAutomatonBinding(input: {
  hasTransitionTableExport: boolean
  isAutomatonTransitionKV: boolean
  shouldForceAutomatonMode: boolean
}): boolean {
  if (!input.hasTransitionTableExport) return false
  if (input.isAutomatonTransitionKV) return true
  return input.shouldForceAutomatonMode
}

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
  } catch {
    formulaTermColors = undefined
  }

  return {
    qmcResult: remappedResult,
    selectedFormula,
    formulaTermColors,
    couplingTermLatex,
  }
}

function buildQmcVariableNameMap(inputVars: string[]): Record<string, string> {
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
  if (!expression || typeof expression !== 'object') {
    return expression
  }

  const source = expression as { name?: unknown; args?: unknown[] }

  const hasName = typeof source.name === 'string'
  if (hasName) {
    const mappedName = variableMap[source.name as string]
    if (!mappedName) return { ...source }
    return {
      ...source,
      name: mappedName,
    }
  }

  if (Array.isArray(source.args)) {
    return {
      ...source,
      args: source.args.map((arg) =>
        remapExpressionVariables(arg as unknown, variableMap),
      ),
    }
  }

  return { ...source }
}

export function resolveEffectiveKVInputVarCount(state: {
  truthTable?: { inputVars?: string[] }
  automaton?: {
    states?: Array<{ id: number }>
    transitions?: Array<{ input?: string }>
  }
}): number {
  const truthTableInputVars = state.truthTable?.inputVars?.length
  if (truthTableInputVars !== undefined) return truthTableInputVars

  const automaton = state.automaton
  if (!automaton) return 0

  const stateCount = automaton.states?.length ?? 0
  const stateBits = stateCount <= 1 ? 0 : Math.ceil(Math.log2(stateCount))
  const inputBits = Math.max(
    0,
    ...(automaton.transitions ?? []).map((transition) => String(transition.input ?? '').length),
  )

  return stateBits + inputBits
}

export function isKVInputVarCountSupported(count: number): boolean {
  return count >= 2 && count <= 4
}

export function applyCellChangeToValues(
  values: TruthTableState['values'],
  change: KVDiagramCellChange,
): TruthTableState['values'] | null {
  if (!Number.isInteger(change.rowIndex) || !Number.isInteger(change.outputIndex)) return null
  if (change.rowIndex < 0 || change.outputIndex < 0) return null

  const row = values[change.rowIndex]
  if (!row || change.outputIndex >= row.length) return null

  const nextValues = values.map((existingRow) => [...existingRow])
  nextValues[change.rowIndex]![change.outputIndex] = change.value
  return nextValues
}

export function cloneTruthTableValues(
  values: TruthTableState['values'],
): TruthTableState['values'] {
  return values.map((row) => [...row])
}

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

export function applyCellChangeToTruthTable(
  truthTable: TruthTableState | undefined,
  change: KVDiagramCellChange,
): boolean {
  if (!truthTable) return false
  if (!Number.isInteger(change.rowIndex) || !Number.isInteger(change.outputIndex)) return false
  if (change.rowIndex < 0 || change.outputIndex < 0) return false

  const row = truthTable.values[change.rowIndex]
  if (!row || change.outputIndex >= row.length) return false

  row[change.outputIndex] = change.value
  return true
}

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
    if (Number.isNaN(fromStateIndex) || fromStateIndex < 0 || fromStateIndex >= sortedStates.length) {
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

type AutomatonOutputDescriptor =
  | { kind: 'next-state'; bitIndex: number }
  | { kind: 'output'; bitIndex: number }
  | null

function parseAutomatonOutputDescriptor(
  variableName: string,
  stateBitWidth: number,
  outputBitWidth: number,
): AutomatonOutputDescriptor {
  const nextStateMatch = /^([A-Za-z])_(\d+)\^\(n\+1\)$/i.exec(variableName)
  if (nextStateMatch) {
    const displayIndex = parseInt(nextStateMatch[2] ?? '', 10)
    if (Number.isNaN(displayIndex)) return null
    return {
      kind: 'next-state',
      bitIndex: Math.max(0, stateBitWidth - 1 - displayIndex),
    }
  }

  const outputMatch = /^([A-Za-z])_(\d+)\^n$/i.exec(variableName)
  if (outputMatch) {
    const displayIndex = parseInt(outputMatch[2] ?? '', 10)
    if (Number.isNaN(displayIndex)) return null
    return {
      kind: 'output',
      bitIndex: Math.max(0, outputBitWidth - 1 - displayIndex),
    }
  }

  return null
}

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

function resolveTransitionTarget(
  nextStateBits: string,
  states: AutomatonState['states'],
): Pick<AutomatonState['transitions'][number], 'to' | 'toPattern'> {
  if (!/^[01]+$/.test(nextStateBits)) {
    return {
      to: -1,
      toPattern: nextStateBits,
    }
  }

  const stateIndex = parseInt(nextStateBits, 2)
  const state = states[stateIndex]
  if (!state) {
    return {
      to: -1,
      toPattern: nextStateBits,
    }
  }

  return {
    to: state.id,
    toPattern: undefined,
  }
}

function setBit(value: string, bitIndex: number, bit: '0' | '1' | 'x'): string {
  if (bitIndex < 0 || bitIndex >= value.length) return value
  const chars = value.split('')
  chars[bitIndex] = bit
  return chars.join('')
}

function normalizeBits(value: string, length: number, fill: '0' | '1' | 'x'): string {
  return String(value ?? '').padStart(length, fill).slice(-length)
}

function toBitChar(value: TruthTableState['values'][number][number] | undefined): '0' | '1' | 'x' {
  if (value === 0) return '0'
  if (value === 1) return '1'
  return 'x'
}

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

function resolveStateBitCount(
  rows: TransitionTableComputedRow[],
  fallbackBits: number,
  stateCount?: number,
): number {
  if (stateCount === 0) {
    return 0
  }

  const concreteFromStates = new Set<number>()

  for (const row of rows) {
    const normalized = normalizeBinaryBits(row.fromBinary)
    if (!normalized) continue

    const stateIndex = parseInt(normalized, 2)
    if (Number.isNaN(stateIndex)) continue
    concreteFromStates.add(stateIndex)
  }

  if (concreteFromStates.size === 0) {
    return Math.max(fallbackBits, 0)
  }

  if (concreteFromStates.size === 1) {
    return 0
  }

  return Math.max(Math.ceil(Math.log2(concreteFromStates.size)), 1)
}

function resolveInputBitCount(
  rows: TransitionTableComputedRow[],
  fallbackBits: number,
  stateCount?: number,
): number {
  if (stateCount === 0 && rows.length === 0) {
    return 0
  }

  return Math.max(fallbackBits, 0)
}

function normalizeBinaryBits(value: string | undefined): string {
  const normalized = String(value ?? '').trim()
  if (!/^[01]+$/.test(normalized)) return ''
  return normalized
}

export function buildKVDiagramBinding(
  baseTruthTable: TruthTableState,
  automatonExport: KVDiagramExportData | null,
  useAutomatonBinding: boolean,
): KVDiagramBinding {
  if (!useAutomatonBinding || !automatonExport) {
    return {
      inputVars: baseTruthTable.inputVars,
      outputVars: baseTruthTable.outputVars,
      values: baseTruthTable.values,
      outputVariableIndex: baseTruthTable.outputVariableIndex,
      functionType: baseTruthTable.functionType,
      functionRepresentation: baseTruthTable.functionRepresentation,
      selectedFormula: baseTruthTable.selectedFormula,
      qmcResult: baseTruthTable.qmcResult,
      formulaTermColors: baseTruthTable.formulaTermColors,
      couplingTermLatex: baseTruthTable.couplingTermLatex,
    }
  }

  return {
    inputVars: automatonExport.truthTable.inputVars,
    outputVars: automatonExport.truthTable.outputVars,
    values: automatonExport.truthTable.values,
    outputVariableIndex: automatonExport.truthTable.outputVariableIndex,
    functionType: automatonExport.truthTable.functionType,
    functionRepresentation: automatonExport.truthTable.functionRepresentation,
    selectedFormula: automatonExport.truthTable.selectedFormula,
    qmcResult: automatonExport.truthTable.qmcResult,
    formulaTermColors: automatonExport.truthTable.formulaTermColors,
    couplingTermLatex: automatonExport.truthTable.couplingTermLatex,
    immutableCellMask: automatonExport.immutableCellMask,
  }
}

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
  const impossibleRowMask = Array.from(
    { length: normalizedTruthTable.values.length },
    (_, rowIndex) => {
      return !possibleRows.has(rowIndex)
    },
  )

  const immutableCellMask = normalizedTruthTable.values.map((row, rowIndex) => {
    if (!impossibleRowMask[rowIndex]) {
      return row.map(() => false)
    }

    return row.map(() => true)
  })

  return {
    truthTable: normalizedTruthTable,
    latexInputVars: normalizedTruthTable.inputVars.map(toLatexVariableName),
    latexOutputVars: normalizedTruthTable.outputVars.map(toLatexVariableName),
    immutableCellMask,
    impossibleRowMask,
  }
}

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

function normalizeBitString(value: string | undefined, length: number): string {
  const normalized = String(value ?? '')
  if (length <= 0) return ''
  return normalized.padStart(length, '0').slice(-length)
}

function isBinaryBits(value: string): boolean {
  return /^[01]*$/.test(value)
}

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

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
