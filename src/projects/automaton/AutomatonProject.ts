/*
 * functionality for the automaton project, including sync with fsm engine
 */

import { Project } from '../Project'
import { computed, onMounted, watch } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import AutomatonPropsComponent from './AutomatonPropsComponent.vue'
import type {
  AutomatonProps,
  AutomatonState,
  AutomatonType,
  RawFsmData,
  RawFsmState,
  RawFsmTransition,
  UpdateSource,
} from './AutomatonTypes'
import { createPanel } from '@/utility/dockview/integration'

export type { AutomatonProps, AutomatonState, UpdateSource } from './AutomatonTypes'

/*
 * automaton project class including export / import / sync utility functions
 */
export class AutomatonProject extends Project {
  // flags to control table<->editor sync
  private static lastUpdateSource: UpdateSource = null
  private static updateFromEditor = false
  private static lastImportedFsmData: AutomatonState | null = null
  private static lastSentFsmData: AutomatonState | null = null
  private static listenerAttached = false

  static getLastUpdateSource(): UpdateSource {
    /*
     * returns the source where the latest automaton update has been triggered from.
     */
    return this.lastUpdateSource
  }

  static setLastUpdateSource(source: UpdateSource) {
    /*
     * sets the source for the latest automaton update to coordinate editor/table sync.
     */
    this.lastUpdateSource = source
  }

  private static setAutomatonType(value: unknown): AutomatonType {
    /*
     * converts any automaton type values to supported automaton types.
     */
    return value === 'moore' || value === 'mealy' ? value : 'mealy'
  }

  private static areStatesEqual(
    stateA: AutomatonState['states'] | undefined,
    stateB: AutomatonState['states'] | undefined,
  ): boolean {
    /*
     * checks whether two state nodes are equal.
     * returns true if all parameters of the state nodes as defined in type AutomatonState['states'] are equal.
     */
    const a = stateA || []
    const b = stateB || []
    if (a.length !== b.length || !a || !b) return false

    for (let index = 0; index < a.length; index++) {
      const parameterA = a[index]
      const parameterB = b[index]
      if (parameterA != parameterB) {
        return false
      }
    }

    return true
  }

  private static areTransitionsEqual(
    firstTransition: AutomatonState['transitions'] | undefined,
    secondTransition: AutomatonState['transitions'] | undefined,
  ): boolean {
    /*
     * checks whether two transitions are equal.
     * returns true if all parameters of the transitions as defined in type AutomatonState['states'] are equal.
     */
    const a = firstTransition || []
    const b = secondTransition || []
    if (a.length !== b.length || !a || !b) return false

    for (let index = 0; index < a.length; index++) {
      const parameterA = a[index]
      const parameterB = b[index]
      if (parameterA != parameterB) {
        return false
      }
    }

    return true
  }

  private static isSameAutomatonState(
    firstAutomatonState: AutomatonState | null | undefined,
    secondAutomatonState: AutomatonState | null | undefined,
  ): boolean {
    /*
     * checks whether two AutomatonStates are equal.
     * returns true if all parameters of the AAutomatonStates as defined in type AutomatonState['states'] are equal.
     */
    if (!firstAutomatonState || !secondAutomatonState) return false

    return (
      firstAutomatonState.automatonType === secondAutomatonState.automatonType &&
      this.areStatesEqual(firstAutomatonState.states, secondAutomatonState.states) &&
      this.areTransitionsEqual(firstAutomatonState.transitions, secondAutomatonState.transitions)
    )
  }

  private static isTrustedMessage(event: MessageEvent): boolean {
    /*
     * checks whether a MessageEvent is from the correct source to ignore other events.
     */
    const iframe = this.getFsmIframe()
    return event.origin === window.location.origin && event.source === iframe?.contentWindow
  }

  private static getBitLength(
    currentState: AutomatonState,
    selector: (transition: AutomatonState['transitions'][number]) => unknown,
    previousState?: AutomatonState | null,
  ): number {
    /*
     * computes amount of bits of transition input or output bits in comparison to a newly updated Automaton State.
     */
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
    /*
     * sets structure of different output / input bit data to the same base scheme.
     */
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
    /*
     * normalizes new or updated states to keep the same scheme and data structure.
     * returns the correctly updated AutomatonState.
     */
    const states = [...(currentState.states || [])]
      .filter((state) => state && typeof state.id === 'number' && !Number.isNaN(state.id))
      .sort((left, right) => left.id - right.id)

    // updates all values correctly
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
    const transitionByKey = new Map<string, AutomatonState['transitions'][number]>()

    const registerTransition = (transition: AutomatonState['transitions'][number]) => {
      if (!stateIds.has(transition.from)) return

      const input = this.normalizeBits(transition.input, inputBitLength, 'left', '0')
      const output = this.normalizeBits(transition.output, outputBitLength, 'right', 'x')
      const hasConcreteTarget = stateIds.has(transition.to)
      const hasPattern = typeof transition.toPattern === 'string' && transition.toPattern.length > 0

      // set correct transitions
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

    // normalize transitions
    const normalizedTransitions: AutomatonState['transitions'] = Array.from(
      transitionByKey.values(),
    ).sort((left, right) => {
      if (left.from !== right.from) return left.from - right.from
      return left.input.localeCompare(right.input)
    })

    // keep transition IDs unique
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

  private static parseRawTransition = (raw: unknown): AutomatonState['transitions'][number] => {
    /*
     * parses a raw transition payload from the fsm editor into internal transition data shape.
     */
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
    /*
     * parses a raw state payload from the fsm editor into internal state data shape.
     */
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
    /*
     * returns the preloaded fsm iframe instance from the global window object.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__fsm_preloaded_iframe as HTMLIFrameElement | undefined
  }

  private static handleMessage(event: MessageEvent) {
    /*
     * handles incoming postMessage events from the fsm editor and syncs editor data to table state.
     */
    if (event.data?.action !== 'export' && event.data?.action !== 'editorToTableExport') return
    if (!this.isTrustedMessage(event)) return
    if (!stateManager.state.automaton) return

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

  /*
   * stores a stable listener reference so add/removeEventListener use the same callback identity.
   */
  private static handleMessageRef = (event: MessageEvent) => AutomatonProject.handleMessage(event)

  static attachFsmListener() {
    /*
     * attaches the global message listener once to receive fsm editor exports.
     */
    if (this.listenerAttached) return
    window.addEventListener('message', this.handleMessageRef)
    this.listenerAttached = true
  }

  static disposeFsmListener() {
    /*
     * removes the global message listener when automaton project listener is active.
     */
    if (this.listenerAttached) {
      window.removeEventListener('message', this.handleMessageRef)
      this.listenerAttached = false
    }
  }

  static override get defaultProps(): AutomatonProps {
    /*
     * returns default project props for newly created automaton projects.
     */
    return {
      name: '',
      automatonType: 'mealy',
    }
  }

  static override useState() {
    /*
     * exposes reactive automaton state and synchronizes table/editor updates in both directions.
     */
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
    /*
     * restores default panel layout for the automaton project and applies initial panel props.
     */
    console.log('[AutomatonProject.restoreDefaultPanelLayout] applying default layout')
    createPanel('fsm-engine', 'FSM Engine', undefined, {
      automatonType: props.automatonType,
    })
  }

  static override createState(props: AutomatonProps) {
    /*
     * initializes an empty automaton state in global state manager for the project.
     */
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: props.automatonType,
    }
    console.log('[AutomatonProject.createState] State initialized')
  }

  static override validateState(state: AppState): boolean {
    /*
     * validates whether automaton state data exists in the current app state.
     */
    return state.automaton != undefined
  }
}

/*
 * registers automaton project type in the central project registry.
 */
registerProjectType('automaton', {
  name: 'Automaton',
  propsComponent: AutomatonPropsComponent,
  projectClass: AutomatonProject,
})
