import { computed, onMounted } from 'vue'
import { stateManager } from './stateManager'

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

// reactive postmessage listener
const fsmHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {

    const fsmData: AutomatonState = {
      states: event.data.fsm.states || [],
      transitions: event.data.fsm.transitions || [],
    }
    stateManager.state.automaton = { ...fsmData }
  }
}

let listenerAttached = false

function ensureFsmListener() {
  if (!listenerAttached) {
    window.addEventListener('message', fsmHandler)
    listenerAttached = true
    console.log('FSM listener attached')
  }
}

function disposeFsmListener() {
  if (listenerAttached) {
    window.removeEventListener('message', fsmHandler)
    listenerAttached = false
    console.log('FSM listener disposed')
  }
}

ensureFsmListener()

export const automatonState = computed(() =>
  stateManager.state.automaton || { states: [], transitions: [] }
)

export function useAutomatonState() {

  onMounted(ensureFsmListener)

  const bitNumber = computed(() => {
    const n = automatonState.value.states.length
    return n === 0 ? 1 : Math.ceil(Math.log2(Math.max(n, 1)))
  })

  const states = computed(() => automatonState.value.states)
  const transitions = computed(() => automatonState.value.transitions)
  const binaryIDs = computed(() =>
    states.value.map((state) =>
      Number(state.id).toString(2).padStart(bitNumber.value, '0')
    )
  )

    return {
    automaton: automatonState,
    states,
    transitions,
    bitNumber,
    binaryIDs
  }
}

export { disposeFsmListener }
