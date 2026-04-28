// DELETED in newer version, currently part of FSM Panel or Automaton Project

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

// reactive postmessage listener
const fsmHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {
    const fsmData: FsmState = {
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
