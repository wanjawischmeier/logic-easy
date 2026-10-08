import { Project } from '../Project'
import { computed } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '../projectRegistry'
import FsmPropsComponent from './FsmPropsComponent.vue'
import { defaultStateEncoding, defaultFlipFlopType, type FsmProps } from './FsmTypes'
import { calcBinaryID, calcBitNumber } from '@/utility/fsm/bitOperations'
import {
  MAX_FSM_IO_BITS,
  MAX_FSM_STATES,
  addStateRow,
  normalizeFsmState,
  setInputBitCount,
  setOutputBitCount,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
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

    // compute new binary node IDs on every change in 'nodes', normalized on max nodeId
    const nodeIdBitCount = computed(() => {
      const maxNodeId = rawNodes.value.reduce(
        (max, node) => Math.max(max, Number(node?.nodeId ?? -1)),
        0,
      )
      return calcBitNumber(maxNodeId + 1)
    })

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
    createPanel('state-table', 'State Machine Tables')
    createPanel('fsm-editor', 'State Machine Editor', {
      referencePanel: 'state-table',
      direction: 'right',
    })
  }

  // initialize default fsm state
  static override createState(props: FsmProps) {
    // initialize empty fsm state
    stateManager.state.fsm = {
      nodes: [],
      transitions: [],
      fsmModel: props.initialFsmType,
      functionType: defaultFunctionType,
      nodeIdBitCount: 0,
      inputBitCount: props.initialInputBits,
      outputBitCount: props.initialOutputBits,
      stateEncoding: defaultStateEncoding,
      flipFlopType: defaultFlipFlopType,
    }
  }

  static importEditorExport(incomingFsm: unknown): void {
    const state = stateManager.state.fsm as FsmState | undefined
    if (!state || typeof incomingFsm !== 'object' || incomingFsm == null) return

    interface EditorExportState {
      id?: number
      name?: string
      initial?: boolean
      color?: string
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

  // The editor is a view: it asks the app for state changes, the app owns ids and names
  static addStateFromEditor(x?: number, y?: number): void {
    const fsm = stateManager.state.fsm as FsmState | undefined
    if (!fsm) return

    addStateRow(fsm, fsm.fsmModel, { x, y })
  }

  // An editor-side removal drops the state together with its edges, then renumbers
  static removeStateFromEditor(nodeId: number): void {
    const fsm = stateManager.state.fsm as FsmState | undefined
    if (!fsm || !Number.isFinite(nodeId)) return

    const payload = {
      states: fsm.nodes
        .filter((node) => node.nodeId !== nodeId)
        .map((node) => ({
          id: node.nodeId,
          name: node.name,
          initial: node.isInitial,
          color: node.color,
          x: node.editorCoordX,
          y: node.editorCoordY,
          moore_output: node.mooreOutput ?? '',
        })),
      transitions: fsm.transitions
        .filter((transition) => transition.fromNodeId !== nodeId && transition.toNodeId !== nodeId)
        .map((transition) => ({
          id: transition.transitionId,
          groupId: transition.groupId ?? transition.transitionId,
          from: transition.fromNodeId,
          to: transition.toNodeId,
          toBinaryId: transition.toBinaryId,
          input: transition.input,
          output: transition.mealyOutput ?? '',
          mealy_output: transition.mealyOutput ?? '',
        })),
    }

    const { nodes, transitions } = importEditorPayload(payload, fsm)
    fsm.nodes = nodes
    fsm.transitions = transitions
    normalizeFsmState(fsm)
  }

  static override validateState(state: AppState): boolean {
    return state.fsm != undefined
  }

  static override normalizeState(state: AppState): void {
    const fsm = state.fsm as FsmState | undefined
    if (!fsm) return

    // Clamp imported input/output bit counts to the allowed maximum
    const inputBits = Math.max(1, Math.min(MAX_FSM_IO_BITS, fsm.inputBitCount ?? 1))
    const outputBits = Math.max(1, Math.min(MAX_FSM_IO_BITS, fsm.outputBitCount ?? 1))
    if ((fsm.inputBitCount ?? 1) !== inputBits) {
      setInputBitCount(fsm, inputBits)
    }
    if ((fsm.outputBitCount ?? 1) !== outputBits) {
      setOutputBitCount(fsm, outputBits, fsm.fsmModel)
    }

    // Enforce the maximum number of states on restored/imported data (keep lowest ids, then normalize once)
    if (Array.isArray(fsm.nodes) && fsm.nodes.length > MAX_FSM_STATES) {
      // Non-finite node ids sort last so corrupt entries are trimmed first
      const sorted = [...fsm.nodes].sort((a, b) => {
        const idA = Number(a?.nodeId)
        const idB = Number(b?.nodeId)
        return (
          (Number.isFinite(idA) ? idA : Number.MAX_SAFE_INTEGER) -
          (Number.isFinite(idB) ? idB : Number.MAX_SAFE_INTEGER)
        )
      })
      const removedIds = new Set(sorted.slice(MAX_FSM_STATES).map((node) => Number(node.nodeId)))
      fsm.nodes = sorted.slice(0, MAX_FSM_STATES)
      if (Array.isArray(fsm.transitions)) {
        fsm.transitions = fsm.transitions
          .filter((transition) => !removedIds.has(Number(transition.fromNodeId)))
          .map((transition) =>
            removedIds.has(Number(transition.toNodeId))
              ? { ...transition, toNodeId: -1 }
              : transition,
          )
      }
      normalizeFsmState(fsm)
    }
  }
}

export { importEditorPayload } from './fsmEditorImportHelpers'

export {
  addStateRow,
  getStateCountLimit,
  MAX_STATE_NAME_LENGTH,
  nextFreeStateName,
  removeStateRow,
  renameState,
  resolveMooreOutput,
  sanitizeStateName,
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
