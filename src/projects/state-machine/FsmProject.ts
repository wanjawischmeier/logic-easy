import { Project } from '../Project'
import { computed } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import FsmPropsComponent from './FsmPropsComponent.vue'
import type { FsmProps } from './FsmTypes'
import { calcBinaryID, calcBitNumber } from '@/utility/fsm/bitOperations'
import { normalizeFsmState } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { importEditorPayload } from './fsmEditorImportHelpers'
import type { FsmState } from './FsmTypes'
import { createPanel } from '@/utility/dockview/integration'
import { defaultFunctionType } from '@/utility/types'

export class FsmProject extends Project {
  static override get defaultProps(): FsmProps {
    return {
      name: 'State Machine ',
      initialFsmType: 'mealy',
      initialInputBits: 1,
      initialOutputBits: 1,
    }
  }

  // access state variables
  static override useState() {
    const state = computed(() => stateManager.state.fsm)

    // received basic attributes of the fsm
    const fsmModel = computed(() => state.value?.fsmModel ?? 'mealy')
    const rawNodes = computed(() => state.value?.nodes ?? [])
    const transitions = computed(() => state.value?.transitions ?? [])
    const inputBitCount = computed(() => state.value?.inputBitCount ?? 1)
    const outputBitCount = computed(() => state.value?.outputBitCount ?? 1)

    // compute new binary node IDs on every change in 'nodes', normalized on max bit string length
    const nodeIdBitCount = computed(() => calcBitNumber(rawNodes.value.length))

    const nodes = computed(() => {
      const idBits = nodeIdBitCount.value
      return rawNodes.value.map((node) => ({
        ...node,
        binaryNodeId: calcBinaryID(node.nodeId, idBits),
      }))
    })

    return {
      state,
      nodes,
      transitions,
      fsmModel,
      nodeIdBitCount,
      inputBitCount,
      outputBitCount,
    }
  }

  // define fsm editor and table as default panel layout for fsm projects
  static override restoreDefaultPanelLayout() {
    createPanel('state-table', 'State Table')
    createPanel('fsm-editor', 'FSM Editor', {
      referencePanel: 'state-table',
      direction: 'right',
    })
  }

  // initialize default fsm state
  static override createState(props: FsmProps) {
    console.log('[FSMProject.createState] Initializing project state')

    // initialize empty fsm state
    stateManager.state.fsm = {
      nodes: [],
      transitions: [],
      fsmModel: props.initialFsmType,
      functionType: defaultFunctionType,
      nodeIdBitCount: 0,
      inputBitCount: props.initialInputBits,
      outputBitCount: props.initialOutputBits,
    }

    console.log('[FSMProject.createState] State initialized')
  }

  static importEditorExport(incomingFsm: unknown): void {
    const state = stateManager.state.fsm as FsmState | undefined
    if (!state || typeof incomingFsm !== 'object' || incomingFsm == null) return

    interface EditorExportState {
      id?: number
      name?: string
      initial?: boolean
      x?: number
      y?: number
      moore_output?: string
    }
    interface EditorExportTransition {
      from?: number
      to?: number
      input?: string
      output?: string
      mealy_output?: string
    }
    interface EditorExportPayload {
      states?: EditorExportState[]
      transitions?: EditorExportTransition[]
    }

    const payload = incomingFsm as EditorExportPayload
    const { nodes, transitions } = importEditorPayload(payload, state)
    state.nodes = nodes
    state.transitions = transitions
    normalizeFsmState(state)
  }

  static override validateState(state: AppState): boolean {
    return state.fsm != undefined
  }
}

export { importEditorPayload } from './fsmEditorImportHelpers'

export {
  addStateRow,
  getStateCountLimit,
  removeStateRow,
  renameState,
  setInitialState,
  setInputBitCount,
  setOutputBitCount,
  toggleMooreOutputBit,
  toggleTransitionOutputBit,
  toggleTransitionTargetBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'

registerProjectType('state-machine', {
  name: 'State Machine',
  propsComponent: FsmPropsComponent,
  projectClass: FsmProject,
})
