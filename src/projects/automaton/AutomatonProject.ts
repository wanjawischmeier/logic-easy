import { Project } from '../Project'
import { computed, onMounted, watch } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState, AutomatonType } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

// flag for edit dominance
export type UpdateSource = 'automatoneditor' | 'table' | null
export let lastUpdateSource: UpdateSource = null
export function getLastUpdateSource(): UpdateSource {
  return lastUpdateSource
}
export function setLastUpdateSource(source: UpdateSource) {
  lastUpdateSource = source
}


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

// set fixed automaton type
function setAutomatonType(value: unknown): AutomatonType {
  return value === 'moore' ? 'moore' : 'mealy'
}

interface RawFsmData {
  states?: unknown
  transitions?: unknown
  automatonType?: unknown
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
    output: parts[1] || '0',
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

/*
 * export fsm <-> table variables and functions
 */
export type { AutomatonProps, AutomatonState } from './AutomatonTypes'
let updateFromEditor = false
// prevention flags: no double one-way export without exchange
let lastImportedFsmData: AutomatonState | null = null
let lastSentFsmData: AutomatonState | null = null

// message listener + handler for export fsm editor <-> state table
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
      automatonType: setAutomatonType(raw.automatonType),
    }

    if (lastImportedFsmData && JSON.stringify(lastImportedFsmData) === JSON.stringify(fsmData)) {
      return
    }
    lastImportedFsmData = fsmData

    lastUpdateSource = 'automatoneditor'

    updateFromEditor = true
    stateManager.state.automaton = fsmData
    updateFromEditor = false
    lastUpdateSource = null
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

// helper function to get iframe
function getFsmIframe(): HTMLIFrameElement | undefined {
  return (window as unknown as Window & { __fsm_preloaded_iframe?: HTMLIFrameElement })
    .__fsm_preloaded_iframe
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

    let fsmiFrameReady = false
    function markFsmiFrameReady() {
      fsmiFrameReady = true
    }

    window.addEventListener('__fsm_preloaded_iframe-ready', () => {
      markFsmiFrameReady()
    })

    // debouncing
    let automatonDebounce: number | null = null

    watch(
      () => stateManager.state.automaton,
      (val) => {
        console.log('watch in automatonproject activated')
        if (!val || updateFromEditor || !fsmiFrameReady || lastUpdateSource !== 'table') return

        if (automatonDebounce !== null) {
          clearTimeout(automatonDebounce)
        }

        automatonDebounce = window.setTimeout(() => {
          const actualState: AutomatonState = {
            states: (val.states || []).map((s) => ({
              id: s.id,
              name: s.name,
              initial: s.initial,
              final: s.final,
            })),
            transitions: (val.transitions || []).map((t) => ({
              id: t.id,
              from: t.from,
              to: t.to,
              input: t.input,
              output: t.output,
            })),
            automatonType: setAutomatonType(val.automatonType),
          }

          if (lastSentFsmData && JSON.stringify(lastSentFsmData) === JSON.stringify(actualState)) {
            return
          }
          lastSentFsmData = actualState

          const fsmIframe = getFsmIframe()
          if (!fsmIframe || !fsmIframe.contentWindow) return

          fsmIframe.contentWindow.postMessage(
            {
              action: 'automatonimport',
              fsm: actualState,
            },
            '*',
          )
        }, 50)
      },
      { deep: true },
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
