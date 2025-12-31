import { Project, type BaseProjectProps } from "../Project";
import { computed, onMounted } from "vue";
import { stateManager, type AppState } from "@/states/stateManager";
import { registerProject } from "../projectRegistry";

// Default values for AutomatonProps
export interface AutomatonProps extends BaseProjectProps {
    // Add any automaton-specific props here
}

export const defaultAutomatonProps: AutomatonProps = {
    name: '',
};

// export interface for data in fsm editor (same scheme as in stores / export)
export interface AutomatonState {
    states: Array<{
        id: string | number
        name: string
        initial: boolean | null
        final: boolean | null
    }>
    transitions: Array<{
        id: string | number
        from: string | number
        label: string
    }>
}

// reactive postmessage listener
const fsmHandler = (event: MessageEvent) => {
    if (event.data?.action === 'export') {
        const fsmData: AutomatonState = {
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

ensureFsmListener()

export class AutomatonProject extends Project {
    static override useState() {
        onMounted(ensureFsmListener)

        const state = computed(() => stateManager.state.automaton)
        const automaton = computed(() =>
            stateManager.state.automaton || { states: [], transitions: [] }
        )

        const bitNumber = computed(() => {
            const n = automaton.value.states.length
            return n === 0 ? 1 : Math.ceil(Math.log2(Math.max(n, 1)))
        })

        const states = computed(() => automaton.value.states)
        const transitions = computed(() => automaton.value.transitions)
        const binaryIDs = computed(() =>
            states.value.map((state) =>
                Number(state.id).toString(2).padStart(bitNumber.value, '0')
            )
        )

        return {
            state,
            automaton,
            states,
            transitions,
            bitNumber,
            binaryIDs
        }
    }

    static override restoreDefaultPanelLayout(props: AutomatonProps) {
        // TODO: Implement default panel layout for automaton
        // This would typically create FSM editor panel
        console.warn('[AutomatonProject.restoreDefaultPanelLayout] Not yet implemented')
    }

    static override createState(appState: AppState, props: AutomatonProps) {
        console.log('[AutomatonProject.createState] Initializing project state')

        // Initialize empty automaton state
        appState.automaton = {
            states: [],
            transitions: [],
        }

        console.log('[AutomatonProject.createState] State initialized')
    }
}

export { disposeFsmListener }
/*
registerProject('truth-table', {
  propsComponent: null,
  projectClass: AutomatonProject
});
*/