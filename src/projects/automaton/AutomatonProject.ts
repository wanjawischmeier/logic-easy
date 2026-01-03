import { Project } from '../Project'
import { computed, onMounted } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

// types to avoid "any" type and validate types
interface RawFsmTransition {
  id?: string | number
  from?: string | number
  to?: string | number
  label?: string | unknown
}

interface RawFsmState {
  id?: string | number | null
  name?: string | null
  initial?: boolean | null
  final?: boolean | null
}

interface RawFsmData {
  states?: unknown
  transitions?: unknown
  automatonType?: AutomatonState['automatonType']
}

// according to interfaces above: parsing to really use correct types in this module (depending less on fsm engine)
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

const parseRawState = (raw: unknown): AutomatonState['states'][number] => {
  const s = raw as RawFsmState

  const id = Number(s.id ?? 0)

  return {
    id,
    name: s.name ?? `q${id}`,
    initial: s.initial ?? false,
    final: s.final ?? false,
  }
}

export type { AutomatonProps, AutomatonState } from './AutomatonTypes'

// message listener + handler
const listenerHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {
    const raw = event.data.fsm as RawFsmData

    const states = Array.isArray(raw.states) ? raw.states.map(parseRawState) : []

    const transitions = Array.isArray(raw.transitions)
      ? raw.transitions.map(parseRawTransition)
      : []

    const fsmData: AutomatonState = {
      states,
      transitions,
      automatonType: raw.automatonType ?? 'mealy',
    }

    stateManager.state.automaton = fsmData
  }
}

let listenerAttached = false

function ensureFsmListener() {
  if (!listenerAttached) {
    window.addEventListener('message', listenerHandler)
    listenerAttached = true
  }
}

function disposeFsmListener() {
  if (listenerAttached) {
    window.removeEventListener('message', listenerHandler)
    listenerAttached = false
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
    
    // binary ids of states in transitions
    const binaryTransitions = computed(() => {
      return transitions.value.map((tr) => {
        const fromIndex = stateIndexMap.value.get(tr.from) ?? 0 // same coding
        const toIndex = stateIndexMap.value.get(tr.to) ?? 0

        return {
          ...tr,
          fromBinary: binaryIDs.value[fromIndex],
          toBinary: binaryIDs.value[toIndex],
        }
      })
    })

    // unique inputs from transitions
    const inputSymbols = computed(() => {
      const symbols = new Set(transitions.value.map((tr) => tr.input).filter(Boolean))
      return symbols.size === 0 ? ['0'] : Array.from(symbols).sort()
    })

    const inputBits = computed(() => {
      const first = inputSymbols.value[0]
      return first ? first.length : 1
    })

    const outputBits = computed(() => {
      const lengths = transitions.value.map((tr) => (tr.output || '').length)
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
      outputBits,
      binaryTransitions,
    }
  }

  static override restoreDefaultPanelLayout(props: AutomatonProps) {
    // TODO: create default panel, probably to chose between table & editor

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
