import type { FsmState, FsmNode, FsmTransition } from './FsmTypes'
import {
  // keep expand/fill centralized in transition utils
  expandInputs,
  fillMissingTransitions,
} from '@/utility/fsm/EditorSync/editorTransitionUtils'
import { calcBinaryID, calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'

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
  toBinaryId?: string
  input?: string
  output?: string
  mealy_output?: string
  groupId?: number
}

interface EditorExportPayload {
  states?: EditorExportState[]
  transitions?: EditorExportTransition[]
}

const sanitizeEditorBits = (value: unknown, fallbackLength: number): string => {
  const normalized = String(value ?? '')
    .replace(/-/g, 'x')
    .replace(/[^01x]/g, '')
    .trim()
  return normalized.length === 0 ? 'x'.repeat(fallbackLength) : normalized
}

function remapEditorNodes(incomingStates: EditorExportState[], s: FsmState) {
  const isMoore = s.fsmModel === 'moore'
  const outputBits = s.outputBitCount ?? 1
  const sorted = [...incomingStates]
    .filter((st) => Number.isFinite(st?.id))
    .sort((a, b) => Number(a.id) - Number(b.id))

  const idMap = new Map<number, number>()
  sorted.forEach((st, idx) => idMap.set(Number(st.id), idx))

  const firstInitial = sorted.find((st) => !!st?.initial)
  const initialOldId = firstInitial
    ? Number(firstInitial.id)
    : sorted[0]
      ? Number(sorted[0].id)
      : -1
  const finalOldId = sorted.length > 0 ? Number(sorted[sorted.length - 1]?.id) : -1

  const nodes: FsmNode[] = sorted.map((incomingState, index) => {
    const previousId = Number(incomingState.id)
    return {
      nodeId: index,
      name: String(incomingState.name ?? '').trim() || `q${index}`,
      isInitial: previousId === initialOldId,
      isFinal: previousId === finalOldId,
      editorCoordX: typeof incomingState.x === 'number' ? incomingState.x : undefined,
      editorCoordY: typeof incomingState.y === 'number' ? incomingState.y : undefined,
      mooreOutput: isMoore ? sanitizeEditorBits(incomingState.moore_output, outputBits) : undefined,
    }
  })

  return { nodes, idMap }
}

export function importEditorPayload(raw: EditorExportPayload, state: FsmState) {
  const inputBits = state.inputBitCount ?? 1
  const outputBits = state.outputBitCount ?? 1
  const isMoore = state.fsmModel === 'moore'
  const incomingStates = ((raw?.states as any) || []) as EditorExportState[]
  const maxIncomingStateId = incomingStates.reduce((max, entry) => {
    return Number.isFinite(entry?.id) ? Math.max(max, Number(entry.id)) : max
  }, -1)
  const targetBits = calcBitNumber(maxIncomingStateId + 1)

  const { nodes, idMap } = remapEditorNodes(incomingStates, state)
  const nodeBitCount = calcBitNumber(nodes.length)

  const rawExpanded: FsmTransition[] = []
  ;((raw?.transitions as any) || []).forEach((incomingTransition: any) => {
    const remappedFrom = idMap.get(Number(incomingTransition.from))
    if (remappedFrom === undefined) return

    const pattern = sanitizeEditorBits(incomingTransition.input, inputBits).padStart(inputBits, 'x')
    const outputBitsString = sanitizeEditorBits(
      incomingTransition.mealy_output || incomingTransition.output,
      outputBits,
    )
    const remappedTo = idMap.get(Number(incomingTransition.to))
    const concreteBits =
      remappedTo !== undefined ? calcBinaryID(remappedTo, nodeBitCount) : 'x'.repeat(nodeBitCount)
    const rawtoBinaryId = sanitizeEditorBits(incomingTransition.toBinaryId, targetBits)
    const normalizedtoBinaryId = normalizeBits(
      incomingTransition.toBinaryId ? rawtoBinaryId : concreteBits,
      nodeBitCount,
      'x',
      'left',
    )
    const concreteToNodeId = /^[01]+$/.test(normalizedtoBinaryId)
      ? (nodes.find((node) => calcBinaryID(node.nodeId, nodeBitCount) === normalizedtoBinaryId)
          ?.nodeId ?? -1)
      : -1

    expandInputs(pattern).forEach((concreteInput) => {
      rawExpanded.push({
        transitionId: 0,
        groupId: Number.isFinite(incomingTransition.groupId)
          ? Number(incomingTransition.groupId)
          : Number.isFinite(incomingTransition.id)
            ? Number(incomingTransition.id)
            : undefined,
        fromNodeId: remappedFrom,
        toNodeId: concreteToNodeId,
        toBinaryId: concreteToNodeId >= 0 ? undefined : normalizedtoBinaryId,
        input: concreteInput,
        mealyOutput: !isMoore ? outputBitsString : undefined,
      })
    })
  })

  const transitions = fillMissingTransitions(nodes, rawExpanded, inputBits, outputBits, isMoore)
  return { nodes, transitions }
}

export default importEditorPayload
