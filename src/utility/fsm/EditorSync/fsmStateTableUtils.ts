import type { FsmModel, FsmNode, FsmState } from '@/projects/state-machine/FsmTypes'
import { fillMissingTransitions } from './editorTransitionUtils'
import { calcBinaryID, calcBitNumber, normalizeBits, toggleBitInString } from '../bitOperations'

// Maximum number of states allowed in an FSM (4 bits -> 2^4 = 16)
export const MAX_FSM_STATES = 16
// Maximum number of input/output bits allowed in the table
export const MAX_FSM_IO_BITS = 5

function syncNodeBitCount(state: FsmState): void {
  const maxNodeId = state.nodes.reduce((max, node) => Math.max(max, Number(node?.nodeId ?? -1)), 0)
  state.nodeIdBitCount = calcBitNumber(maxNodeId + 1)
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

export function resolveTransitionTargetNodes(
  state: FsmState,
  transition: FsmState['transitions'][number],
): FsmNode[] {
  if (transition.removedTarget) return []
  if (transition.toNodeId >= 0) {
    const node = state.nodes.find((candidate) => candidate.nodeId === transition.toNodeId)
    return node ? [node] : []
  }

  const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
  const totalStates = Math.max(1, maxNodeId + 1)
  const nodeIdBitCount = totalStates <= 1 ? 1 : calcBitNumber(totalStates)
  const normalizedPattern = normalizeBits(transition.toBinaryId ?? '', nodeIdBitCount, 'x', 'left')

  return state.nodes.filter((node) => {
    const nodeBits = calcBinaryID(node.nodeId, nodeIdBitCount)
    for (let index = 0; index < nodeIdBitCount; index += 1) {
      const patternBit = normalizedPattern.charAt(index)
      if (patternBit !== 'x' && patternBit !== nodeBits.charAt(index)) return false
    }
    return true
  })
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
    state.fsmModel === 'moore',
  )
  // Deduplicate by (fromNodeId, input). When duplicates exist prefer more
  // specific transitions (those with explicit groupId or concrete target)
  // so that edits coming from the editor/table are preserved instead of
  // being shadowed by generic don't-care placeholders.
  const byKey: Record<string, (typeof normalizedTransitions)[number]> = {}
  const pickBetter = (
    a: (typeof normalizedTransitions)[number] | undefined,
    b: (typeof normalizedTransitions)[number] | undefined,
  ): (typeof normalizedTransitions)[number] | undefined => {
    if (!a) return b
    if (!b) return a
    const score = (t: (typeof normalizedTransitions)[number]) => {
      let s = 0
      if (t.groupId != null) s += 4
      if (t.toNodeId >= 0) s += 3
      if (t.toBinaryId && !/^x+$/.test(String(t.toBinaryId))) s += 2
      if (t.mealyOutput && String(t.mealyOutput).replace(/x/g, '').length > 0) s += 1
      return s
    }
    return score(b) > score(a) ? b : a
  }

  for (const tr of normalizedTransitions) {
    const key = `${tr.fromNodeId}:${tr.input}`
    byKey[key] = pickBetter(byKey[key], tr) as (typeof normalizedTransitions)[number]
  }

  const unique = Object.values(byKey) as typeof normalizedTransitions

  // Reassign transitionIds sequentially
  state.transitions = unique.map((t, idx) => ({ ...t, transitionId: idx + 1 }))
}

export function addStateRow(state: FsmState, model: FsmModel): void {
  // Do not allow more states than the configured maximum.
  if (state.nodes.length >= MAX_FSM_STATES) return

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
  // Pre-removal bit count so targets of the removed state keep their binary pattern
  const maxOldId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
  const oldTotalStates = Math.max(1, maxOldId + 1)
  const oldNodeIdBitCount = oldTotalStates <= 1 ? 1 : calcBitNumber(oldTotalStates)

  state.nodes = state.nodes.filter((node) => node.nodeId !== stateId)
  state.transitions = state.transitions
    .filter((transition) => transition.fromNodeId !== stateId)
    .map((transition) =>
      transition.toNodeId === stateId
        ? {
            ...transition,
            toNodeId: -1,
            toBinaryId: calcBinaryID(stateId, oldNodeIdBitCount),
            removedTarget: true,
          }
        : transition,
    )

  // Keep each pattern as-is instead of re-resolving it, so the editor locks
  // when a table-side removal left a next state that no longer exists
  const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
  const totalStates = Math.max(1, maxNodeId + 1)
  const nodeIdBitCount = totalStates <= 1 ? 1 : calcBitNumber(totalStates)

  state.transitions = state.transitions.map((transition) => {
    if (transition.toNodeId >= 0) return transition
    if (transition.removedTarget) return transition
    const normalizedTarget = normalizeBits(transition.toBinaryId ?? '', nodeIdBitCount, 'x', 'left')
    return { ...transition, toNodeId: -1, toBinaryId: normalizedTarget }
  })

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
  const clamped = Math.max(1, Math.min(MAX_FSM_IO_BITS, nextInputBits))
  state.transitions = state.transitions.map((transition) => ({
    ...transition,
    input: normalizeBits(transition.input, clamped, '0', 'left'),
  }))
  state.inputBitCount = clamped
  ensureTransitionMatrix(state)
}

export function setOutputBitCount(state: FsmState, nextOutputBits: number, model: FsmModel): void {
  const clamped = Math.max(1, Math.min(MAX_FSM_IO_BITS, nextOutputBits))
  state.transitions = state.transitions.map((transition) =>
    model === 'moore'
      ? {
          ...transition,
          mealyOutput: undefined,
        }
      : {
          ...transition,
          mealyOutput: normalizeBits(transition.mealyOutput, clamped, 'x', 'right'),
        },
  )

  state.nodes = state.nodes.map((node) => ({
    ...node,
    mooreOutput:
      model === 'moore' ? normalizeBits(node.mooreOutput, clamped, 'x', 'right') : node.mooreOutput,
  }))
  state.outputBitCount = clamped
}

export function toggleTransitionTargetBit(
  state: FsmState,
  transitionIndex: number,
  bitIndex: number,
): void {
  const transition = state.transitions[transitionIndex]
  if (!transition) return
  // A manual toggle picks a new target, so a stale removed-target marker no longer applies
  transition.removedTarget = false
  // compute node bit count from highest node id to match editor/import logic
  const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
  const totalStates = Math.max(1, maxNodeId + 1)
  const nodeIdBitCount = totalStates <= 1 ? 1 : calcBitNumber(totalStates)
  syncNodeBitCount(state)
  const currentNode = state.nodes.find((node) => node.nodeId === transition.toNodeId)
  const currentBits = normalizeBits(
    transition.toBinaryId ?? (currentNode ? calcBinaryID(currentNode.nodeId, nodeIdBitCount) : ''),
    nodeIdBitCount,
    'x',
    'left',
  )
  // Always toggle in the fixed standard order 0 -> 1 -> x -> 0, validity is checked separately
  const finalBits = toggleBitInString(currentBits, bitIndex, nodeIdBitCount)

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

  const outputBits = state.outputBitCount ?? 1
  const targetNodes = resolveTransitionTargetNodes(state, transition)
  // Only a single resolved target is editable; never auto-apply the value to several states
  if (targetNodes.length !== 1) return

  const [node] = targetNodes
  if (!node) return
  const bits = normalizeBits(node.mooreOutput, outputBits, 'x', 'right').split('')
  bits[bitIndex] = bits[bitIndex] === '0' ? '1' : bits[bitIndex] === '1' ? 'x' : '0'
  node.mooreOutput = bits.join('')
}

export function getStateCountLimit(): number {
  return MAX_FSM_STATES
}
