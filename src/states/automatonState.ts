import { stateManager} from "./stateManager"
import { computed } from "vue"

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

// reactivity
export const automatonState = computed(() => stateManager.state.automaton || { states: [], transitions: [] })

// export function from state manager
export function useAutomatonState() {
  const states = computed(() => automatonState.value.states)
  const transitions = computed(() => automatonState.value.transitions)

  return { states, transitions }
}
