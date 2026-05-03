/*
 * Types and interfaces needed for the automaton project / state
 */

import type { BaseProjectProps } from '../Project';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type { QMCResult } from '@/utility/truthtable/minimizer'
import type { TermColor } from '@/utility/truthtable/colorGenerator'
import type { Formula } from '@/utility/types'

// define automaton type
export type AutomatonType = 'mealy' | 'moore' | ''

// Default values for AutomatonProps
export interface AutomatonProps extends BaseProjectProps {
  automatonType: AutomatonType
}

// export interface for data in fsm editor (same scheme as in stores / export)
export interface AutomatonState {
  states: Array<{
    id: number
    name: string
    initial: boolean
    final: boolean
    x?: number
    y?: number
  }>
  transitions: Array<{
    id: number
    from: number
    to: number
    toPattern?: string
    input: string
    output: string
  }>
  automatonType: AutomatonType
}

// Update source for editor/table sync handling
export type UpdateSource = 'automatoneditor' | 'table' | null

// Raw payload shape received from fsm editor messages
export interface RawFsmTransition {
  id?: string | number
  from?: string | number
  to?: string | number
  input?: string | unknown
  output?: string | unknown
  mealy_output?: string | unknown
  toPattern?: string | unknown
  label?: string | unknown
}

export interface RawFsmState {
  id?: string | number | null
  name?: string | null
  initial?: boolean | null
  final?: boolean | null
  x?: string | number | null
  y?: string | number | null
}

export interface RawFsmData {
  states?: unknown
  transitions?: unknown
  automatonType?: unknown
}

// extra options when exporting automaton data to kv diagram format
export interface KVDiagramExportOptions {
  inputPrefix?: string
  statePrefix?: string
  nextStatePrefix?: string
  outputPrefix?: string
  stateBits?: number
  inputBits?: number
  outputBits?: number
  outputVariableIndex?: number
}

// full export payload used by kv panel in automaton mode
export interface KVDiagramExportData {
  truthTable: TruthTableState
  immutableCellMask: boolean[][]
}

// minimal transition row shape used for computed transition columns
export interface BinaryTransitionLike {
  id?: number
  input?: string
  output?: string
  fromBinary?: string
  toBinary?: string
}

// input model for enabling automaton kv behavior
export interface AutomatonKVFeatureFlagInput {
  panelId?: string
  hasAutomatonState: boolean
  enabled?: boolean
}

// input model for deriving automaton kv mode
export interface AutomatonKVModeInput {
  panelId?: string
  panelParams?: Record<string, unknown>
  hasAutomatonState: boolean
  hasUsableTruthTableData: boolean
  isAutomatonProject: boolean
}

// resolved automaton kv mode flags
export interface AutomatonKVMode {
  shouldForceAutomatonMode: boolean
  isAutomatonTransitionKV: boolean
  exportToTable: boolean
}

// unified binding object consumed by kv diagram component
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

// one edit event emitted from kv diagram cell interaction
export interface KVDiagramCellChange {
  rowIndex: number
  outputIndex: number
  value: TruthTableState['values'][number][number]
}

// minimization outputs derived for automaton kv mode
export interface AutomatonDerivedFormulaBundle {
  qmcResult?: QMCResult
  selectedFormula?: Formula
  formulaTermColors?: TermColor[]
  couplingTermLatex?: string
}
