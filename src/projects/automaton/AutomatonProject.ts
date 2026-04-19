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
  private static readonly EDITOR_SYNC_DEBOUNCE_MS = 20
  private static readonly PERF_LOG_ENABLED = false

  // flags to control table<->editor sync
  private static lastUpdateSource: UpdateSource = null
  private static updateFromEditor = false
  private static lastImportedFsmData: AutomatonState | null = null
  private static lastSentFsmData: AutomatonState | null = null
  private static listenerAttached = false
  private static stateToEditorWatcherAttached = false
  private static stateToEditorDebounce: number | null = null

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
    if (a.length !== b.length) return false

    for (let index = 0; index < a.length; index++) {
      const parameterA = a[index]
      const parameterB = b[index]
      if (!parameterA || !parameterB) return false
      if (
        parameterA.id !== parameterB.id ||
        parameterA.name !== parameterB.name ||
        parameterA.initial !== parameterB.initial ||
        parameterA.final !== parameterB.final ||
        parameterA.x !== parameterB.x ||
        parameterA.y !== parameterB.y
      ) {
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
    if (a.length !== b.length) return false

    for (let index = 0; index < a.length; index++) {
      const parameterA = a[index]
      const parameterB = b[index]
      if (!parameterA || !parameterB) return false
      if (
        parameterA.id !== parameterB.id ||
        parameterA.from !== parameterB.from ||
        parameterA.to !== parameterB.to ||
        String(parameterA.toPattern ?? '') !== String(parameterB.toPattern ?? '') ||
        String(parameterA.input ?? '') !== String(parameterB.input ?? '') ||
        String(parameterA.output ?? '') !== String(parameterB.output ?? '')
      ) {
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
      .filter((state) => state && Number.isInteger(state.id))
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

  private static cloneAutomatonStateForSync(state: AutomatonState): AutomatonState {
    /*
     * creates a plain serializable automaton snapshot used for normalization and iframe sync.
     */
    return {
      states: (state.states || []).map((s) => ({
        id: s.id,
        name: s.name,
        initial: s.initial,
        final: s.final,
        x: s.x,
        y: s.y,
      })),
      transitions: (state.transitions || []).map((t) => ({
        id: t.id,
        from: t.from,
        to: t.to,
        toPattern: t.toPattern,
        input: t.input,
        output: t.output,
      })),
      automatonType: this.setAutomatonType(state.automatonType),
    }
  }

  private static logPerf(label: string, startTime: number) {
    /*
     * logs sync timings when performance debugging is enabled.
     */
    if (!this.PERF_LOG_ENABLED) return
    const durationMs = performance.now() - startTime
    console.debug(`[AutomatonSync] ${label}: ${durationMs.toFixed(2)}ms`)
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
    const xNumber = s.x === '' || s.x === null || s.x === undefined ? Number.NaN : Number(s.x)
    const yNumber = s.y === '' || s.y === null || s.y === undefined ? Number.NaN : Number(s.y)
    const x = Number.isFinite(xNumber) ? xNumber : undefined
    const y = Number.isFinite(yNumber) ? yNumber : undefined
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

    const parseStart = performance.now()
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
    this.logPerf('editor->table parse+normalize', parseStart)

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

  private static ensureStateToEditorWatcher() {
    /*
     * attaches the automaton->iframe sync watcher once, regardless of how often useState() is called.
     */
    if (this.stateToEditorWatcherAttached) return

    watch(
      () => stateManager.state.automaton,
      (val) => {
        if (!val || this.updateFromEditor || this.getLastUpdateSource() === 'automatoneditor') {
          return
        }

        if (this.stateToEditorDebounce !== null) {
          clearTimeout(this.stateToEditorDebounce)
        }

        this.stateToEditorDebounce = window.setTimeout(() => {
          this.stateToEditorDebounce = null

          const normalizeStart = performance.now()
          const actualState = this.normalizeState(this.cloneAutomatonStateForSync(val))
          this.logPerf('table->editor normalize', normalizeStart)

          if (this.isSameAutomatonState(this.lastSentFsmData, actualState)) {
            return
          }

          this.lastSentFsmData = actualState
          const fsmIframe = this.getFsmIframe()
          if (!fsmIframe || !fsmIframe.contentWindow) return

          const postMessageStart = performance.now()
          fsmIframe.contentWindow.postMessage(
            {
              action: 'automatonimport',
              fsm: actualState,
            },
            window.location.origin,
          )
          this.logPerf('table->editor postMessage', postMessageStart)
        }, this.EDITOR_SYNC_DEBOUNCE_MS)
      },
      { deep: true },
    )

    this.stateToEditorWatcherAttached = true
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
      AutomatonProject.ensureStateToEditorWatcher()
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
