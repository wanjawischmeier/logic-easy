import { expect } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { calcBinaryID, normalizeBits } from '@/utility/fsm/bitOperations'
import {
  ensureTransitionMatrix,
  isHiddenTransition,
  toggleTransitionOutputBit,
  toggleTransitionTargetBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import type { FsmModel, FsmNode, FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import type { FsmSpec } from './fixtures'

// ---------------------------------------------------------------------------
// Helpers that mirror what the UI does
// ---------------------------------------------------------------------------

export function nodeName(state: FsmState, nodeId: number): string {
  return state.nodes.find((node) => node.nodeId === nodeId)?.name ?? `#${nodeId}`
}

export function targetPattern(state: FsmState, transition: FsmTransition): string {
  const nodeBits = Math.max(1, state.nodeIdBitCount || 1)
  if (transition.toNodeId >= 0) return transition.toNodeId.toString(2).padStart(nodeBits, '0')
  return String(transition.toBinaryId ?? '').replace(/-/g, 'x')
}

// Readable, order independent picture of the FSM; targets are printed as names,
// so a wrong id remapping fails even though the row still exists
export function snapshot(state: FsmState): string[] {
  return state.transitions
    .map((transition) => {
      const target =
        transition.toNodeId >= 0
          ? nodeName(state, transition.toNodeId)
          : transition.removedTarget
            ? `removed:${transition.toBinaryId ?? ''}`
            : `pattern:${transition.toBinaryId ?? ''}`
      const output = state.fsmModel === 'moore' ? '-' : (transition.mealyOutput ?? '')
      return `${nodeName(state, transition.fromNodeId)}|${transition.input}->${target}/${output}`
    })
    .sort()
}

// The states a next-state pattern stands for, so a re-encoding can be proved
export function coveredNames(state: FsmState, transition: FsmTransition): string[] | null {
  if (transition.toNodeId >= 0) return null
  const pattern = String(transition.toBinaryId ?? '').replace(/-/g, 'x')
  // an all don't-care row stands for "any state" and has no meaning to compare
  if (pattern === '' || !/[01]/.test(pattern)) return null
  const bits = pattern.length
  const names: string[] = []
  const walk = (prefix: string, index: number): void => {
    if (index === bits) {
      const node = state.nodes.find(
        (candidate) => candidate.nodeId.toString(2).padStart(bits, '0') === prefix,
      )
      names.push(node?.name ?? `#${prefix}`)
      return
    }
    const char = pattern.charAt(index)
    if (char === 'x') {
      walk(`${prefix}0`, index + 1)
      walk(`${prefix}1`, index + 1)
      return
    }
    walk(`${prefix}${char}`, index + 1)
  }
  walk('', 0)
  return names.sort()
}

// Tests want a loud failure instead of a silent undefined when an index is wrong
export function rowAt(state: FsmState, index: number): FsmTransition {
  const transition = state.transitions[index]
  if (!transition) throw new Error(`no transition at index ${index}`)
  return transition
}

export function nodeAt(state: FsmState, index: number): FsmNode {
  const node = state.nodes[index]
  if (!node) throw new Error(`no node at index ${index}`)
  return node
}

type TruthTable = ReturnType<typeof exportFsmToTruthTable>

export function valueRow(table: TruthTable, index: number): (number | string)[] {
  const row = table.values[index]
  if (!row) throw new Error(`no truth table row ${index}`)
  return row
}

// Every invariant the central state must keep, whatever the path was
export function expectMatrix(state: FsmState): void {
  const inputsPerState = 1 << Math.max(1, state.inputBitCount ?? 1)
  expect(state.transitions).toHaveLength(state.nodes.length * inputsPerState)

  const keys = state.transitions.map((t) => `${t.fromNodeId}|${t.input}`)
  expect(new Set(keys).size).toBe(keys.length)
  expect(state.transitions.map((t) => t.transitionId)).toEqual(
    state.transitions.map((_, index) => index + 1),
  )
  expect(state.nodes.map((node) => node.nodeId)).toEqual(state.nodes.map((_, index) => index))

  state.transitions.forEach((transition) => {
    expect(transition.input).toMatch(/^[01]+$/)
    expect(state.nodes.some((node) => node.nodeId === transition.fromNodeId)).toBe(true)
    if (transition.toNodeId >= 0) {
      expect(state.nodes.some((node) => node.nodeId === transition.toNodeId)).toBe(true)
    } else if (!transition.removedTarget) {
      expect(targetPattern(state, transition)).toMatch(/^[01x]+$/)
    }
    if (state.fsmModel === 'moore') {
      expect(transition.mealyOutput ?? '').toBe('')
    } else {
      expect(transition.mealyOutput ?? '').toMatch(/^[01x]+$/)
    }
  })
}

// Cell clicks of the table: a next-state bit cycles 0 -> 1 -> x -> 0
export function clickTargetBitsUntil(state: FsmState, index: number, wanted: string): void {
  for (let guard = 0; guard < wanted.length * 4 + 4; guard += 1) {
    const current = targetPattern(state, rowAt(state, index))
    if (current === wanted) return
    const bit = [...wanted].findIndex((value, i) => current.charAt(i) !== value)
    toggleTransitionTargetBit(state, index, bit === -1 ? 0 : bit)
  }
  throw new Error(`could not reach pattern ${wanted}`)
}

export function clickOutputBitsUntil(state: FsmState, index: number, wanted: string): void {
  for (let guard = 0; guard < wanted.length * 4 + 4; guard += 1) {
    const current = rowAt(state, index).mealyOutput ?? ''
    if (current === wanted) return
    const bit = [...wanted].findIndex((value, i) => current.charAt(i) !== value)
    toggleTransitionOutputBit(state, index, bit === -1 ? 0 : bit)
  }
  throw new Error(`could not reach output ${wanted}`)
}

// Right-aligns like the panel payload: normalizeBits(..., 'right') pads at the end, keeps the first bits
export function padRight(value: string, length: number): string {
  return String(value ?? '')
    .replace(/-/g, 'x')
    .padEnd(length, 'x')
    .slice(0, length)
}

// Mirrors the payload the panel sends before the editor renders it
export function toEditorPayload(state: FsmState) {
  const nodeBits = Math.max(1, state.nodeIdBitCount || 1)
  const inputBits = Math.max(1, state.inputBitCount ?? 1)
  const outputBits = Math.max(1, state.outputBitCount ?? 1)
  const output = (transition: FsmTransition) =>
    state.fsmModel === 'moore' ? '' : padRight(transition.mealyOutput ?? '', outputBits)

  return {
    states: state.nodes.map((node) => ({
      id: node.nodeId,
      name: node.name,
      initial: node.isInitial,
      x: node.editorCoordX,
      y: node.editorCoordY,
      moore_output: node.mooreOutput ?? '',
    })),
    transitions: state.transitions.map((transition) => ({
      id: transition.transitionId,
      groupId: transition.groupId ?? transition.transitionId,
      from: transition.fromNodeId,
      to: transition.toNodeId,
      // A removed marker becomes a full don't care so the editor hides it, exactly like the panel
      toBinaryId: transition.removedTarget ? 'x'.repeat(nodeBits) : transition.toBinaryId,
      input: padRight(transition.input, inputBits),
      output: output(transition),
      mealy_output: output(transition),
    })),
  }
}

// Panel -> editor -> panel: the FSM must come back unchanged
export function roundtrip(state: FsmState): FsmState {
  const { nodes, transitions } = importEditorPayload(toEditorPayload(state), state)
  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}

// ---------------------------------------------------------------------------
// Overlay and view mode cases
// ---------------------------------------------------------------------------

// The next-state cells of the exported table must be open for hidden rows and only for them
export function nextStateCellsAreOpenOnlyForHiddenRows(state: FsmState): boolean {
  const table = exportFsmToTruthTable(state)
  const stateBits = Math.max(1, state.nodeIdBitCount)
  const inputBits = Math.max(1, state.inputBitCount ?? 1)

  return state.transitions.every((transition) => {
    const input = normalizeBits(transition.input, inputBits, 'x', 'right')
    if (!/^[01]+$/.test(input)) return true

    const from = normalizeBits(
      calcBinaryID(transition.fromNodeId, stateBits),
      stateBits,
      '0',
      'left',
    )
    const cells = table.values[parseInt(`${from}${input}`, 2)] ?? []
    const open = cells.slice(0, stateBits).every((cell) => cell === '-')

    return open === isHiddenTransition(transition)
  })
}

export const IO_CASES: readonly { model: FsmModel; inputBits: number; outputBits: number }[] = [
  { model: 'mealy', inputBits: 1, outputBits: 1 },
  { model: 'mealy', inputBits: 2, outputBits: 3 },
  { model: 'moore', inputBits: 1, outputBits: 1 },
  { model: 'moore', inputBits: 3, outputBits: 2 },
]

export function lifecycleSpec(
  model: FsmModel,
  inputBits: number,
  outputBits: number,
  stateCount: number,
): FsmSpec {
  const edge = ['0'.repeat(inputBits), '0'.repeat(outputBits)] as const
  return {
    model,
    inputBits,
    outputBits,
    stateCount,
    edges:
      stateCount > 1
        ? [[0, stateCount - 1, edge[0], edge[1]]]
        : stateCount === 1
          ? [[0, 0, edge[0], edge[1]]]
          : [],
  }
}
