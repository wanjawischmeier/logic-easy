/*
* Types and interfaces needed for the automaton project / state
*/

import type { BaseProjectProps } from '../Project'

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
