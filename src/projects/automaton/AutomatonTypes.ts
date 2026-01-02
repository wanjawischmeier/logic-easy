import type { BaseProjectProps } from "../Project";

// define automaton type
export type AutomatonType = 'mealy' | 'moore';

// Default values for AutomatonProps
export interface AutomatonProps extends BaseProjectProps {
    automatonType : AutomatonType;
}

// export interface for data in fsm editor (same scheme as in stores / export)
export interface AutomatonState {
    states: Array<{
        id: string | number
        name: string
        initial: boolean | null
        final: boolean | null
    }>
    transitions: Array<{
        id: string | number
        from: string | number
        to: string | number
        input: string
        output: string
    }>
    automatonType: AutomatonType;
}

