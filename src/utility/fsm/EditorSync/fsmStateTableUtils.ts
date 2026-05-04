import type { FsmModel, FsmNode, FsmState } from '@/projects/state-machine/FsmTypes'
import { fillMissingTransitions } from './editorTransitionUtils'
import { calcBinaryID, calcBitNumber, normalizeBits, toggleBitInString } from '../bitOperations'

const MAX_FSM_BITS = 10

function syncNodeBitCount(state: FsmState): void {
  state.nodeIdBitCount = calcBitNumber(state.nodes.length)
}

function ensureInitialState(nodes: FsmNode[]): FsmNode[] {
  if (nodes.length === 0) return nodes
  if (nodes.some((state) => state.isInitial)) return nodes

  return nodes.map((state, index) => ({
    ...state,
    isInitial: index === 0,
  }))
}

function ensureFinalState(nodes: FsmNode[]): FsmNode[] {
  if (nodes.length === 0) return nodes

  const maxNodeId = Math.max(...nodes.map((node) => node.nodeId))
  return nodes.map((node) => ({
    ...node,
    isFinal: node.nodeId === maxNodeId,
  }))
}

export function normalizeFsmState(state: FsmState): void {
  state.nodes = ensureFinalState(ensureInitialState(state.nodes))
  ensureTransitionMatrix(state)
}

export function ensureTransitionMatrix(state: FsmState): void {
  syncNodeBitCount(state)
  const normalizedTransitions = fillMissingTransitions(
    state.nodes,
    state.transitions,
    state.inputBitCount ?? 1,
    state.outputBitCount ?? 1,
  )
  state.transitions = normalizedTransitions
}

export function addStateRow(state: FsmState, model: FsmModel): void {
  const usedIds = new Set(state.nodes.map((n) => n.nodeId))
  let nextId = 0
  while (usedIds.has(nextId)) nextId += 1
  const hasInitialState = state.nodes.some((node) => node.isInitial)

  state.nodes.push({
    nodeId: nextId,
    name: `q${nextId}`,
    isInitial: !hasInitialState,
    isFinal: true,
    mooreOutput: model === 'moore' ? 'x' : undefined,
  })

  state.nodes = ensureFinalState(ensureInitialState(state.nodes))
  syncNodeBitCount(state)
  ensureTransitionMatrix(state)
}

export function removeStateRow(state: FsmState, stateId: number): void {
  state.nodes = state.nodes.filter((node) => node.nodeId !== stateId)
  state.transitions = state.transitions
    .filter((transition) => transition.fromNodeId !== stateId)
    .map((transition) => ({
      ...transition,
      toNodeId: transition.toNodeId === stateId ? -1 : transition.toNodeId,
    }))

  state.nodes = ensureFinalState(ensureInitialState(state.nodes))
  syncNodeBitCount(state)
  ensureTransitionMatrix(state)
}

export function setInitialState(state: FsmState, stateId: number): void {
  state.nodes = state.nodes.map((node) => ({
    ...node,
    isInitial: node.nodeId === stateId,
  }))
  syncNodeBitCount(state)
}

export function renameState(
  state: FsmState,
  stateId: number,
  requestedName: string | undefined,
): void {
  const previousName = state.nodes.find((node) => node.nodeId === stateId)?.name ?? `q${stateId}`
  const nextName = requestedName?.trim() ? requestedName.trim() : `q${stateId}`
  const duplicateExists = state.nodes.some(
    (node) => node.nodeId !== stateId && node.name.trim().toLowerCase() === nextName.toLowerCase(),
  )
  const resolvedName = duplicateExists ? previousName : nextName

  state.nodes = state.nodes.map((node) =>
    node.nodeId === stateId ? { ...node, name: resolvedName } : node,
  )
  syncNodeBitCount(state)
}

export function setInputBitCount(state: FsmState, nextInputBits: number): void {
  state.transitions = state.transitions.map((transition) => ({
    ...transition,
    input: normalizeBits(transition.input, nextInputBits, '0', 'left'),
  }))
  state.inputBitCount = nextInputBits
  ensureTransitionMatrix(state)
}

export function setOutputBitCount(state: FsmState, nextOutputBits: number, model: FsmModel): void {
  state.transitions = state.transitions.map((transition) => ({
    ...transition,
    mealyOutput: normalizeBits(transition.mealyOutput, nextOutputBits, 'x', 'right'),
  }))

  state.nodes = state.nodes.map((node) => ({
    ...node,
    mooreOutput:
      model === 'moore'
        ? normalizeBits(node.mooreOutput, nextOutputBits, 'x', 'right')
        : node.mooreOutput,
  }))
  state.outputBitCount = nextOutputBits
}

export function toggleTransitionTargetBit(
  state: FsmState,
  transitionIndex: number,
  bitIndex: number,
): void {
  const transition = state.transitions[transitionIndex]
  if (!transition) return

  const nodeIdBitCount = calcBitNumber(state.nodes.length)
  syncNodeBitCount(state)
  const currentNode = state.nodes.find((node) => node.nodeId === transition.toNodeId)
  const currentBits = normalizeBits(
    transition.toBinaryId ?? (currentNode ? calcBinaryID(currentNode.nodeId, nodeIdBitCount) : ''),
    nodeIdBitCount,
    'x',
    'left',
  )
  const chars = currentBits.split('')
  chars[bitIndex] = chars[bitIndex] === 'x' ? '0' : chars[bitIndex] === '0' ? '1' : 'x'
  const finalBits = chars.join('')

  if (finalBits.includes('x')) {
    transition.toNodeId = -1
    transition.toBinaryId = finalBits
    return
  }

  const targetState = state.nodes.find(
    (node) => calcBinaryID(node.nodeId, nodeIdBitCount) === finalBits,
  )
  transition.toNodeId = targetState ? targetState.nodeId : -1
  transition.toBinaryId = targetState ? undefined : finalBits
}

export function toggleTransitionOutputBit(
  state: FsmState,
  transitionIndex: number,
  bitIndex: number,
): void {
  const transition = state.transitions[transitionIndex]
  if (!transition) return

  transition.mealyOutput = toggleBitInString(
    transition.mealyOutput ?? '',
    bitIndex,
    state.outputBitCount ?? 1,
  )
}

export function toggleMooreOutputBit(
  state: FsmState,
  transitionIndex: number,
  bitIndex: number,
): void {
  const transition = state.transitions[transitionIndex]
  if (!transition) return

  const node = state.nodes.find((stateNode) => stateNode.nodeId === transition.fromNodeId)
  if (!node) return

  node.mooreOutput = toggleBitInString(node.mooreOutput ?? '', bitIndex, state.outputBitCount ?? 1)
}

export function getStateCountLimit(): number {
  return MAX_FSM_BITS
}
