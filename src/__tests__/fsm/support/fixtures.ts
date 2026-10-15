import { calcBitNumber } from '@/utility/fsm/bitOperations'
import { ensureTransitionMatrix } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { stateManager } from '@/projects/stateManager'
import type { FsmModel, FsmNode, FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'

// [from, target, input, mealyOutput] - target is a state index or a next-state pattern
export type Edge = readonly [number, number | string, string, string?]

export interface FsmSpec {
  model: FsmModel
  inputBits: number
  outputBits: number
  stateCount: number
  edges: readonly Edge[]
  mooreOutputs?: readonly string[]
}

export function createState(spec: FsmSpec): FsmState {
  const nodes: FsmNode[] = Array.from({ length: spec.stateCount }, (_, index) => ({
    nodeId: index,
    name: `q${index}`,
    isInitial: index === 0,
    mooreOutput:
      spec.model === 'moore'
        ? (spec.mooreOutputs?.[index] ?? 'x'.repeat(spec.outputBits))
        : undefined,
  }))

  const state: FsmState = {
    nodes,
    transitions: [],
    fsmModel: spec.model,
    nodeIdBitCount: calcBitNumber(Math.max(1, spec.stateCount)),
    inputBitCount: spec.inputBits,
    outputBitCount: spec.outputBits,
  }

  ensureTransitionMatrix(state)
  applyEdges(state, spec.edges)
  ensureTransitionMatrix(state)
  return state
}

// Addresses a row the way the table does: one row per (first state, input)
export function findRow(state: FsmState, from: number, input: string): FsmTransition {
  const transition = state.transitions.find((t) => t.fromNodeId === from && t.input === input)
  if (!transition) throw new Error(`no row for ${from}|${input}`)
  return transition
}

export function applyEdges(state: FsmState, edges: readonly Edge[]): void {
  edges.forEach(([from, target, input, output]) => {
    const transition = findRow(state, from, input)
    if (typeof target === 'number') {
      transition.toNodeId = target
      transition.toBinaryId = undefined
    } else {
      transition.toNodeId = -1
      transition.toBinaryId = target
    }
    transition.removedTarget = false
    if (output !== undefined && state.fsmModel !== 'moore') transition.mealyOutput = output
  })
}

// Writes one row the way a table cell click does
export function writeRow(
  state: FsmState,
  from: number,
  input: string,
  target: number | string,
  output?: string,
): void {
  applyEdges(state, [[from, target, input, output]])
}

// Spec with one concrete edge, usable for any state count
export function specForCount(count: number, model: FsmModel = 'mealy'): FsmSpec {
  return {
    model,
    inputBits: 1,
    outputBits: 1,
    stateCount: count,
    edges: count > 1 ? [[0, 1, '0', '1']] : [[0, 0, '0', '1']],
  }
}

export function specForSize(count: number, model: FsmModel): FsmSpec {
  const edges: FsmSpec['edges'] =
    count >= 2 ? [[0, 1, '0', '1']] : count === 1 ? [[0, 0, '0', '1']] : []
  return { model, inputBits: 1, outputBits: 1, stateCount: count, edges }
}

// The table, the panels and the FsmProject helpers all read the same central state
export function useFsm(spec: FsmSpec): FsmState {
  const state = createState(spec)
  stateManager.state.fsm = state
  return state
}

export function useSize(count: number, model: FsmModel): FsmState {
  return useFsm(specForSize(count, model))
}

export function compactIds(state: FsmState): number[] {
  return state.nodes.map((node) => node.nodeId)
}

export function namesOf(state: FsmState): string[] {
  return state.nodes.map((node) => node.name)
}
