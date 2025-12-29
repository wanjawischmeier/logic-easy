import { onMounted, onBeforeUnmount } from 'vue'
import { stateManager } from '@/states/stateManager'
import { type AutomatonState } from '@/states/automatonState'

// listener for export fsm -> statetable
export function useFsmListener() {
  const handler = (event: MessageEvent) => {
    if (event.data?.action === 'export') {
      console.log('raw data:', event.data.fsm)

      const fsmData: AutomatonState = {
        states: event.data.fsm.states || [],
        transitions: event.data.fsm.transitions || []
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
