import type { BaseProjectProps } from "../Project";

// Default values for AutomatonProps
export interface AutomatonProps extends BaseProjectProps {
    // Add any automaton-specific props here
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
        label: string
    }>
}
