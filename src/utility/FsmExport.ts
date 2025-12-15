import { onMounted, onBeforeUnmount, reactive } from 'vue'

// export interface for data in fsm editor (same scheme as in stores / export)
export interface FsmExport {
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

// data from fsm engine as reactive export object
export const fsmData = reactive<FsmExport>({
  states: [],
  transitions: [],
})

// listener for export fsm -> statetable
export function useFsmListener() {
  const handler = (event: MessageEvent) => {
    if (event.data?.action === 'export') {
console.log('raw data:', event.data.fsm)

    fsmData.states = event.data.fsm.states || []
    fsmData.transitions = event.data.fsm.transitions || []

    console.log('fsmData:', fsmData)
    console.log('amount of states:', fsmData.states.length)
      console.log('fsmlistener works')
    }
  }

  onMounted(() => {
    window.addEventListener('message', handler)
    console.log('fsm event listener added')
  })
  onBeforeUnmount(() => {
    window.removeEventListener('message', handler)
  })
}
