import { Project } from '../Project'
import { computed, onMounted } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

export type { AutomatonProps, AutomatonState } from './AutomatonTypes'

// reactive postmessage listener
const fsmHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {
    const fsmData: AutomatonState = {
      states: event.data.fsm.states || [],
      transitions: event.data.fsm.transitions || [],
      automatonType: event.data.fsm.automatonType,
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

export class AutomatonProject extends Project {
  static override get defaultProps(): AutomatonProps {
    return {
      name: '',
      automatonType: 'mealy',
    }
  }

  static override useState() {
    onMounted(ensureFsmListener)

    const state = computed(() => stateManager.state.automaton)
    const automaton = computed(
      () => stateManager.state.automaton || { states: [], transitions: [], automatonType: 'mealy' },
    )

    const bitNumber = computed(() => {
      const n = automaton.value.states.length
      return n === 0 ? 1 : Math.ceil(Math.log2(Math.max(n, 1)))
    })

    const states = computed(() => automaton.value.states)
    const transitions = computed(() => automaton.value.transitions)
    const binaryIDs = computed(() =>
      states.value.map((state) => Number(state.id).toString(2).padStart(bitNumber.value, '0')),
    )

    const automatonType = computed(() => automaton.value.automatonType)

    return {
      state,
      automaton,
      states,
      transitions,
      bitNumber,
      binaryIDs,
      automatonType,
    }
  }

  static override restoreDefaultPanelLayout(props: AutomatonProps) {
    // TODO: Implement default panel layout for automaton

    // create FSM editor panel as default
    console.log('[AutomatonProject.restoreDefaultPanelLayout] applying default layout')

    createPanel('fsm-engine', 'FSM Engine', undefined, {
      automatonType: props.automatonType,
    })
  }

  static override createState(props: AutomatonProps) {
    console.log('[AutomatonProject.createState] Initializing project state')

    // Initialize empty automaton state
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: props.automatonType,
    }

    console.log('[AutomatonProject.createState] State initialized')
  }
}

export { disposeFsmListener }

registerProjectType('automaton', {
  name: 'State Machine',
  propsComponent: AutomatonPropsComponent,
  projectClass: AutomatonProject,
})
