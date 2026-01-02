import { Project } from '../Project'
import { computed, onMounted } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

interface RawFsmTransition {
  id?: string | number
  from?: string | number
  to?: string | number
  label?: string | unknown
}

const parseRawTransition = (raw: unknown): AutomatonState['transitions'][number] => {
  const tr = raw as RawFsmTransition
  const label = String(tr.label ?? '')
  const parts = label.split('/')
  return {
    id: Number(tr.id ?? 0),
    from: Number(tr.from ?? 0),
    to: Number(tr.to ?? 0),
    input: parts[0] || '0',
    output: parts[1] || '-',
  }
}



export type { AutomatonProps, AutomatonState } from './AutomatonTypes'

// message listener + handler
const listenerHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {
    const fsmData: AutomatonState = {
      states: event.data.fsm.states || [],
      transitions: (event.data.fsm.transitions || []).map(parseRawTransition),
      automatonType: event.data.fsm.automatonType,
    }
    stateManager.state.automaton = fsmData
  }
}


let listenerAttached = false

function ensureFsmListener() {
  if (!listenerAttached) {
    window.addEventListener('message', listenerHandler)
    listenerAttached = true
    console.log('FSM listener attached')
  }
}

function disposeFsmListener() {
  if (listenerAttached) {
    window.removeEventListener('message', listenerHandler)
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

    const automaton = computed(
      () => stateManager.state.automaton || { states: [], transitions: [], automatonType: 'mealy' },
    )

    //basic attributes
    const states = computed(() => automaton.value.states || [])
    const transitions = computed(() => automaton.value.transitions || [])
    const automatonType = computed(() => automaton.value.automatonType || 'mealy')

    // amount of bits for binary state coding
    const bitNumber = computed(() => {
      const n = states.value.length
      return n === 0 ? 1 : Math.ceil(Math.log2(Math.max(n, 1)))
    })

    // binary ids of states
    const binaryIDs = computed(() => {
      return states.value.map((state) => {
        const idNum = Number(state.id)
        return isNaN(idNum)
          ? '0'.padStart(bitNumber.value, '0')
          : idNum.toString(2).padStart(bitNumber.value, '0')
      })
    })

    // state index map for quick lookup
    const stateIndexMap = computed(() => {
      const map = new Map<string | number, number>()
      states.value.forEach((state, index) => {
        map.set(state.id, index)
      })
      return map
    })

    // unique inputs aus transitions
    const inputSymbols = computed(() => {
      const symbols = new Set(transitions.value.map(tr => tr.input).filter(Boolean))
      return symbols.size === 0 ? ['0'] : Array.from(symbols).sort()
    })

    const inputBits = computed(() => {
      const first = inputSymbols.value[0]
      return first ? first.length : 1
    })

    const outputBits = computed(() => {
      const lengths = transitions.value.map(tr => (tr.output || '').length)
      return Math.max(...lengths, 1)
    })

    return {
      state: automaton,
      automaton,
      states,
      transitions,
      bitNumber,
      binaryIDs,
      automatonType,
      stateIndexMap,
      inputSymbols,
      inputBits,
      outputBits
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

export { disposeFsmListener, ensureFsmListener }

registerProjectType('automaton', {
  name: 'State Machine', // TODO: not really used!
  propsComponent: AutomatonPropsComponent,
  projectClass: AutomatonProject,
})
