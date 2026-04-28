import { onMounted, onBeforeUnmount } from 'vue'
import { stateManager } from '@/projects/stateManager'
import type { FsmState } from '@/projects/state-machine/FsmTypes'

// listener for export fsm -> statetable
export function useFsmListener() {
  const handler = (event: MessageEvent) => {
    if (event.data?.action === 'export') {
      console.log('raw data:', event.data.fsm)

      const fsmData: FsmState = {
        states: event.data.fsm.states || [],
        transitions: event.data.fsm.transitions || [],
      }
      console.log('fsmlistener works. fsmData:', fsmData)
      stateManager.state.automaton = fsmData
    }
  }

  onMounted(() => {
    window.addEventListener('message', handler)
    console.log('fsm event listener mounted')
  })
  onBeforeUnmount(() => {
    window.removeEventListener('message', handler)
  })
}
