import type { BaseProjectProps } from '../Project'

// define automaton type
export type AutomatonType = 'mealy' | 'moore'

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
  }>
  transitions: Array<{
    id: number
    from: number
    to: number
    input: string
    output: string
  }>
  automatonType: AutomatonType
}
