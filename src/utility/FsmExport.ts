import { ref, onMounted, onBeforeUnmount } from 'vue'

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

// element placeholder for data from fsm editor
export const fsmData = ref<FsmExport | null>(null)

// listener for export fsm -> statetable
export function fsmListener() {
  const fsmListenerHandler = (event: MessageEvent) => {
    if (event.data?.action === 'export') {
      fsmData.value = event.data.fsm as FsmExport
      console.log('fsmlistener works')
    }
  }

  onMounted(() => {
    window.addEventListener('message', fsmListenerHandler)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('message', fsmListenerHandler)
  })
}
