import { Project } from '../Project'
import { computed, onMounted, watch } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type { AutomatonProps, AutomatonState, AutomatonType } from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

/*
 * interfaces
 */
interface RawFsmTransition {
  id?: string | number
  from?: string | number
  to?: string | number
  input?: string | unknown
  output?: string | unknown
  mealy_output?: string | unknown
  toPattern?: string | unknown
  label?: string | unknown
}

interface RawFsmState {
  id?: string | number | null
  name?: string | null
  initial?: boolean | null
  final?: boolean | null
  x?: string | number | null
  y?: string | number | null
}

interface RawFsmData {
  states?: unknown
  transitions?: unknown
  automatonType?: unknown
}

/*
 * export type definitions
 */
export type { AutomatonProps, AutomatonState } from './AutomatonTypes'

export type UpdateSource = 'automatoneditor' | 'table' | null

/*
 * automaton project class including export / import functions
 */
export class AutomatonProject extends Project {
  private static lastUpdateSource: UpdateSource = null
  private static updateFromEditor = false
  private static lastImportedFsmData: AutomatonState | null = null
  private static lastSentFsmData: AutomatonState | null = null
  private static listenerAttached = false

  private static areStatesEqual(
    left: AutomatonState['states'] | undefined,
    right: AutomatonState['states'] | undefined,
  ): boolean {
    const a = left || []
    const b = right || []
    if (a.length !== b.length) return false

    for (let index = 0; index < a.length; index++) {
      const stateA = a[index]
      const stateB = b[index]
      if (
        !stateA ||
        !stateB ||
        stateA.id !== stateB.id ||
        stateA.name !== stateB.name ||
        stateA.initial !== stateB.initial ||
        stateA.final !== stateB.final ||
        stateA.x !== stateB.x ||
        stateA.y !== stateB.y
      ) {
        return false
      }
    }

    return true
  }

  private static areTransitionsEqual(
    left: AutomatonState['transitions'] | undefined,
    right: AutomatonState['transitions'] | undefined,
  ): boolean {
    const a = left || []
    const b = right || []
    if (a.length !== b.length) return false

    for (let index = 0; index < a.length; index++) {
      const transitionA = a[index]
      const transitionB = b[index]
      if (
        !transitionA ||
        !transitionB ||
        transitionA.id !== transitionB.id ||
        transitionA.from !== transitionB.from ||
        transitionA.to !== transitionB.to ||
        transitionA.toPattern !== transitionB.toPattern ||
        transitionA.input !== transitionB.input ||
        transitionA.output !== transitionB.output
      ) {
        return false
      }
    }

    return true
  }

  private static isSameAutomatonState(
    left: AutomatonState | null | undefined,
    right: AutomatonState | null | undefined,
  ): boolean {
    if (!left || !right) return false

    return (
      left.automatonType === right.automatonType &&
      this.areStatesEqual(left.states, right.states) &&
      this.areTransitionsEqual(left.transitions, right.transitions)
    )
  }

  private static isTrustedMessage(event: MessageEvent): boolean {
    const iframe = this.getFsmIframe()
    return event.origin === window.location.origin && event.source === iframe?.contentWindow
  }

  private static getBitLength(
    currentState: AutomatonState,
    selector: (transition: AutomatonState['transitions'][number]) => unknown,
    previousState?: AutomatonState | null,
  ): number {
    const lengths = [
      ...(previousState?.transitions || []),
      ...(currentState.transitions || []),
    ].map((transition) => String(selector(transition) ?? '').length)

    return Math.max(...lengths, 1)
  }

  private static normalizeBits(
    value: string | undefined,
    length: number,
    direction: 'left' | 'right',
    fill: string,
  ): string {
    const normalized =
      direction === 'left'
        ? (value ?? '').padStart(length, fill)
        : (value ?? '').padEnd(length, fill)
    return direction === 'left' ? normalized.slice(-length) : normalized.slice(0, length)
  }

  private static normalizeState(
    currentState: AutomatonState,
    previousState?: AutomatonState | null,
  ): AutomatonState {
    const states = [...(currentState.states || [])]
      .filter((state) => state && typeof state.id === 'number' && !Number.isNaN(state.id))
      .sort((left, right) => left.id - right.id)

    const stateIds = new Set(states.map((state) => state.id))
    const maxIndex = Math.max(states.length - 1, 0)
    const bitNumber = Math.max(maxIndex.toString(2).length, 1)
    const inputBitLength = this.getBitLength(
      currentState,
      (transition) => transition.input,
      previousState,
    )
    const outputBitLength = this.getBitLength(
      currentState,
      (transition) => transition.output,
      previousState,
    )
    const defaultToPattern = 'x'.repeat(bitNumber)
    const defaultOutput = 'x'.repeat(outputBitLength)
    const transitionByKey = new Map<string, AutomatonState['transitions'][number]>()

    const registerTransition = (transition: AutomatonState['transitions'][number]) => {
      if (!stateIds.has(transition.from)) return

      const input = this.normalizeBits(transition.input, inputBitLength, 'left', '0')
      const output = this.normalizeBits(transition.output, outputBitLength, 'right', 'x')
      const hasConcreteTarget = stateIds.has(transition.to)
      const hasPattern = typeof transition.toPattern === 'string' && transition.toPattern.length > 0

      transitionByKey.set(`${transition.from}:${input}`, {
        id: transition.id,
        from: transition.from,
        to: hasConcreteTarget && !hasPattern ? transition.to : -1,
        toPattern: hasPattern
          ? transition.toPattern?.padStart(bitNumber, 'x')
          : hasConcreteTarget
            ? undefined
            : defaultToPattern,
        input,
        output,
      })
    }

    ;(previousState?.transitions || []).forEach(registerTransition)
    ;(currentState.transitions || []).forEach(registerTransition)

    let nextId =
      Math.max(
        -1,
        ...(previousState?.transitions || []).map((transition) => transition.id),
        ...(currentState.transitions || []).map((transition) => transition.id),
      ) + 1

    const normalizedTransitions: AutomatonState['transitions'] = []

    for (const state of states) {
      for (let inputIndex = 0; inputIndex < 1 << inputBitLength; inputIndex++) {
        const input = inputIndex.toString(2).padStart(inputBitLength, '0')
        const key = `${state.id}:${input}`
        const existingTransition = transitionByKey.get(key)

        if (existingTransition) {
          normalizedTransitions.push(existingTransition)
          continue
        }

        normalizedTransitions.push({
          id: nextId++,
          from: state.id,
          to: -1,
          toPattern: defaultToPattern,
          input,
          output: defaultOutput,
        })
      }
    }

    // Keep transition IDs unique
    const usedTransitionIds = new Set<number>()
    let nextUniqueId = Math.max(-1, ...normalizedTransitions.map((transition) => transition.id)) + 1

    const transitionsWithUniqueIds = normalizedTransitions.map((transition) => {
      const id = Number(transition.id)
      if (!Number.isInteger(id) || usedTransitionIds.has(id)) {
        while (usedTransitionIds.has(nextUniqueId)) {
          nextUniqueId += 1
        }

        const reassignedId = nextUniqueId
        usedTransitionIds.add(reassignedId)
        nextUniqueId += 1

        return {
          ...transition,
          id: reassignedId,
        }
      }

      usedTransitionIds.add(id)
      return transition
    })

    return {
      states,
      transitions: transitionsWithUniqueIds,
      automatonType: this.setAutomatonType(currentState.automatonType),
    }
  }

  static getLastUpdateSource(): UpdateSource {
    return this.lastUpdateSource
  }

  static setLastUpdateSource(source: UpdateSource) {
    this.lastUpdateSource = source
  }

  private static setAutomatonType(value: unknown): AutomatonType {
    return value === 'moore' || value === 'mealy' ? value : 'mealy'
  }

  private static parseRawTransition = (raw: unknown): AutomatonState['transitions'][number] => {
    const tr = raw as RawFsmTransition
    const hasLabel = typeof tr.label === 'string'
    const label = hasLabel ? String(tr.label ?? '') : ''
    const parts = label.split('/')
    const input = hasLabel ? parts[0] || '0' : String(tr.input ?? '0')
    const output = hasLabel ? parts[1] || '0' : String(tr.output ?? tr.mealy_output ?? '0')
    const toPattern = typeof tr.toPattern === 'string' ? tr.toPattern : undefined
    const to = tr.to == null || String(tr.to) === '' ? -1 : Number(tr.to)

    return {
      id: Number(tr.id ?? 0),
      from: Number(tr.from ?? 0),
      to: Number.isNaN(to) ? -1 : to,
      toPattern,
      input,
      output,
    }
  }

  private static parseRawState = (raw: unknown): AutomatonState['states'][number] => {
    const s = raw as RawFsmState
    const id = Number(s.id ?? 0)
    const x = typeof s.x === 'number' && Number.isFinite(s.x) ? s.x : undefined
    const y = typeof s.y === 'number' && Number.isFinite(s.y) ? s.y : undefined
    return {
      id,
      name: s.name ?? `q${id}`,
      initial: s.initial ?? false,
      final: s.final ?? false,
      x,
      y,
    }
  }

  static getFsmIframe(): HTMLIFrameElement | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__fsm_preloaded_iframe as HTMLIFrameElement | undefined
  }

  private static handleMessage(event: MessageEvent) {
    if (event.data?.action !== 'export' && event.data?.action !== 'editorToTableExport') return
    if (!this.isTrustedMessage(event)) return

    const raw = event.data.fsm as RawFsmData
    const states = Array.isArray(raw.states) ? raw.states.map((r) => this.parseRawState(r)) : []
    const transitions = Array.isArray(raw.transitions)
      ? raw.transitions.map((r) => this.parseRawTransition(r))
      : []
    const fsmData = this.normalizeState(
      {
        states,
        transitions,
        automatonType: this.setAutomatonType(raw.automatonType),
      },
      stateManager.state.automaton as AutomatonState | undefined,
    )

    if (this.isSameAutomatonState(this.lastImportedFsmData, fsmData)) {
      return
    }

    const wasTable = this.getLastUpdateSource() === 'table'
    this.updateFromEditor = true
    this.lastImportedFsmData = fsmData
    stateManager.state.automaton = fsmData
    this.updateFromEditor = false
    if (wasTable) this.setLastUpdateSource('table')
    else this.lastUpdateSource = null
  }

  private static handleMessageRef = (event: MessageEvent) => AutomatonProject.handleMessage(event)

  static attachFsmListener() {
    if (this.listenerAttached) return
    window.addEventListener('message', this.handleMessageRef)
    this.listenerAttached = true
  }

  static disposeFsmListener() {
    if (this.listenerAttached) {
      window.removeEventListener('message', this.handleMessageRef)
      this.listenerAttached = false
    }
  }

  static override get defaultProps(): AutomatonProps {
    return {
      name: '',
      automatonType: 'mealy',
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
          automatonType: 'mealy',
        },
    )

    const states = computed(() => automaton.value.states || [])
    const transitions = computed(() => automaton.value.transitions || [])
    const automatonType = computed(() => automaton.value.automatonType || 'mealy')

    // bitNumber (definiert vor binaryIDs)
    const bitNumber = computed(() => {
      const maxIndex = Math.max(states.value.length - 1, 0)
      return Math.max(maxIndex.toString(2).length, 1)
    })

    const stateIndexMap = computed(() => {
      const map = new Map<string | number, number>()
      states.value.forEach((state, index) => {
        map.set(state.id, index)
      })
      return map
    })

    const binaryIDs = computed(() => {
      return states.value.map((state) => {
        const idNum = Number(state.id)
        return Number.isNaN(idNum)
          ? '0'.padStart(bitNumber.value, '0')
          : idNum.toString(2).padStart(bitNumber.value, '0')
      })
    })

    const binaryTransitions = computed(() => {
      return transitions.value.map((tr) => {
        const fromIndex = stateIndexMap.value.get(tr.from) ?? 0
        const toIndex = stateIndexMap.value.get(tr.to) ?? 0
        const toBinary = tr.toPattern?.length
          ? tr.toPattern.padStart(bitNumber.value, 'x')
          : tr.to < 0
            ? 'x'.repeat(bitNumber.value)
            : binaryIDs.value[toIndex]

        return {
          ...tr,
          fromBinary: binaryIDs.value[fromIndex],
          toBinary,
        }
      })
    })

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

    let automatonDebounce: number | null = null

    watch(
      () => stateManager.state.automaton,
      (val) => {
        if (
          !val ||
          AutomatonProject.updateFromEditor ||
          AutomatonProject.getLastUpdateSource() === 'automatoneditor'
        ) {
          return
        }
        if (automatonDebounce !== null) {
          clearTimeout(automatonDebounce)
        }

        automatonDebounce = window.setTimeout(() => {
          const actualState = AutomatonProject.normalizeState({
            states: (val.states || []).map((s) => ({
              id: s.id,
              name: s.name,
              initial: s.initial,
              final: s.final,
              x: s.x,
              y: s.y,
            })),
            transitions: (val.transitions || []).map((t) => ({
              id: t.id,
              from: t.from,
              to: t.to,
              toPattern: t.toPattern,
              input: t.input,
              output: t.output,
            })),
            automatonType: AutomatonProject.setAutomatonType(val.automatonType),
          })

          if (
            AutomatonProject.isSameAutomatonState(AutomatonProject.lastSentFsmData, actualState)
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
            window.location.origin,
          )
        }, 50)
      },
      { deep: true },
    )

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
    console.log('[AutomatonProject.restoreDefaultPanelLayout] applying default layout')
    createPanel('state-table', 'State Table')
    createPanel('fsm-engine', 'FSM Engine', {
      referencePanel: 'state-table',
      direction: 'right',
    })
  }

  static override createState(props: AutomatonProps) {
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: props.automatonType,
    }
    console.log('[AutomatonProject.createState] State initialized')
  }

  static override validateState(state: AppState): boolean {
    return state.automaton != undefined
  }
}

registerProjectType('automaton', {
  name: 'State Machine', // TODO: not really used!
  propsComponent: AutomatonPropsComponent,
  projectClass: AutomatonProject,
})
