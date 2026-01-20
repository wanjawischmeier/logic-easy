import { Project } from '../Project'
import { computed, onMounted, watch} from 'vue'
import { stateManager } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState, AutomatonType } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

/*
 ** interfaces
 */
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
  automatonType?: unknown
}

/*
 ** export type definitions
 */
export type { AutomatonProps, AutomatonState } from './AutomatonTypes'

// flag: which component is editing at the moment
export type UpdateSource = 'automatoneditor' | 'table' | null

/*
 ** class including all export functions and variables
 */
export class AutomatonProject extends Project {
  // static attributes / flags
  private static lastUpdateSource: UpdateSource = null
  private static updateFromEditor = false
  private static lastImportedFsmData: AutomatonState | null = null
  private static lastSentFsmData: AutomatonState | null = null
  private static listenerAttached = false
  private static fsmiFrameReady = false

  // getter / setter for other components
  static getLastUpdateSource(): UpdateSource {
    return this.lastUpdateSource
  }

  static setLastUpdateSource(source: UpdateSource) {
    this.lastUpdateSource = source
  }

  private static setAutomatonType(value: unknown): AutomatonType {
    return value === 'moore' ? 'moore' : ''
  }

  // import parser -> save data in predefined types, independent from fsm engine
  private static parseRawTransition = (raw: unknown): AutomatonState['transitions'][number] => {
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

  private static parseRawState = (raw: unknown): AutomatonState['states'][number] => {
    const s = raw as RawFsmState
    const id = Number(s.id ?? 0)
    return {
      id,
      name: s.name ?? `q${id}`,
      initial: s.initial ?? false,
      final: s.final ?? false,
    }
  }

  // iframe access
  static getFsmIframe(): HTMLIFrameElement | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__fsm_preloaded_iframe as HTMLIFrameElement | undefined
  }

  // event listener setup for export / import fsm-engine<->state
  private static handleMessage(event: MessageEvent) {
    if (event.data?.action === 'export') {
      const raw = event.data.fsm as RawFsmData
      const states = Array.isArray(raw.states) ? raw.states.map((r) => this.parseRawState(r)) : []
      const transitions = Array.isArray(raw.transitions) ? raw.transitions.map((r) => this.parseRawTransition(r)) : []
      const fsmData: AutomatonState = {
        states,
        transitions,
        automatonType: this.setAutomatonType(raw.automatonType),
      }

      if (
        this.lastImportedFsmData &&
        JSON.stringify(this.lastImportedFsmData) === JSON.stringify(fsmData)
      ) {
        return
      }

      this.lastImportedFsmData = fsmData
      this.lastUpdateSource = 'automatoneditor'
      this.updateFromEditor = true
      stateManager.state.automaton = fsmData
      this.updateFromEditor = false
      this.lastUpdateSource = null
    }
  }

  private static handleMessageRef = (event: MessageEvent) => AutomatonProject.handleMessage(event)

  static attachFsmListener() {
    if (this.listenerAttached) return
    window.addEventListener('message', this.handleMessageRef)
    window.addEventListener('__fsm_preloaded_iframe-ready', () => {
      this.fsmiFrameReady = true
    })
    this.listenerAttached = true
  }

  static disposeFsmListener() {
    if (this.listenerAttached) {
      window.removeEventListener('message', this.handleMessageRef)
      window.removeEventListener('__fsm_preloaded_iframe-ready', () => {
        this.fsmiFrameReady = true
      })
      this.listenerAttached = false
    }
  }

  // vue API functions
  static override get defaultProps(): AutomatonProps {
    return {
      name: '',
      automatonType: '',
    }
  }

  static override useState() {
    onMounted(() => {
      AutomatonProject.attachFsmListener()
    })

    const automaton = computed(
      () =>
        stateManager.state.automaton || {
          states: [],
          transitions: [],
          automatonType: '',
        },
    )

    // amount of bits for binary state coding
    const bitNumber = computed(() => {
      return Math.max(states.value.length.toString(2).length, 1)
    })

    let automatonDebounce: number | null = null

    watch(
      () => stateManager.state.automaton,
      (val) => {
        console.log('watch in automatonproject activated')
        if (
          !val ||
          AutomatonProject.updateFromEditor ||
          !AutomatonProject.fsmiFrameReady ||
          AutomatonProject.getLastUpdateSource() !== 'table'
        ) {
          return
        }
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
            automatonType: AutomatonProject.setAutomatonType(val.automatonType),
          }

          if (
            AutomatonProject.lastSentFsmData &&
            JSON.stringify(AutomatonProject.lastSentFsmData) === JSON.stringify(actualState)
          ) {
            return
          }
          AutomatonProject.lastSentFsmData = actualState
          const fsmIframe = AutomatonProject.getFsmIframe()
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

    // basic attributes
    const states = computed(() => automaton.value.states || [])
    const transitions = computed(() => automaton.value.transitions || [])
    const automatonType = computed(() => automaton.value.automatonType || '')

    // state index map for quick lookup
    const stateIndexMap = computed(() => {
      const map = new Map<string | number, number>()
      states.value.forEach((state, index) => {
        map.set(state.id, index)
      })
      return map
    })

    // binary ids of states
    const binaryIDs = computed(() => {
      return states.value.map((state) => {
        const idNum = Number(state.id)
        return Number.isNaN(idNum)
          ? '0'.padStart(bitNumber.value, '0')
          : idNum.toString(2).padStart(bitNumber.value, '0')
      })
    })

    // binary ids of states in transitions
    const binaryTransitions = computed(() => {
      return transitions.value.map((tr) => {
        const fromIndex = stateIndexMap.value.get(tr.from) ?? 0
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
    // TODO: create default panel -> not really important since choosing is necessary to init project
    // create FSM editor panel as default
    console.log('[AutomatonProject.restoreDefaultPanelLayout] applying default layout')
    createPanel('fsm-engine', 'FSM Engine', undefined, {
      automatonType: props.automatonType,
    })
  }

  static override createState(props: AutomatonProps) {
    // Initialize empty automaton state
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: props.automatonType,
    }
    console.log('[AutomatonProject.createState] State initialized')
  }
}

registerProjectType('automaton', {
  name: 'State Machine', // TODO: not really used!
  propsComponent: AutomatonPropsComponent,
  projectClass: AutomatonProject,
})
