import type { AutomatonState } from '@/projects/automaton/AutomatonTypes'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import {
  defaultFunctionRepresentation,
  defaultFunctionType,
} from '@/utility/types'

export interface TransitionTableComputedRow
  extends Pick<AutomatonState['transitions'][number], 'id' | 'input' | 'output'> {
  id: number
  fromBinary: string
  toBinary: string
}

export interface TransitionColumnsTruthTableOptions {
  inputPrefix?: string
  statePrefix?: string
  nextStatePrefix?: string
  outputPrefix?: string
  stateBits?: number
  inputBits?: number
  outputBits?: number
}

/**
 * Shape of the computed values produced by AutomatonProject.useState(),
 * reduced to the fields needed for truth-table generation.
 */
export interface TransitionTableComputedColumns {
  binaryTransitions: TransitionTableComputedRow[]
  bitNumber: number
  inputBits: number
  outputBits: number
}

/**
 * Builds an artificial TruthTableState directly from the computed transition
 * table columns (Z^n, X^n, Z^(n+1), Y^n).
 */
export function buildArtificialTruthTableFromComputedColumns(
  columns: TransitionTableComputedColumns,
  previousState?: TruthTableState,
  options: TransitionColumnsTruthTableOptions = {},
): TruthTableState {
  return buildArtificialTruthTableFromTransitionColumns(columns.binaryTransitions, previousState, {
    ...options,
    stateBits: options.stateBits ?? columns.bitNumber,
    inputBits: options.inputBits ?? columns.inputBits,
    outputBits: options.outputBits ?? columns.outputBits,
  })
}

/**
 * Fallback/low-level builder in case only transition rows are available.
 */
export function buildArtificialTruthTableFromTransitionColumns(
  rows: TransitionTableComputedRow[],
  previousState?: TruthTableState,
  options: TransitionColumnsTruthTableOptions = {},
): TruthTableState {
  const stateBits = Math.max(options.stateBits ?? inferStateBits(rows), 0)
  const inputBits = Math.max(options.inputBits ?? inferInputBits(rows), 0)
  const outputBits = Math.max(options.outputBits ?? inferOutputBits(rows), 0)

  const inputPrefix = options.inputPrefix ?? 'X'
  const statePrefix = options.statePrefix ?? 'Z'
  const nextStatePrefix = options.nextStatePrefix ?? 'Z'
  const outputPrefix = options.outputPrefix ?? 'Y'

  const inputVars = [
    ...buildTransitionTableNames(statePrefix, stateBits, 'n'),
    ...buildTransitionTableNames(inputPrefix, inputBits, 'n'),
  ]
  const outputVars = [
    ...buildTransitionTableNames(nextStatePrefix, stateBits, '(n+1)'),
    ...buildTransitionTableNames(outputPrefix, outputBits, 'n'),
  ]

  const rowCount = 1 << (stateBits + inputBits)
  const values: TruthTableState['values'] = Array.from({ length: rowCount }, () =>
    Array.from({ length: outputVars.length }, () => '-'),
  )

  for (const row of rows) {
    const fromBits = normalizeToLength(row.fromBinary, stateBits, '0', 'left')
    const input = normalizeToLength(row.input, inputBits, 'x', 'right')
    if (!/^[01]*$/.test(fromBits) || !/^[01]*$/.test(input)) continue

    const rowIndex = parseInt(`${fromBits}${input}`, 2)
    if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= rowCount) continue

    const toBits = normalizeToLength(row.toBinary, stateBits, 'x', 'left')
    const output = normalizeToLength(row.output, outputBits, 'x', 'right')

    const nextStateCells = toBits.split('').map(toTruthTableCell)
    const outputCells = output.split('').map(toTruthTableCell)
    values[rowIndex] = [...nextStateCells, ...outputCells]
  }

  const selectedOutputIndex = clamp(
    previousState?.outputVariableIndex ?? 0,
    0,
    Math.max(outputVars.length - 1, 0),
  )

  return {
    inputVars,
    outputVars,
    values,
    formulas: {},
    outputVariableIndex: selectedOutputIndex,
    functionType: previousState?.functionType ?? defaultFunctionType,
    functionRepresentation:
      previousState?.functionRepresentation ?? defaultFunctionRepresentation,
    qmcResult: previousState?.qmcResult,
    couplingTermLatex: previousState?.couplingTermLatex,
    selectedFormula: previousState?.selectedFormula,
    formulaTermColors: previousState?.formulaTermColors,
  }
}

function inferOutputBits(rows: TransitionTableComputedRow[]): number {
  let bits = 0
  for (const row of rows) {
    bits = Math.max(bits, String(row.output ?? '').length)
  }
  return bits
}

function inferStateBits(rows: TransitionTableComputedRow[]): number {
  let bits = 0
  for (const row of rows) {
    bits = Math.max(bits, String(row.fromBinary ?? '').length, String(row.toBinary ?? '').length)
  }
  return bits
}

function inferInputBits(rows: TransitionTableComputedRow[]): number {
  let bits = 0
  for (const row of rows) {
    bits = Math.max(bits, String(row.input ?? '').length)
  }
  return bits
}

function normalizeToLength(
  value: string | undefined,
  length: number,
  fill: '0' | 'x',
  align: 'left' | 'right',
): string {
  if (length <= 0) return ''

  const normalized = String(value ?? '')
  if (align === 'left') {
    return normalized.padStart(length, fill).slice(-length)
  }
  return normalized.padEnd(length, fill).slice(0, length)
}

function buildTransitionTableNames(prefix: string, bits: number, suffix: string): string[] {
  return Array.from({ length: bits }, (_, index) => `${prefix}_${bits - 1 - index}^${suffix}`)
}

function toTruthTableCell(bit: string): TruthTableState['values'][number][number] {
  if (bit === '0') return 0
  if (bit === '1') return 1
  return '-'
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
