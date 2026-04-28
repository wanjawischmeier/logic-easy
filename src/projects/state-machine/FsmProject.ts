import { Project } from '../Project'
import { computed } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import FsmPropsComponent from './FsmPropsComponent.vue'
import type { FsmProps } from './FsmTypes'
import { calcBinaryID, calcBitNumber } from '@/utility/fsm/bitOperations'
import { createPanel } from '@/utility/dockview/integration'

export class FsmProject extends Project {
  static override get defaultProps(): FsmProps {
    return {
      name: 'FSM',
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
    createPanel('fsm-engine', 'FSM Engine', {
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
      nodeIdBitCount: 0,
      inputBitCount: props.initialInputBits,
      outputBitCount: props.initialOutputBits,
    }

    console.log('[FSMProject.createState] State initialized')
  }

  static override validateState(state: AppState): boolean {
    return state.fsm != undefined
  }
}

registerProjectType('fsm', {
  name: 'State Machine',
  propsComponent: FsmPropsComponent,
  projectClass: FsmProject,
})
