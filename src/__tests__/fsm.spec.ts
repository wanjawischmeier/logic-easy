import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import FsmViewGate from '@/components/FsmViewGate.vue'
import TransitionsTable from '@/components/TransitionsTable.vue'
import HiddenEdgesNotice from '@/components/HiddenEdgesNotice.vue'
import HiddenTransitionsBadge from '@/components/HiddenTransitionsBadge.vue'
import type { FsmModel, FsmNode, FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { calcBinaryID, calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import {
  MAX_FSM_IO_BITS,
  MAX_FSM_STATES,
  addStateRow,
  ensureTransitionMatrix,
  isHiddenTransition,
  needsHiddenCleanup,
  removeStateRow,
  renameState,
  resolveMooreOutput,
  resolveTransitionTargetNodes,
  sanitizeStateName,
  setInputBitCount,
  toggleMooreOutputBit,
  toggleTransitionOutputBit,
  toggleTransitionTargetBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import {
  validateFsm,
  countPendingHiddenRows,
  countHiddenRows,
  countHiddenRowsWithBits,
  fsmViewMode,
} from '@/utility/fsm/EditorSync/fsmValidation'
import { buildFsmImportPayload, forceSyncTableToEditor } from '@/utility/fsm/EditorSync/fsmListener'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { stateMachineToLC } from '@/utility/LogicCircuitsExport/StateMachineToLC'

// LC element type ids, see Elements.ts
const AND_GATE = 0
const OR_GATE = 1
const D_FLIPFLOP = 19
const JK_FLIPFLOP = 18

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// [from, target, input, mealyOutput] - target is a state index or a next-state pattern
type Edge = readonly [number, number | string, string, string?]

interface FsmSpec {
  model: FsmModel
  inputBits: number
  outputBits: number
  stateCount: number
  edges: readonly Edge[]
  mooreOutputs?: readonly string[]
}

function createState(spec: FsmSpec): FsmState {
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
function findRow(state: FsmState, from: number, input: string): FsmTransition {
  const transition = state.transitions.find((t) => t.fromNodeId === from && t.input === input)
  if (!transition) throw new Error(`no row for ${from}|${input}`)
  return transition
}

function applyEdges(state: FsmState, edges: readonly Edge[]): void {
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

// ---------------------------------------------------------------------------
// Helpers that mirror what the UI does
// ---------------------------------------------------------------------------

function nodeName(state: FsmState, nodeId: number): string {
  return state.nodes.find((node) => node.nodeId === nodeId)?.name ?? `#${nodeId}`
}

function targetPattern(state: FsmState, transition: FsmTransition): string {
  const nodeBits = Math.max(1, state.nodeIdBitCount || 1)
  if (transition.toNodeId >= 0) return transition.toNodeId.toString(2).padStart(nodeBits, '0')
  return String(transition.toBinaryId ?? '').replace(/-/g, 'x')
}

// Readable, order independent picture of the FSM; targets are printed as names,
// so a wrong id remapping fails even though the row still exists
function snapshot(state: FsmState): string[] {
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
function coveredNames(state: FsmState, transition: FsmTransition): string[] | null {
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
function rowAt(state: FsmState, index: number): FsmTransition {
  const transition = state.transitions[index]
  if (!transition) throw new Error(`no transition at index ${index}`)
  return transition
}

function nodeAt(state: FsmState, index: number): FsmNode {
  const node = state.nodes[index]
  if (!node) throw new Error(`no node at index ${index}`)
  return node
}

type TruthTable = ReturnType<typeof exportFsmToTruthTable>

function valueRow(table: TruthTable, index: number): (number | string)[] {
  const row = table.values[index]
  if (!row) throw new Error(`no truth table row ${index}`)
  return row
}

// Every invariant the central state must keep, whatever the path was
function expectMatrix(state: FsmState): void {
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
function clickTargetBitsUntil(state: FsmState, index: number, wanted: string): void {
  for (let guard = 0; guard < wanted.length * 4 + 4; guard += 1) {
    const current = targetPattern(state, rowAt(state, index))
    if (current === wanted) return
    const bit = [...wanted].findIndex((value, i) => current.charAt(i) !== value)
    toggleTransitionTargetBit(state, index, bit === -1 ? 0 : bit)
  }
  throw new Error(`could not reach pattern ${wanted}`)
}

function clickOutputBitsUntil(state: FsmState, index: number, wanted: string): void {
  for (let guard = 0; guard < wanted.length * 4 + 4; guard += 1) {
    const current = rowAt(state, index).mealyOutput ?? ''
    if (current === wanted) return
    const bit = [...wanted].findIndex((value, i) => current.charAt(i) !== value)
    toggleTransitionOutputBit(state, index, bit === -1 ? 0 : bit)
  }
  throw new Error(`could not reach output ${wanted}`)
}

// Right-aligns like the panel payload: normalizeBits(..., 'right') pads at the end, keeps the first bits
function padRight(value: string, length: number): string {
  return String(value ?? '')
    .replace(/-/g, 'x')
    .padEnd(length, 'x')
    .slice(0, length)
}

// Mirrors the payload the panel sends before the editor renders it
function toEditorPayload(state: FsmState) {
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
function roundtrip(state: FsmState): FsmState {
  const { nodes, transitions } = importEditorPayload(toEditorPayload(state), state)
  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}

// ---------------------------------------------------------------------------
// The FSMs under test
// ---------------------------------------------------------------------------

// Foto 4: A -0/00-> B, A -1/11-> C, B -0/00-> B, B -1/11-> A, C -0/00-> B, C -1/11-> A
const M2: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 3,
  edges: [
    [0, 1, '0', '00'],
    [0, 2, '1', '11'],
    [1, 1, '0', '00'],
    [1, 0, '1', '11'],
    [2, 1, '0', '00'],
    [2, 0, '1', '11'],
  ],
}
const M2_SNAPSHOT = [
  'q0|0->q1/00',
  'q0|1->q2/11',
  'q1|0->q1/00',
  'q1|1->q0/11',
  'q2|0->q1/00',
  'q2|1->q0/11',
]

// Foto 2 (Abb. 1.1): four states, input x, output y1y0
const M1: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 4,
  edges: [
    [0, 1, '0', '00'],
    [0, 2, '1', '11'],
    [1, 0, '0', '00'],
    [1, 2, '1', '01'],
    [2, 0, '0', '10'],
    [2, 3, '1', '11'],
    [3, 0, '0', '11'],
    [3, 1, '1', '11'],
  ],
}
const M1_SNAPSHOT = [
  'q0|0->q1/00',
  'q0|1->q2/11',
  'q1|0->q0/00',
  'q1|1->q2/01',
  'q2|0->q0/10',
  'q2|1->q3/11',
  'q3|0->q0/11',
  'q3|1->q1/11',
]

// Foto 1: Moore machine, two inputs, two outputs, one don't-care next state
const M3: FsmSpec = {
  model: 'moore',
  inputBits: 2,
  outputBits: 2,
  stateCount: 4,
  mooreOutputs: ['01', '10', '11', '00'],
  edges: [
    [0, 2, '00'],
    [0, 2, '01'],
    [0, 1, '10'],
    [0, 0, '11'],
    [1, 3, '00'],
    [1, 3, '01'],
    [1, 0, '10'],
    [1, 1, '11'],
    [2, 3, '00'],
    [2, 3, '01'],
    [2, 0, '10'],
    [2, 2, '11'],
    [3, 2, '00'],
    [3, 2, '01'],
    [3, 1, '10'],
    // (q3, input 11) stays the all don't-care row, exactly like the "xx" in the sheet
  ],
}

const M3_SNAPSHOT = [
  'q0|00->q2/-',
  'q0|01->q2/-',
  'q0|10->q1/-',
  'q0|11->q0/-',
  'q1|00->q3/-',
  'q1|01->q3/-',
  'q1|10->q0/-',
  'q1|11->q1/-',
  'q2|00->q3/-',
  'q2|01->q3/-',
  'q2|10->q0/-',
  'q2|11->q2/-',
  'q3|00->q2/-',
  'q3|01->q2/-',
  'q3|10->q1/-',
  'q3|11->pattern:xx/-',
]

// Extra FSM with six states, two inputs and partial patterns
const M4: FsmSpec = {
  model: 'mealy',
  inputBits: 2,
  outputBits: 2,
  stateCount: 6,
  edges: [
    [0, 5, '00', '01'],
    [0, 1, '01', '10'],
    [0, '00x', '10', '11'],
    [0, 2, '11', '00'],
    [1, '10x', '00', '11'],
    [1, 0, '01', '00'],
    [1, 3, '10', '01'],
    [1, 1, '11', '10'],
    [2, 4, '00', '00'],
    [2, '0x1', '01', '11'],
    [2, 0, '10', '01'],
    [2, 5, '11', '10'],
    [3, 1, '00', '10'],
    [3, 2, '01', '11'],
    [3, 3, '10', '00'],
    [3, 4, '11', '01'],
    [4, 0, '00', '11'],
    [4, 5, '01', '00'],
    [4, 2, '10', '01'],
    [4, '01x', '11', '10'],
    [5, 3, '00', '00'],
    [5, 4, '01', '01'],
    [5, 1, '10', '11'],
    [5, 0, '11', '10'],
  ],
}

// Output patterns: partial (1x) and fully unspecified (xx) Mealy outputs
const M5: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 3,
  edges: [
    [0, 1, '0', '1x'],
    [0, 2, '1', 'x1'],
    [1, 0, '0', '0x'],
    [1, 1, '1', 'xx'],
    [2, 2, '0', 'x0'],
    [2, 0, '1', '01'],
  ],
}
const M5_SNAPSHOT = [
  'q0|0->q1/1x',
  'q0|1->q2/x1',
  'q1|0->q0/0x',
  'q1|1->q1/xx',
  'q2|0->q2/x0',
  'q2|1->q0/01',
]

const FSM_SPECS: readonly { name: string; spec: FsmSpec; expected: string[] }[] = [
  { name: 'M2 (three states, Foto 4)', spec: M2, expected: M2_SNAPSHOT },
  { name: 'M1 (four states, Abb. 1.1)', spec: M1, expected: M1_SNAPSHOT },
  { name: 'M3 (Moore, Foto 1)', spec: M3, expected: M3_SNAPSHOT },
  { name: 'M4 (six states, patterns)', spec: M4, expected: [] },
  { name: 'M5 (output patterns)', spec: M5, expected: M5_SNAPSHOT },
]

describe('the FSM stays identical in table, central state and editor sync', () => {
  FSM_SPECS.forEach(({ name, spec, expected }) => {
    if (expected.length > 0) {
      it(`${name}: central state is exactly the drawn FSM`, () => {
        const state = createState(spec)
        expect(snapshot(state)).toEqual(expected)
      })
    }

    it(`${name}: central state keeps every invariant`, () => {
      const state = createState(spec)
      expectMatrix(state)
      expect(validateFsm(state).valid).toBe(true)
    })

    it(`${name}: table path (cell cycles) builds the same FSM`, () => {
      const drawn = createState(spec)
      const tableState = createState({ ...spec, edges: [] })
      tableState.transitions.forEach((_, index) => {
        const row = rowAt(tableState, index)
        const from = row.fromNodeId
        const input = row.input
        const source = findRow(drawn, from, input)
        clickTargetBitsUntil(tableState, index, targetPattern(drawn, source))
        if (spec.model !== 'moore') {
          clickOutputBitsUntil(tableState, index, source.mealyOutput ?? '')
        }
      })
      ensureTransitionMatrix(tableState)
      expectMatrix(tableState)
      expect(snapshot(tableState)).toEqual(snapshot(drawn))
      expect(validateFsm(tableState)).toEqual(validateFsm(drawn))
    })

    it(`${name}: editor payload roundtrip changes nothing`, () => {
      const state = createState(spec)
      const once = roundtrip(state)
      expectMatrix(once)
      expect(snapshot(once)).toEqual(snapshot(state))
      expect(validateFsm(once).valid).toBe(true)
      // second pass must be a fixed point as well, otherwise sync keeps drifting
      expect(snapshot(roundtrip(once))).toEqual(snapshot(state))
    })

    it(`${name}: moving states only carries coordinates`, () => {
      const state = createState(spec)
      state.nodes.forEach((node, index) => {
        node.editorCoordX = 40 * index + 10
        node.editorCoordY = 90 * index + 25
      })
      const moved = roundtrip(state)
      expect(snapshot(moved)).toEqual(snapshot(state))
      expect(moved.nodes.map((node) => node.editorCoordX)).toEqual(
        state.nodes.map((node) => node.editorCoordX),
      )
      expect(moved.nodes.map((node) => node.editorCoordY)).toEqual(
        state.nodes.map((node) => node.editorCoordY),
      )
      // swapping two positions must not touch the transitions either
      const swapped = createState(spec)
      nodeAt(swapped, 0).editorCoordX = 400
      nodeAt(swapped, swapped.nodes.length - 1).editorCoordX = 5
      expect(snapshot(roundtrip(swapped))).toEqual(snapshot(swapped))
    })

    it(`${name}: adding a state keeps every concrete target and pattern`, () => {
      const state = createState(spec)
      const concreteRows = snapshot(state).filter((row) => !row.includes('pattern:'))
      const patterns = state.transitions
        .map((transition) => ({
          key: `${nodeName(state, transition.fromNodeId)}|${transition.input}`,
          covered: coveredNames(state, transition),
        }))
        .filter((entry) => entry.covered !== null)

      addStateRow(state, spec.model)
      expectMatrix(state)
      // concrete rows must survive byte for byte, they may only gain the new state's rows
      concreteRows.forEach((row) => {
        expect(snapshot(state)).toContain(row)
      })
      // a partial pattern must still cover exactly the same states after the re-encoding
      patterns.forEach((entry) => {
        const [fromName, input] = entry.key.split('|')
        const now = state.transitions.find(
          (transition) =>
            nodeName(state, transition.fromNodeId) === fromName && transition.input === input,
        )
        expect(now).toBeDefined()
        expect(coveredNames(state, now as FsmTransition)).toEqual(entry.covered)
      })
      expect(validateFsm(state).valid).toBe(true)
      expect(state.nodeIdBitCount).toBe(calcBitNumber(state.nodes.length))
    })

    it(`${name}: deleting and re-adding the last state is reversible`, () => {
      const state = createState(spec)
      const lastId = state.nodes.length - 1
      removeStateRow(state, lastId)
      expectMatrix(state)
      state.transitions
        .filter((transition) => transition.removedTarget)
        .forEach((transition) => {
          expect(transition.toNodeId).toBe(-1)
          expect(transition.toBinaryId).toBeTruthy()
        })

      addStateRow(state, spec.model)
      expectMatrix(state)
      // the restored state reuses the id, so a dangling target must be resolved again
      expect(state.transitions.filter((transition) => transition.removedTarget)).toHaveLength(0)
      expect(validateFsm(state).valid).toBe(true)
    })
  })
})

describe('M2 (three states)', () => {
  it('encoded truth table matches the FSM by hand', () => {
    const table = exportFsmToTruthTable(createState(M2))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_0'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1', 'Y_0'])
    expect(table.values).toEqual([
      [0, 1, 0, 0], // 00 0 -> B (01), output 00
      [1, 0, 1, 1], // 00 1 -> C (10), output 11
      [0, 1, 0, 0], // 01 0 -> B (01), output 00
      [0, 0, 1, 1], // 01 1 -> A (00), output 11
      [0, 1, 0, 0], // 10 0 -> B (01), output 00
      [0, 0, 1, 1], // 10 1 -> A (00), output 11
      ['-', '-', '-', '-'], // unused encoding
      ['-', '-', '-', '-'], // unused encoding
    ])
  })

  it('the unused encoding stays a don\u2019t care for the minimization', () => {
    const table = exportFsmToTruthTable(createState(M2))
    const dontCareRows = table.values.filter((row) => row.every((cell) => cell === '-'))
    expect(dontCareRows).toHaveLength(2)
  })
})

describe('M3 (Moore, two inputs, one don\u2019t-care next state)', () => {
  it('encoded truth table uses the output of the target state and names it Y^(n+1)', () => {
    const table = exportFsmToTruthTable(createState(M3))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_1', 'X_0'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1', 'Y_0'])
    expect(table.values).toHaveLength(16)
    // (S0, 00) -> S2 (10) and the output comes from S2, which is 11
    expect(valueRow(table, 0)).toEqual([1, 0, 1, 1])
    // (S0, 10) -> S1 (01), output of S1 is 10
    expect(valueRow(table, 2)).toEqual([0, 1, 1, 0])
    // (S3, 11) is the don't care row of the sheet
    expect(valueRow(table, 15)).toEqual(['-', '-', '-', '-'])
  })

  it('names the output of every row Y, Mealy and Moore alike', () => {
    const table = exportFsmToTruthTable(createState(M2))
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1', 'Y_0'])
  })

  it('keeps a covered group with different outputs valid and unlocked', () => {
    const state = createState(M3)
    const row = findRow(state, 0, '00')
    row.toNodeId = -1
    // 1x covers the states q2 (11) and q3 (00), whose outputs differ
    row.toBinaryId = '1x'
    expect(validateFsm(state).valid).toBe(true)
    expect(resolveMooreOutput(state, row)).toBe('xx')
  })

  it('still locks a Moore row that names a state which does not exist', () => {
    const state = createState(specForCount(3, 'moore'))
    stateManager.state.fsm = state
    // index 3 has no state, and a don't care in the output cannot hide that
    writeRow(state, 0, '0', '11')
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason: 'The transition from "q0" with input 0 points at a non-existing state.',
    })

    writeRow(state, 0, '0', '01')
    expect(validateFsm(state).valid).toBe(true)
  })

  it('shows the shared output of a covered group and x when they differ', () => {
    const state = createState(M3)
    const row = findRow(state, 0, '00')
    row.toNodeId = -1
    row.toBinaryId = '1x'
    expect(resolveMooreOutput(state, row)).toBe('xx')
    row.toBinaryId = '01'
    expect(resolveMooreOutput(state, row)).toBe('10')
  })
})

describe('M4 (six states, patterns, two inputs)', () => {
  it('keeps partial patterns as hidden rows and leaves their cells as don\u2019t cares', () => {
    const state = createState(M4)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)

    const table = exportFsmToTruthTable(state)
    // three state bits plus two input bits -> 32 rows
    expect(table.inputVars).toHaveLength(5)
    expect(table.values).toHaveLength(32)
    // (q0, 10) covers q0 and q1 (pattern 00x) -> hidden, so every cell stays a don't care
    const row = findRow(state, 0, '10')
    expect(row.toBinaryId).toBe('00x')
    expect(isHiddenTransition(row)).toBe(true)
    expect(valueRow(table, 0b00010)).toEqual(['-', '-', '-', '-', '-'])
    // (q4, 11) covers q2 and q3 (pattern 01x) -> hidden as well
    expect(valueRow(table, 0b10011)).toEqual(['-', '-', '-', '-', '-'])
    // a drawn row of the same machine keeps its target and its output
    expect(valueRow(table, 0b00000)).toEqual([1, 0, 1, 0, 1])
  })

  it('survives a roundtrip without losing a pattern target', () => {
    const state = createState(M4)
    const once = roundtrip(state)
    expect(snapshot(once)).toEqual(snapshot(state))
    const patterned = once.transitions.filter((transition) => transition.toNodeId < 0)
    expect(patterned).toHaveLength(4)
    patterned.forEach((transition) => expect(transition.toBinaryId).toMatch(/^[01x]+$/))
  })

  it('deletes a state in the middle and keeps every remaining target', () => {
    // the editor can drop any state; the ids are compacted afterwards
    const state = createState(M4)
    const removedName = nodeName(state, 2)
    const payload = toEditorPayload(state)
    payload.states = payload.states.filter((entry) => entry.id !== 2)
    payload.transitions = payload.transitions.filter((entry) => entry.from !== 2)

    const { nodes, transitions } = importEditorPayload(payload, state)
    const compacted: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(compacted)
    expectMatrix(compacted)
    expect(compacted.nodes).toHaveLength(5)
    expect(compacted.nodes.some((node) => node.name === removedName)).toBe(false)

    // rows must never be repointed at a different state by the id compaction
    const targetBySource = (fsm: FsmState) =>
      new Map(
        fsm.transitions.map((transition) => {
          const target =
            transition.toNodeId >= 0
              ? nodeName(fsm, transition.toNodeId)
              : transition.removedTarget
                ? `removed:${transition.toBinaryId ?? ''}`
                : `pattern:${transition.toBinaryId ?? ''}`
          return [`${nodeName(fsm, transition.fromNodeId)}|${transition.input}`, target] as const
        }),
      )
    const before = targetBySource(state)
    const violations: string[] = []
    targetBySource(compacted).forEach((target, key) => {
      const previous = before.get(key)
      if (key.startsWith(`${removedName}|`)) {
        violations.push(`row of the removed state survived: ${key}`)
        return
      }
      if (previous === undefined) {
        violations.push(`unknown source row: ${key}`)
        return
      }
      // A row whose state vanished must be flagged instead of silently pointing elsewhere,
      // and a surviving target must keep its name - never a different state or a wider pattern
      if (target !== previous && !target.startsWith('removed:')) {
        violations.push(`${key}: ${previous} -> ${target}`)
      }
    })
    expect(violations).toEqual([])
  })
})

describe('central state guards', () => {
  it('never grows past the state limit', () => {
    const state = createState(M2)
    for (let index = state.nodes.length; index < MAX_FSM_STATES; index += 1) {
      addStateRow(state, 'mealy')
    }
    expect(state.nodes).toHaveLength(MAX_FSM_STATES)
    addStateRow(state, 'mealy')
    expect(state.nodes).toHaveLength(MAX_FSM_STATES)
    expectMatrix(state)
  })

  it('clamps the fixed input and output bit counts', () => {
    const state = createState(M2)
    setInputBitCount(state, 99)
    expect(state.inputBitCount).toBe(MAX_FSM_IO_BITS)
    setInputBitCount(state, 0)
    expect(state.inputBitCount).toBe(1)
    expectMatrix(state)
  })

  it('keeps the matrix complete when the input width changes', () => {
    const state = createState(M2)
    setInputBitCount(state, 2)
    expect(state.transitions).toHaveLength(state.nodes.length * 4)
    setInputBitCount(state, 1)
    expectMatrix(state)
  })

  it('rejects duplicate names and sanitizes unsafe ones', () => {
    const state = createState(M2)
    renameState(state, 1, nodeAt(state, 0).name)
    expect(nodeAt(state, 1).name).toBe('q1')
    renameState(state, 1, 'Start #1!')
    expect(nodeAt(state, 1).name).toBe('Start 1')
    expect(sanitizeStateName('a'.repeat(40)).length).toBeLessThanOrEqual(12)
  })

  it('names a new state with the smallest free number, never with a used one', () => {
    const state = createState(M2)
    // names can drift from the ids after an editor roundtrip
    state.nodes = [
      { ...nodeAt(state, 0), nodeId: 0, name: 'q0' },
      { ...nodeAt(state, 1), nodeId: 1, name: 'q2' },
      { ...nodeAt(state, 2), nodeId: 2, name: 'q3' },
    ]
    addStateRow(state, 'mealy')
    // the free id must not decide the name
    expect(state.nodes.map((node) => node.name)).toEqual(['q0', 'q2', 'q3', 'q1'])
  })

  it('replaces a duplicate imported name with the smallest free number', () => {
    const state = createState(M2)
    const payload = toEditorPayload(state)
    const firstName = payload.states[0]!.name
    payload.states[1] = { ...payload.states[1]!, name: firstName }

    const { nodes } = importEditorPayload(payload, state)
    const names = nodes.map((node) => node.name)
    expect(names).toEqual(['q0', 'q1', 'q2'])
    expect(new Set(names).size).toBe(names.length)
  })

  it('turns a removed target into a hidden row instead of locking the machine', () => {
    const state = createState(M2)
    removeStateRow(state, 2)
    const flagged = state.transitions.filter((transition) => transition.removedTarget)
    expect(flagged.length).toBeGreaterThan(0)
    // hidden rows are not drawn and not validated, so nothing locks here
    flagged.forEach((transition) => {
      expect(transition.toNodeId).toBe(-1)
      expect(isHiddenTransition(transition)).toBe(true)
      expect(needsHiddenCleanup(transition)).toBe(true)
    })
    expect(validateFsm(state).valid).toBe(true)
    // the encoding of the removed state is kept, so the row still reports what was meant
    const firstFlagged = flagged[0]
    if (!firstFlagged) throw new Error('no dangling target was flagged')
    expect(firstFlagged.toBinaryId).toBe('10')
  })

  it('resolves every target of an all don\u2019t-care row instead of locking', () => {
    const state = createState(M2)
    const row = findRow(state, 0, '1')
    row.toNodeId = -1
    row.toBinaryId = 'x'
    expect(validateFsm(state).valid).toBe(true)
    expect(resolveTransitionTargetNodes(state, row)).toHaveLength(state.nodes.length)
  })
})

describe('M5 (partial and don\u2019t-care outputs)', () => {
  it('carries output don\u2019t cares into the encoded table as don\u2019t cares', () => {
    const table = exportFsmToTruthTable(createState(M5))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_0'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1', 'Y_0'])
    expect(table.values).toEqual([
      [0, 1, 1, '-'], // q0 -0/1x-> q1
      [1, 0, '-', 1], // q0 -1/x1-> q2
      [0, 0, 0, '-'], // q1 -0/0x-> q0
      [0, 1, '-', '-'], // q1 -1/xx-> q1, the output is fully open
      [1, 0, '-', 0], // q2 -0/x0-> q2
      [0, 0, 0, 1], // q2 -1/01-> q0
      ['-', '-', '-', '-'], // unused encoding
      ['-', '-', '-', '-'], // unused encoding
    ])
  })

  it('cycles an output bit through 0, 1, x and back to 0', () => {
    const state = createState(M5)
    const row = findRow(state, 0, '0')
    row.mealyOutput = '00'
    const seen: string[] = []
    for (let step = 0; step < 4; step += 1) {
      seen.push(row.mealyOutput ?? '')
      toggleTransitionOutputBit(state, 0, 0)
    }
    expect(seen).toEqual(['00', '10', 'x0', '00'])
  })

  it('keeps a fully open output valid and unopinionated', () => {
    const state = createState(M5)
    const row = findRow(state, 1, '1')
    expect(row.mealyOutput).toBe('xx')
    expect(validateFsm(state).valid).toBe(true)
    // an open output must not narrow the minimization in the truth table
    expect(valueRow(exportFsmToTruthTable(state), 0b011).slice(2)).toEqual(['-', '-'])
  })
})

describe('truth table uses the same encoding as the state table', () => {
  const specForCount = (count: number): FsmSpec => ({
    model: 'mealy',
    inputBits: 1,
    outputBits: 1,
    stateCount: count,
    edges: [[0, Math.min(1, count - 1), '0', '1']],
  })

  it('keeps one state bit for a single state machine', () => {
    const state = createState(specForCount(1))
    // the table shows Z_0 for a single state, so the KV must use that bit as well
    expect(state.nodeIdBitCount).toBe(1)
    const table = exportFsmToTruthTable(state)
    expect(table.inputVars).toEqual(['Z_0^n', 'X_0'])
    expect(table.outputVars).toEqual(['Z_0^(n+1)', 'Y_0'])
    expect(table.values).toHaveLength(4)
    expect(valueRow(table, 0b00)).toEqual([0, 1])
    // the encoding that no state uses stays open instead of colliding with state 0
    expect(valueRow(table, 0b01)).toEqual(['-', '-'])
    expect(valueRow(table, 0b10)).toEqual(['-', '-'])
    expect(valueRow(table, 0b11)).toEqual(['-', '-'])
  })

  it('keeps the width of the state table for every state count', () => {
    const bitsByCount: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 8: 3, 9: 4 }
    Object.entries(bitsByCount).forEach(([count, bits]) => {
      const state = createState(specForCount(Number(count)))
      expect(state.nodeIdBitCount).toBe(bits)
      const table = exportFsmToTruthTable(state)
      // one variable per state bit plus the input bits, and no row may be lost
      expect(table.inputVars).toHaveLength(bits + 1)
      expect(table.values).toHaveLength(2 ** table.inputVars.length)
      const widths = new Set(table.values.map((row) => row.length))
      expect([...widths]).toEqual([table.outputVars.length])
    })
  })
})

describe('logic circuits export follows the minimized KV functions', () => {
  const expectedFlipFlops: Record<string, number> = { M1: 2, M2: 2, M3: 2, M4: 3, M5: 2 }

  it('builds one D flip-flop per state bit for every FSM', () => {
    FSM_SPECS.forEach(({ name, spec }) => {
      const lc = stateMachineToLC(createState(spec), { encoding: 'Binary', flipFlopType: 'D' })
      const flipFlops = lc.elements.filter((element) => element.elementType === D_FLIPFLOP)
      expect(flipFlops).toHaveLength(expectedFlipFlops[name.slice(0, 2)] ?? -1)
    })
  })

  it('implements the minimized next-state term of M2 with one three-literal AND', () => {
    const lc = stateMachineToLC(createState(M2), { encoding: 'Binary', flipFlopType: 'D' })
    const andGates = lc.elements.filter((element) => element.elementType === AND_GATE)
    // Z_1^(n+1) = !Z_1 !Z_0 X -> a single AND with two inverted inputs
    const threeInput = andGates.filter((element) => element.inPorts.length === 3)
    expect(threeInput).toHaveLength(1)
    expect([...(threeInput[0]?.inPorts ?? '')].sort().join('')).toBe('iin')
    // Z_0^(n+1) = !X and Y_1 = Y_0 = X need no multi-literal OR: extra terms would change the logic
    const multiInputOr = lc.elements.filter(
      (element) => element.elementType === OR_GATE && element.inPorts.length > 1,
    )
    expect(multiInputOr).toHaveLength(0)
    expect(andGates.every((element) => element.inPorts.length <= 3)).toBe(true)
  })

  it('derives JK excitation equations without changing the FSM', () => {
    const state = createState(M2)
    const lc = stateMachineToLC(state, { encoding: 'Binary', flipFlopType: 'JK' })
    const jkFlipFlops = lc.elements.filter((element) => element.elementType === JK_FLIPFLOP)
    expect(jkFlipFlops).toHaveLength(2)
    // the FSM itself stays untouched by building a circuit from it
    expect(snapshot(state)).toEqual(M2_SNAPSHOT)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('follows the standard JK excitation table for every flip-flop input', () => {
    const lc = stateMachineToLC(createState(M2), { encoding: 'Binary', flipFlopType: 'JK' })
    const twoLiteralAnds = lc.elements
      .filter((element) => element.elementType === AND_GATE && element.inPorts.length === 2)
      .map((element) => [...element.inPorts].sort().join(''))
      .sort()

    // Z_1^(n+1) = !Z_1 !Z_0 X and Z_0^(n+1) = !X, so
    //   J_1 = !Z_0 X (one literal inverted), K_1 = 1 (constant)
    //   J_0 = !X, K_0 = X, because the excitation is a don't care while the bit holds
    // Only J_1 needs a gate, and a wrong excitation table would change this set
    expect(twoLiteralAnds).toEqual(['in'])
    expect(lc.elements.filter((element) => element.elementType === JK_FLIPFLOP)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Cross cutting guards: state counts, state set changes, don't cares, imports
// ---------------------------------------------------------------------------

// Spec with one concrete edge, usable for any state count
function specForCount(count: number, model: FsmModel = 'mealy'): FsmSpec {
  return {
    model,
    inputBits: 1,
    outputBits: 1,
    stateCount: count,
    edges: count > 1 ? [[0, 1, '0', '1']] : [[0, 0, '0', '1']],
  }
}

// Writes one row the way a table cell click does
function writeRow(
  state: FsmState,
  from: number,
  input: string,
  target: number | string,
  output?: string,
): void {
  applyEdges(state, [[from, target, input, output]])
}

describe('bit widths for every state count', () => {
  it('calcBitNumber matches the ids actually used', () => {
    expect([1, 2, 3, 4, 5, 8, 9, 16].map((count) => calcBitNumber(count))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ])
  })

  it('normalizeBits never returns more than the requested width', () => {
    // width 0 means "no bits"; slice(-0) would otherwise hand back the whole string
    expect(normalizeBits('101', 0, '0', 'left')).toBe('')
    expect(normalizeBits('1010', 2, 'x', 'left')).toBe('10')
    expect(normalizeBits('1', 3, 'x', 'right')).toBe('1xx')
  })

  it('keeps the central state consistent when add and remove cross powers of two', () => {
    for (const count of [1, 2, 3, 4, 5, 8, 15, 16]) {
      const state = createState(specForCount(count))
      removeStateRow(state, count - 1)
      addStateRow(state, 'mealy')
      expectMatrix(state)
      expect(validateFsm(state).valid).toBe(true)
    }
  })
})

describe('editor side changes of the state set', () => {
  it('an editor side removal (compacted ids) keeps the surviving rows intact', () => {
    const state = createState(M5)
    const payload = toEditorPayload(state)
    // the editor removes a state together with its edges, then the ids are compacted
    payload.states = payload.states.filter((entry) => entry.id !== 1)
    payload.transitions = payload.transitions.filter((entry) => entry.from !== 1 && entry.to !== 1)

    const { nodes, transitions } = importEditorPayload(payload, state)
    const compacted: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(compacted)
    expectMatrix(compacted)
    expect(compacted.nodes).toHaveLength(2)
    expect(validateFsm(compacted).valid).toBe(true)
    // the surviving rows keep their target name and their output, nothing is repointed
    expect(snapshot(compacted)).toContain('q0|1->q2/x1')
    expect(snapshot(compacted)).toContain('q2|0->q2/x0')
    expect(compacted.transitions.filter((transition) => transition.removedTarget)).toHaveLength(0)
  })

  it('an editor side add (new id) keeps the matrix complete', () => {
    const state = createState(M2)
    const payload = toEditorPayload(state)
    payload.states.push({
      id: 3,
      name: 'q3',
      initial: false,
      x: undefined,
      y: undefined,
      moore_output: '',
    })

    const { nodes, transitions } = importEditorPayload(payload, state)
    const grown: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(grown)
    expectMatrix(grown)
    expect(grown.nodes).toHaveLength(4)
    expect(grown.nodeIdBitCount).toBe(2)
    // the old rows survive the width growth
    expect(snapshot(grown)).toEqual(expect.arrayContaining(M2_SNAPSHOT))
  })

  it('clearing a row in the editor leaves an unassigned don\u2019t-care row', () => {
    const state = createState(M2)
    const payload = toEditorPayload(state)
    // the editor drops the arrow for (q0, input 1): no transition comes back for that row
    payload.transitions = payload.transitions.filter(
      (entry) => !(entry.from === 0 && entry.input === '1'),
    )
    const { nodes, transitions } = importEditorPayload(payload, state)
    const after: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(after)
    expectMatrix(after)

    const cleared = findRow(after, 0, '1')
    expect(cleared.toNodeId).toBe(-1)
    expect(cleared.toBinaryId).toBe('x'.repeat(after.nodeIdBitCount))
    expect(cleared.removedTarget).toBeFalsy()
    expect(validateFsm(after).valid).toBe(true)
    // the untouched row stays exactly as it was
    expect(snapshot(after)).toContain('q0|0->q1/00')
  })

  it('removing one of several edges leaves the others untouched', () => {
    const state = createState(M2)
    const payload = toEditorPayload(state)
    payload.transitions = payload.transitions.filter(
      (entry) => !(entry.from === 1 && entry.input === '0'),
    )
    const { nodes, transitions } = importEditorPayload(payload, state)
    const after: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(after)

    expect(snapshot(after)).toContain('q0|0->q1/00')
    expect(snapshot(after)).toContain('q0|1->q2/11')
    expect(findRow(after, 1, '0').toNodeId).toBe(-1)
    expect(validateFsm(after).valid).toBe(true)
  })

  it('ignores a partial pattern over a missing state but locks on a concrete one', () => {
    const state = createState(specForCount(3))
    // "1x" would also cover index 11, which has no state, but the row is hidden
    writeRow(state, 0, '0', '1x')
    expect(isHiddenTransition(findRow(state, 0, '0'))).toBe(true)
    expect(validateFsm(state).valid).toBe(true)

    // the same bits fully concrete name a state that does not exist
    writeRow(state, 0, '0', '11')
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason: 'The transition from "q0" with input 0 points at a non-existing state.',
    })

    writeRow(state, 0, '0', '01')
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })
})

describe('truth table for every state count', () => {
  it('rows always match the declared output columns', () => {
    for (const count of [1, 2, 3, 4, 5, 8, 15, 16]) {
      const table = exportFsmToTruthTable(createState(specForCount(count)))
      expect(table.inputVars).toHaveLength(calcBitNumber(count) + 1)
      expect(table.values).toHaveLength(2 ** table.inputVars.length)
      const widths = new Set(table.values.map((row) => row.length))
      expect([...widths]).toEqual([table.outputVars.length])
    }
  })

  it('uses the same encoding width as the state table (no row collisions)', () => {
    // a state set that skips an id must widen the encoding instead of colliding rows
    const nodes: FsmNode[] = [0, 2].map((nodeId, index) => ({
      nodeId,
      name: `q${index}`,
      isInitial: index === 0,
    }))
    const state: FsmState = {
      nodes,
      transitions: [],
      fsmModel: 'mealy',
      nodeIdBitCount: calcBitNumber(3),
      inputBitCount: 1,
      outputBitCount: 1,
    }
    ensureTransitionMatrix(state)
    writeRow(state, 2, '0', 2, '1')

    const table = exportFsmToTruthTable(state)
    expect(table.inputVars).toHaveLength(state.nodeIdBitCount + 1)
    expect(table.values).toHaveLength(2 ** table.inputVars.length)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('leaves the unused encodings as don\u2019t care rows', () => {
    const state = createState(specForCount(3))
    const table = exportFsmToTruthTable(state)
    // the encoding 11 has no state, so its two rows stay fully open
    expect(valueRow(table, 6).every((cell) => cell === '-')).toBe(true)
    expect(valueRow(table, 7).every((cell) => cell === '-')).toBe(true)
  })
})

describe('import hardening', () => {
  it('keeps node Moore outputs at the configured width through a round trip', () => {
    const state = createState({
      model: 'moore',
      inputBits: 1,
      outputBits: 3,
      stateCount: 2,
      edges: [[0, 1, '0']],
      mooreOutputs: ['101', '010'],
    })
    const next = roundtrip(state)
    expect(next.nodes.map((node) => node.mooreOutput)).toEqual(['101', '010'])
  })

  it('reads a short stored Moore output at the configured width', () => {
    const state = createState({
      model: 'moore',
      inputBits: 1,
      outputBits: 3,
      stateCount: 2,
      edges: [[0, 1, '0']],
    })
    nodeAt(state, 1).mooreOutput = '1'
    // the row of (q0, input 0) targets q1; a short output is filled at the end, so "1" is y1
    expect(valueRow(exportFsmToTruthTable(state), 0).slice(-3)).toEqual([1, '-', '-'])
  })

  it('aligns short input and output bits exactly like the panel payload', () => {
    const state = createState({
      model: 'mealy',
      inputBits: 2,
      outputBits: 2,
      stateCount: 3,
      edges: [[0, 1, '00', '00']],
    })
    // storage can hold a short value; the panel pads it at the end before the editor sees it
    rowAt(state, 0).input = '1'
    rowAt(state, 0).mealyOutput = '1'

    const mine = toEditorPayload(state).transitions[0]!
    const panel = buildFsmImportPayload(state).transitions[0]!
    expect(mine.input).toBe(panel.input)
    expect(mine.mealy_output).toBe(panel.mealy_output)
    expect(mine.input).toBe('1x')
    expect(mine.mealy_output).toBe('1x')
  })

  it('never builds an empty transition matrix from a 0 bit count', () => {
    const state = createState(M2)
    state.inputBitCount = 0
    const payload = { states: [{ id: 0, name: 'q0', initial: true }], transitions: [] }
    const { transitions } = importEditorPayload(payload, state)
    expect(transitions.length).toBeGreaterThan(0)
  })
})

describe('Moore output editing', () => {
  it('toggles every state an open row resolves to', () => {
    const state = createState(specForCount(3, 'moore'))
    const index = state.transitions.findIndex((t) => t.fromNodeId === 0 && t.input === '0')
    // open the row, so it covers all three states and all of them follow the toggle cycle
    writeRow(state, 0, '0', 'xx')
    expect(resolveMooreOutput(state, rowAt(state, index))).toBe('x')

    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['0', '0', '0'])
    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['1', '1', '1'])
    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['x', 'x', 'x'])
    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['0', '0', '0'])
  })

  it('changes only the state a concrete row points at', () => {
    const state = createState(specForCount(3, 'moore'))
    const index = state.transitions.findIndex((t) => t.fromNodeId === 0 && t.input === '0')
    writeRow(state, 0, '0', 0)
    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['0', 'x', 'x'])
  })

  it('resolves a disagreeing group with one click', () => {
    const state = createState(specForCount(3, 'moore'))
    const index = state.transitions.findIndex((t) => t.fromNodeId === 0 && t.input === '0')
    nodeAt(state, 0).mooreOutput = '0'
    nodeAt(state, 1).mooreOutput = '1'
    // covers the states 0 and 1, whose outputs conflict before the click
    writeRow(state, 0, '0', '0x')
    expect(resolveMooreOutput(state, rowAt(state, index))).toBe('x')

    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['0', '0', 'x'])
    expect(resolveMooreOutput(state, rowAt(state, index))).toBe('0')
  })

  it('keeps a hidden Moore row open while its output edit still reaches drawn rows', () => {
    const state = createState(specForCount(3, 'moore'))
    writeRow(state, 0, '1', '0x') // hidden: covers q0 and q1
    writeRow(state, 1, '0', 1) // drawn: q1 -0-> q1
    const hiddenRow = findRow(state, 0, '1')

    expect(isHiddenTransition(hiddenRow)).toBe(true)
    expect(validateFsm(state).valid).toBe(true)
    // before the edit q1 still has an open output, so the drawn row is open as well
    expect(valueRow(exportFsmToTruthTable(state), 0b010)).toEqual([0, 1, '-'])

    toggleMooreOutputBit(state, state.transitions.indexOf(hiddenRow), 0)

    // the hidden row itself stays a full don't care in the table
    expect(valueRow(exportFsmToTruthTable(state), 0b001)).toEqual(['-', '-', '-'])
    // the output belongs to the states, so the drawn row that targets q1 follows the edit
    expect(nodeAt(state, 1).mooreOutput).toBe('0')
    expect(valueRow(exportFsmToTruthTable(state), 0b010)).toEqual([0, 1, 0])
  })

  it('leaves a row without a target to the invalid panels', () => {
    const state = createState(specForCount(3, 'moore'))
    const index = state.transitions.findIndex((t) => t.fromNodeId === 0 && t.input === '0')
    rowAt(state, index).removedTarget = true

    toggleMooreOutputBit(state, index, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['x', 'x', 'x'])
  })
})

// ---------------------------------------------------------------------------
// Editor internals: the Konva/jotai side the app cannot reach directly
// ---------------------------------------------------------------------------

type TweenConfig = { onFinish?: () => void }

// Loads the konva instance the editor submodule itself resolves, so its tweens can be stubbed
async function loadEditorKonva(): Promise<Record<string, unknown>> {
  // konva from the submodule when installed, otherwise from the app
  const submoduleEntry = '../../public/fsm-engine/node_modules/konva/lib/index.js'
  try {
    const mod = await import(/* @vite-ignore */ submoduleEntry)
    return mod.default as unknown as Record<string, unknown>
  } catch {
    const mod = await import('konva')
    return mod.default as unknown as Record<string, unknown>
  }
}

// Stubs Konva.Tween/Animation so a layout run can be driven without a real canvas
async function withStubbedKonva<T>(run: (tweens: TweenConfig[]) => Promise<T> | T): Promise<T> {
  const konva = await loadEditorKonva()
  const realTween = konva.Tween
  const realAnimation = konva.Animation
  const tweens: TweenConfig[] = []

  Object.defineProperty(konva, 'Tween', {
    value: class {
      constructor(config: TweenConfig) {
        tweens.push(config)
      }
      play() {}
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(konva, 'Animation', {
    value: class {
      start() {}
      stop() {}
    },
    configurable: true,
    writable: true,
  })

  try {
    return await run(tweens)
  } finally {
    Object.defineProperty(konva, 'Tween', { value: realTween, configurable: true, writable: true })
    Object.defineProperty(konva, 'Animation', {
      value: realAnimation,
      configurable: true,
      writable: true,
    })
  }
}

// Minimal Konva stage double; `missingId` simulates a state whose shape is not drawn (yet)
function fakeStage(missingId: number | null = null) {
  return {
    width: () => 800,
    height: () => 600,
    x: () => 0,
    y: () => 0,
    scaleX: () => 1,
    findOne: (selector: string) =>
      selector === `#state_${missingId}` ? null : { x: () => 0, y: () => 0 },
  }
}

// Swap in a fake parent frame for one call and always put jsdom's own window back,
// so a late editor timer never posts into an undefined parent
function withCapturedParentMessages(run: () => void): unknown[] {
  const messages: unknown[] = []
  const original = Object.getOwnPropertyDescriptor(window, 'parent')
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: { postMessage: (message: unknown) => messages.push(message) },
  })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(window, 'parent', original)
    else delete (window as unknown as Record<string, unknown>).parent
  }
  return messages
}

describe('editor internals', () => {
  it('asks the app to create a state instead of minting an id itself', async () => {
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const editor = await import('../../public/fsm-engine/src/lib/editor.js')
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const stores = await import('../../public/fsm-engine/src/lib/stores.js')
    const { store, node_list, editor_state } = stores

    store.set(node_list, [])
    store.set(editor_state, 'Add')

    const clickEvent = {
      target: {
        getStage: () => ({
          findOne: () => ({ getRelativePointerPosition: () => ({ x: 10, y: 20 }) }),
        }),
      },
    }

    const messages = withCapturedParentMessages(() => editor.HandleEditorClick(clickEvent))

    // the editor asks, it does not create
    expect(messages).toEqual([{ action: 'add-state-request', x: 10, y: 20 }])
    expect(store.get(node_list)).toEqual([])
  })

  it('asks the app to remove a state instead of deleting it locally', async () => {
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const editor = await import('../../public/fsm-engine/src/lib/editor.js')
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const stores = await import('../../public/fsm-engine/src/lib/stores.js')
    const { store, node_list, editor_state } = stores

    store.set(node_list, [
      { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
      { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
    ])
    store.set(editor_state, 'Remove')

    const messages = withCapturedParentMessages(() =>
      editor.HandleStateClick({ cancelBubble: false, evt: { button: 0 } }, 1),
    )

    expect(messages).toEqual([{ action: 'remove-state-request', id: 1 }])
    // the app removes the state, so the editor keeps its nodes
    expect(store.get(node_list)).toHaveLength(2)
  })

  it('auto layout ignores hidden don\u2019t-care edges', async () => {
    await withStubbedKonva(async (tweens) => {
      // @ts-expect-error - the editor submodule ships plain JS without type declarations
      const stores = await import('../../public/fsm-engine/src/lib/stores.js')
      // @ts-expect-error - the editor submodule ships plain JS without type declarations
      const editor = await import('../../public/fsm-engine/src/lib/editor.js')
      const { store, node_list, transition_list, stage_ref } = stores

      const layout = (transitions: unknown[]) => {
        store.set(stage_ref, fakeStage())
        store.set(node_list, [
          { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
          { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
        ])
        store.set(transition_list, transitions)
        tweens.length = 0
        editor.HandleAutoLayout()
        tweens.forEach((tween) => tween.onFinish?.())
        return (store.get(node_list) as Array<{ x: number; y: number } | undefined>).map((node) =>
          node ? [node.x, node.y] : undefined,
        )
      }

      const edge = { id: 1, from: 0, to: 1, points: [], label: '0/0' }
      const hidden = { id: 2, from: 0, to: -1, points: [], label: '1/-', hiddenDontCare: true }

      const withoutHidden = layout([edge])
      const withHidden = layout([edge, hidden])

      // a hidden don't-care row has no target state and must not distort the layout
      expect(withHidden).toEqual(withoutHidden)
    })
  })

  it('auto layout still commits positions when a node shape is missing', async () => {
    await withStubbedKonva(async (tweens) => {
      // @ts-expect-error - the editor submodule ships plain JS without type declarations
      const stores = await import('../../public/fsm-engine/src/lib/stores.js')
      // @ts-expect-error - the editor submodule ships plain JS without type declarations
      const editor = await import('../../public/fsm-engine/src/lib/editor.js')
      const { store, node_list, transition_list, stage_ref } = stores

      const layout = (missingId: number | null) => {
        store.set(stage_ref, fakeStage(missingId))
        store.set(node_list, [
          { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
          { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
        ])
        store.set(transition_list, [{ id: 1, from: 0, to: 1, points: [], label: '0/0' }])
        tweens.length = 0
        editor.HandleAutoLayout()
        tweens.forEach((tween) => tween.onFinish?.())
        return (store.get(node_list) as Array<{ x: number; y: number } | undefined>).map((node) =>
          node ? [node.x, node.y] : undefined,
        )
      }

      const complete = layout(null)
      const missingShape = layout(1)

      expect(complete[0]).not.toEqual([0, 0])
      // a state without a drawn shape must not swallow the whole commit
      expect(missingShape).toEqual(complete)
    })
  })
})

// ---------------------------------------------------------------------------
// End to end over the real wire format: app -> payload -> editor -> export -> app
// ---------------------------------------------------------------------------

async function throughEditor(state: FsmState): Promise<FsmState> {
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const editorStore = await import('../../public/fsm-engine/src/lib/stores.js')
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const editorExport = await import('../../public/fsm-engine/src/lib/export.js')

  editorExport.clearFsmFromParent()
  // No canvas in the tests, so the render cleanup must stay out of the way
  editorStore.store.set(editorStore.stage_ref, null)
  editorExport.applyFsmImport(buildFsmImportPayload(state))
  const { nodes, transitions } = importEditorPayload(editorExport.extractFsmData(), state)

  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}

describe('state requests sync through the editor', () => {
  function useFsm(spec: FsmSpec): FsmState {
    const state = createState(spec)
    stateManager.state.fsm = state
    return state
  }

  it('adds the requested state and keeps it through the editor', async () => {
    const state = useFsm(M2)
    FsmProject.addStateFromEditor(120, 240)

    expect(state.nodes).toHaveLength(4)
    expect(state.nodes[3]).toMatchObject({ name: 'q3', editorCoordX: 120, editorCoordY: 240 })

    const synced = await throughEditor(state)
    expect(snapshot(synced)).toEqual(snapshot(state))
    expect(synced.nodes[3]).toMatchObject({ name: 'q3', editorCoordX: 120, editorCoordY: 240 })
    expect(validateFsm(synced).valid).toBe(true)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  it('keeps a narrowed target through the real editor roundtrip', async () => {
    const state = useFsm(specForCount(4))
    writeRow(state, 0, '0', 'x0')
    FsmProject.removeStateFromEditor(2)

    expect(findRow(state, 0, '0').toNodeId).toBe(0)
    const synced = await throughEditor(state)
    expect(snapshot(synced)).toEqual(snapshot(state))
    expect(validateFsm(synced).valid).toBe(true)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  it('names an added state after the free number, not after its id', async () => {
    const state = useFsm(specForCount(3))
    // names can drift from the ids after an editor roundtrip
    state.nodes = [
      { ...state.nodes[0]!, name: 'q0' },
      { ...state.nodes[1]!, name: 'q2' },
      { ...state.nodes[2]!, name: 'q3' },
    ]

    FsmProject.addStateFromEditor(10, 20)
    expect(state.nodes.map((node) => node.name)).toEqual(['q0', 'q2', 'q3', 'q1'])

    const names = (await throughEditor(state)).nodes.map((node) => node.name)
    expect(names).toEqual(['q0', 'q2', 'q3', 'q1'])
    expect(new Set(names).size).toBe(names.length)
  })

  it('removes the requested state with its edges and keeps the other targets', async () => {
    const state = useFsm(M4)
    FsmProject.removeStateFromEditor(2)

    expect(state.nodes).toHaveLength(5)
    // the removed state is gone, the others keep the names they had
    expect(state.nodes.map((node) => node.name)).toEqual(['q0', 'q1', 'q3', 'q4', 'q5'])
    // rows that reached the removed state lose it, the others keep their target
    expect(snapshot(state)).toContain('q0|00->q5/01')
    expect(snapshot(state)).toContain('q0|01->q1/10')
    expect(snapshot(state)).toContain('q0|10->pattern:00x/11')
    expect(snapshot(state)).toContain('q4|11->q3/10')
    expect(snapshot(state).some((row) => row.includes('q2'))).toBe(false)
    expect(validateFsm(state).valid).toBe(true)

    const synced = await throughEditor(state)
    expect(snapshot(synced)).toEqual(snapshot(state))
    expect(validateFsm(synced).valid).toBe(true)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  // A table-removed target keeps its hidden marker through the real editor roundtrip: the payload
  // must not turn the stale, truncated pattern into a wrong concrete edge
  it('keeps a target removed in the table hidden through the real editor roundtrip', async () => {
    const state = useFsm(M2)
    removeStateRow(state, 2)

    const flagged = findRow(state, 0, '1')
    expect(flagged.removedTarget).toBe(true)
    // the marker remembers the removed index in the old bit width, so it can restore on re-add
    expect(flagged.toBinaryId).toBe('10')
    expect(validateFsm(state).valid).toBe(true)

    const synced = await throughEditor(state)
    // the row must stay a hidden marker, never silently point at another state
    const syncedRow = findRow(synced, 0, '1')
    expect(syncedRow.removedTarget).toBe(true)
    expect(syncedRow.toNodeId).toBe(-1)
    expect(isHiddenTransition(syncedRow)).toBe(true)
    expect(validateFsm(synced).valid).toBe(true)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  it('stays valid when a state is added back after an editor-side removal', async () => {
    const state = useFsm(M4)
    FsmProject.removeStateFromEditor(2)
    FsmProject.addStateFromEditor(60, 60)

    expect(state.nodes).toHaveLength(6)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)

    const synced = await throughEditor(state)
    expect(snapshot(synced)).toEqual(snapshot(state))
    expect(validateFsm(synced).valid).toBe(true)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  it('canonicalizes a duplicate name on import and sends it back without drift', async () => {
    const state = useFsm(M2)
    const payload = buildFsmImportPayload(state)
    payload.states[1] = { ...payload.states[1]!, name: payload.states[0]!.name }

    const { nodes, transitions } = importEditorPayload(payload, state)
    const canonical: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(canonical)

    const names = canonical.nodes.map((node) => node.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names[1]).toBe('q1')

    const synced = await throughEditor(canonical)
    expect(synced.nodes.map((node) => node.name)).toEqual(names)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))
  })

  it('keeps the machine valid when the removed state is added back', () => {
    const state = useFsm(specForCount(4))
    // a row that reaches the states with the index 00 and 10 through a partial pattern
    writeRow(state, 0, '0', 'x0')
    expect(validateFsm(state).valid).toBe(true)

    // the editor removes the state with the index 10, so the row keeps what is left
    FsmProject.removeStateFromEditor(2)
    expect(state.nodes.map((node) => node.nodeId)).toEqual([0, 1, 2])
    expect(snapshot(state)).toContain('q0|0->q0/1')
    expect(validateFsm(state).valid).toBe(true)

    // adding a state again may not lock anything either
    FsmProject.addStateFromEditor(100, 100)
    ensureTransitionMatrix(state)
    expect(state.nodes.map((node) => node.nodeId)).toEqual([0, 1, 2, 3])
    expect(validateFsm(state).valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The app and the editor talk over strings, so a rename there must fail loudly
// ---------------------------------------------------------------------------
describe('app <-> editor protocol', () => {
  it('posts the action name the editor listener compares against', async () => {
    stateManager.state.fsm = createState(M2)

    const posted: { action?: string; fsm?: unknown }[] = []
    const globalWindow = window as unknown as Record<string, unknown>
    globalWindow.__fsm_preloaded_iframe = {
      contentWindow: { postMessage: (message: (typeof posted)[number]) => posted.push(message) },
    }

    try {
      forceSyncTableToEditor()
      expect(posted).toHaveLength(1)
      expect(posted[0]?.action).toBe('fsmimport')

      // The editor side is plain JS, so the action names can only be paired textually
      const editorSource = await readFile('public/fsm-engine/src/lib/export.js', 'utf8')
      expect(editorSource).toContain(`action !== '${posted[0]?.action}'`)
    } finally {
      delete globalWindow.__fsm_preloaded_iframe
    }
  })
})

// ---------------------------------------------------------------------------
// An editor-side removal drops the state with its edges, so the rows stay exact
// ---------------------------------------------------------------------------

describe('editor-side removal keeps the rows exact', () => {
  function removeFromEditor(spec: FsmSpec, nodeId: number): FsmState {
    const state = createState(spec)
    stateManager.state.fsm = state
    FsmProject.removeStateFromEditor(nodeId)
    expectMatrix(state)
    return state
  }

  it('unassigns a row whose only target was removed', () => {
    const state = removeFromEditor(M2, 2)
    expect(state.nodes.map((node) => node.name)).toEqual(['q0', 'q1'])

    const row = findRow(state, 0, '1')
    expect(row.toNodeId).toBe(-1)
    expect(row.toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
    expect(row.removedTarget).toBeFalsy()
    expect(validateFsm(state).valid).toBe(true)
  })

  it('narrows a pattern to the states that are left', () => {
    const state = createState(specForCount(4))
    stateManager.state.fsm = state
    writeRow(state, 0, '0', 'x0')
    FsmProject.removeStateFromEditor(2)

    expect(findRow(state, 0, '0').toNodeId).toBe(0)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('unassigns a pattern whose survivors are no subcube', () => {
    const state = createState({
      model: 'mealy',
      inputBits: 1,
      outputBits: 1,
      stateCount: 8,
      edges: [],
    })
    stateManager.state.fsm = state
    writeRow(state, 0, '0', 'x0x')
    FsmProject.removeStateFromEditor(1)

    const row = findRow(state, 0, '0')
    expect(row.toNodeId).toBe(-1)
    expect(row.toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
    expect(validateFsm(state).valid).toBe(true)
  })

  it('keeps a pattern that loses nothing', () => {
    const state = createState(specForCount(4))
    stateManager.state.fsm = state
    writeRow(state, 1, '0', '0x')
    FsmProject.removeStateFromEditor(3)

    expect(findRow(state, 1, '0').toBinaryId).toBe('0x')
    expect(validateFsm(state).valid).toBe(true)
  })

  it('drops the rows of the removed state and keeps the coordinates', () => {
    const state = createState(M2)
    stateManager.state.fsm = state
    state.nodes.forEach((node, index) => {
      node.editorCoordX = 10 * index
      node.editorCoordY = 20 * index
    })
    FsmProject.removeStateFromEditor(1)

    expect(snapshot(state).some((row) => row.startsWith('q1|'))).toBe(false)
    expect(state.nodes.map((node) => [node.editorCoordX, node.editorCoordY])).toEqual([
      [0, 0],
      [20, 40],
    ])
  })

  it('survives removing the only state', () => {
    const state = removeFromEditor(specForCount(1), 0)
    expect(state.nodes).toHaveLength(0)
    expect(state.transitions).toHaveLength(0)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('narrows a Moore pattern to the states that are left', () => {
    const state = createState({
      ...specForCount(4, 'moore'),
      mooreOutputs: ['0', '0', '1', '0'],
    })
    stateManager.state.fsm = state
    writeRow(state, 0, '0', 'x0')
    expect(validateFsm(state).valid).toBe(true)

    FsmProject.removeStateFromEditor(2)

    expect(findRow(state, 0, '0').toNodeId).toBe(0)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('stays compact and stable over repeated remove and add cycles', () => {
    const state = createState(specForCount(5))
    stateManager.state.fsm = state

    for (let cycle = 0; cycle < 3; cycle += 1) {
      FsmProject.removeStateFromEditor(4)
      expect(state.nodes.map((node) => node.nodeId)).toEqual([0, 1, 2, 3])
      expectMatrix(state)
      expect(validateFsm(state).valid).toBe(true)

      FsmProject.addStateFromEditor()
      expectMatrix(state)
      expect(validateFsm(state).valid).toBe(true)
    }

    expect(state.nodes.map((node) => node.name)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4'])
    expect(snapshot(roundtrip(state))).toEqual(snapshot(state))
  })
})

// ---------------------------------------------------------------------------
// Remove and add for every small state count in both models, plus the lock/unlock
// ---------------------------------------------------------------------------

function specForSize(count: number, model: FsmModel): FsmSpec {
  const edges: FsmSpec['edges'] =
    count >= 2 ? [[0, 1, '0', '1']] : count === 1 ? [[0, 0, '0', '1']] : []
  return { model, inputBits: 1, outputBits: 1, stateCount: count, edges }
}

function useSize(count: number, model: FsmModel): FsmState {
  const state = createState(specForSize(count, model))
  stateManager.state.fsm = state
  return state
}

function compactIds(state: FsmState): number[] {
  return state.nodes.map((node) => node.nodeId)
}

function namesOf(state: FsmState): string[] {
  return state.nodes.map((node) => node.name)
}

describe('remove and add for every small state count and model', () => {
  const MODELS: readonly FsmModel[] = ['mealy', 'moore']

  it('adds a state to an empty machine', () => {
    const state = useSize(0, 'mealy')
    expect(validateFsm(state).valid).toBe(true)

    FsmProject.addStateFromEditor()
    expect(compactIds(state)).toEqual([0])
    expect(namesOf(state)).toEqual(['q0'])
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })

  MODELS.forEach((model) => {
    ;[1, 2, 3].forEach((count) => {
      // every id has to survive a removal, not only the highest one
      Array.from({ length: count }, (_, index) => index).forEach((removedId) => {
        it(`${model} with ${count} states: removing id ${removedId} and adding a state stays valid`, () => {
          const state = useSize(count, model)
          const namesBefore = namesOf(state)
          expect(validateFsm(state).valid).toBe(true)

          FsmProject.removeStateFromEditor(removedId)
          expect(namesOf(state)).toEqual(namesBefore.filter((_, index) => index !== removedId))
          expect(compactIds(state)).toEqual(compactIds(state).map((_, index) => index))
          expectMatrix(state)
          expect(validateFsm(state).valid).toBe(true)

          FsmProject.addStateFromEditor()
          expect(state.nodes).toHaveLength(count)
          expect(compactIds(state)).toEqual(compactIds(state).map((_, index) => index))
          const names = namesOf(state)
          expect(new Set(names).size).toBe(names.length)
          expectMatrix(state)
          expect(validateFsm(state).valid).toBe(true)
        })
      })
    })
  })

  it('ignores a removal on an empty machine and a request without an id', () => {
    const state = useSize(0, 'mealy')

    FsmProject.removeStateFromEditor(0)
    FsmProject.removeStateFromEditor(Number.NaN)
    expect(state.nodes).toHaveLength(0)
    expect(state.transitions).toHaveLength(0)

    FsmProject.addStateFromEditor(10, 20)
    expect(compactIds(state)).toEqual([0])
    expect(namesOf(state)).toEqual(['q0'])
    expect(validateFsm(state).valid).toBe(true)
  })

  it('keeps the Moore outputs of the states that stay', () => {
    const state = createState({
      ...specForSize(3, 'moore'),
      outputBits: 2,
      mooreOutputs: ['01', '10', '11'],
    })
    stateManager.state.fsm = state

    FsmProject.removeStateFromEditor(1)
    expect(namesOf(state)).toEqual(['q0', 'q2'])
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['01', '11'])
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('keeps every untouched row through a middle removal and a new state', () => {
    const state = useSize(4, 'mealy')
    const untouched = snapshot(state).filter(
      (row) => !row.startsWith('q1|') && !row.includes('->q1'),
    )

    FsmProject.removeStateFromEditor(1)
    expect(namesOf(state)).toEqual(['q0', 'q2', 'q3'])
    untouched.forEach((row) => expect(snapshot(state)).toContain(row))

    FsmProject.addStateFromEditor()
    expect(namesOf(state)).toEqual(['q0', 'q2', 'q3', 'q1'])
    untouched.forEach((row) => expect(snapshot(state)).toContain(row))
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })
})

describe('the panels unlock as soon as the machine is valid again', () => {
  it('keeps a hidden row valid and resolves it again once a next state is picked', () => {
    const state = createState(M2)
    stateManager.state.fsm = state
    removeStateRow(state, 2)
    // a removed target is hidden, so the machine stays valid and unlocked
    expect(validateFsm(state).valid).toBe(true)

    writeRow(state, 0, '1', 0)
    expectMatrix(state)
    expect(state.transitions.some((transition) => transition.removedTarget)).toBe(false)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('resolves a row that an editor removal left without a target', () => {
    const state = useSize(3, 'mealy')
    writeRow(state, 0, '0', 2)
    FsmProject.removeStateFromEditor(2)

    expect(findRow(state, 0, '0').toNodeId).toBe(-1)
    expect(findRow(state, 0, '0').toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
    expect(validateFsm(state).valid).toBe(true)

    // picking a next state again must be a normal, valid table edit
    FsmProject.addStateFromEditor()
    writeRow(state, 0, '0', 2)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })
})

describe('the transitions table marks the rows the editor hides', () => {
  function mountTable(state: FsmState) {
    stateManager.state.fsm = state
    return mount(TransitionsTable, { global: { stubs: { 'vue-latex': true } } })
  }

  // The whole row is dimmed, the numbers as well as the editable cells
  function isDimmedRow(row: { classes(): string[] }): boolean {
    return row.classes().includes('opacity-60')
  }

  it('dims a row with a partial next state and a row without any next state', () => {
    const state = createState(specForCount(4))
    writeRow(state, 0, '0', 'x0') // q0 -0-> covers two states
    writeRow(state, 1, '0', 2) // q1 -0-> stays concrete
    const wrapper = mountTable(state)

    expect(findRow(state, 0, '0').toNodeId).toBe(-1)
    expect(findRow(state, 1, '0').toNodeId).toBe(2)

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(8)
    expect(isDimmedRow(rows[0]!)).toBe(true) // q0 -0-> two states
    expect(isDimmedRow(rows[1]!)).toBe(true) // q0 -1-> still unassigned
    expect(isDimmedRow(rows[2]!)).toBe(false) // q1 -0-> q2 is concrete
    expect(isDimmedRow(rows[3]!)).toBe(true) // q1 -1-> still unassigned
  })

  it('dims a row whose target was removed until it is picked again', () => {
    const state = createState(M2)
    removeStateRow(state, 2)
    const wrapper = mountTable(state)

    const rows = wrapper.findAll('tbody tr')
    const flaggedRow = state.transitions.find((transition) => transition.removedTarget)
    const index = state.transitions.indexOf(flaggedRow as FsmTransition)
    expect(isDimmedRow(rows[index]!)).toBe(true)

    writeRow(state, 0, '1', 0)
    const fixed = mountTable(state)
    expect(isDimmedRow(fixed.findAll('tbody tr')[index]!)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Hidden rows: not drawn, ignored by validation, and clearable before KV and LC
// ---------------------------------------------------------------------------

describe('hidden rows are ignored and can be cleared', () => {
  const rowWith = (state: FsmState, patch: Partial<FsmTransition>): FsmTransition =>
    ({ ...findRow(state, 0, '0'), ...patch }) as FsmTransition

  it('treats only rows without a unique next state as hidden', () => {
    const state = createState(specForCount(4))

    expect(isHiddenTransition(rowWith(state, { toNodeId: 0, toBinaryId: undefined }))).toBe(false)
    expect(isHiddenTransition(rowWith(state, { toNodeId: -1, toBinaryId: '11' }))).toBe(false)
    expect(isHiddenTransition(rowWith(state, { toNodeId: -1, toBinaryId: '1x' }))).toBe(true)
    expect(isHiddenTransition(rowWith(state, { toNodeId: -1, toBinaryId: 'xx' }))).toBe(true)
    expect(
      isHiddenTransition(rowWith(state, { toNodeId: -1, toBinaryId: '11', removedTarget: true })),
    ).toBe(true)
  })

  it('offers a cleanup only while a hidden row still shows concrete bits', () => {
    const state = createState(specForCount(4))
    writeRow(state, 0, '1', '1x') // hidden with a concrete bit

    // the row the fixture draws stays drawn and needs no cleanup
    expect(findRow(state, 0, '0').toNodeId).toBe(1)
    expect(needsHiddenCleanup(findRow(state, 0, '0'))).toBe(false)
    // the hidden row has a concrete bit, the six empty rows are a full don't care
    expect(needsHiddenCleanup(findRow(state, 0, '1'))).toBe(true)
    expect(state.transitions.filter(isHiddenTransition)).toHaveLength(7)
    expect(state.transitions.filter(needsHiddenCleanup)).toHaveLength(1)
  })

  it('clears the bits of every hidden row without changing the derived views', () => {
    const state = createState(M4)
    stateManager.state.fsm = state
    const tableBefore = exportFsmToTruthTable(state)
    const lcBefore = stateMachineToLC(state, { encoding: 'Binary', flipFlopType: 'D' }).toString()

    expect(FsmProject.clearHiddenRowBits()).toBe(4)
    expect(state.transitions.filter(needsHiddenCleanup)).toHaveLength(0)

    state.transitions.forEach((transition) => {
      if (!isHiddenTransition(transition)) return
      expect(transition.toNodeId).toBe(-1)
      expect(transition.toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
      expect(transition.removedTarget).toBe(false)
    })
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)

    // clearing only makes the table match the views, it never changes the machine
    expect(exportFsmToTruthTable(state)).toEqual(tableBefore)
    expect(stateMachineToLC(state, { encoding: 'Binary', flipFlopType: 'D' }).toString()).toBe(
      lcBefore,
    )
  })

  it('clears the output of a hidden Mealy row as well', () => {
    const state = createState(specForCount(3))
    stateManager.state.fsm = state
    writeRow(state, 0, '0', '1x', '1')
    expect(needsHiddenCleanup(findRow(state, 0, '0'))).toBe(true)

    FsmProject.clearHiddenRowBits()

    expect(findRow(state, 0, '0').mealyOutput).toBe('x'.repeat(state.outputBitCount ?? 1))
    expect(validateFsm(state).valid).toBe(true)
  })

  it('tells the user about the hidden rows and confirms with the button', async () => {
    const wrapper = mount(HiddenEdgesNotice, { props: { count: 3 } })
    expect(wrapper.text()).toContain('Hidden transitions')
    expect(wrapper.text()).toContain("3 transitions have a don't care (-) as their next state")
    // what the click does has to be readable before clicking
    expect(wrapper.text()).toContain('have to be set completely to -')

    const button = wrapper.get('button')
    expect(button.text()).toBe('Continue anyway')
    await button.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    // the single case has to read as one sentence, never as a plural mix
    const single = mount(HiddenEdgesNotice, { props: { count: 1 } })
    expect(single.text()).toContain("One transition has a don't care (-) as its next state")
    expect(single.text()).toContain('It is not drawn')
    expect(single.text()).not.toContain('transitions have')
    expect(single.text()).not.toContain('They are not drawn')
  })

  it('points the KV header badge at the docs and explains the rule on hover', () => {
    const wrapper = mount(HiddenTransitionsBadge, { props: { count: 3, pending: 2 } })
    const link = wrapper.get('a')

    expect(link.attributes('href')).toContain('docs/views/state-machine/tables.html#next-states')
    expect(link.attributes('title')).toContain('All transitions with - as a next state bit')
    expect(link.attributes('title')).toContain('2 of them still show bits')
    expect(link.text()).toContain('3')
    // an info badge, never an error badge
    expect(link.classes()).toContain('text-primary-variant')
    expect(link.classes().join(' ')).not.toContain('red-')

    // the badge reports every hidden edge, so the pending part is optional
    const clean = mount(HiddenTransitionsBadge, { props: { count: 4 } })
    expect(clean.get('a').attributes('title')).toContain('None of them still show bits')
    expect(clean.get('a').text()).toContain('4')

    expect(
      mount(HiddenTransitionsBadge, { props: { count: 1, pending: 1 } })
        .get('a')
        .attributes('title'),
    ).toContain('One of them still shows bits')
  })

  it('agrees with the editor about which rows are hidden', async () => {
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const editorExport = await import('../../public/fsm-engine/src/lib/export.js')
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const editorStore = await import('../../public/fsm-engine/src/lib/stores.js')

    // pattern -> [editor keeps the row, editor flags it hidden, app flags it hidden, machine valid]
    const cases: [string, boolean, boolean, boolean, boolean][] = [
      ['00', true, false, false, true],
      ['0x', true, true, true, true],
      ['xx', true, true, true, true],
      // index 3 has no state: a fault the app locks on, not a hidden row
      ['11', false, false, false, false],
    ]

    const observed = cases.map(([pattern]) => {
      const state = createState(specForCount(3))
      const row = findRow(state, 0, '0')
      row.toNodeId = -1
      row.toBinaryId = pattern

      editorExport.clearFsmFromParent()
      editorStore.store.set(editorStore.stage_ref, null)
      editorExport.applyFsmImport(buildFsmImportPayload(state))

      const entry = (editorStore.store.get(editorStore.transition_list) ?? []).find(
        (transition: { from?: number; input?: string; hiddenDontCare?: boolean }) =>
          transition?.from === 0 && transition?.input === '0',
      )

      return [
        pattern,
        !!entry,
        !!entry?.hiddenDontCare,
        isHiddenTransition(row),
        validateFsm(state).valid,
      ]
    })

    expect(observed).toEqual(cases)
  })

  it('leaves a partially concrete Moore row as don\u2019t cares in the table', () => {
    const state = createState({
      ...specForSize(4, 'moore'),
      outputBits: 2,
      mooreOutputs: ['01', '10', '11', '00'],
    })
    const drawnBefore = exportFsmToTruthTable(state)
    // (q1, 0) -> q2 keeps the output of its target, the drawn case stays untouched
    writeRow(state, 1, '0', 2)
    expect(valueRow(exportFsmToTruthTable(state), 0b010)).toEqual([1, 0, 1, 1])

    // (q0, 0) covers two states with different outputs -> hidden, so every cell is open
    writeRow(state, 0, '0', 'x0')
    expect(valueRow(exportFsmToTruthTable(state), 0b000)).toEqual(['-', '-', '-', '-'])
    expect(validateFsm(state).valid).toBe(true)
    expect(drawnBefore.values).toHaveLength(exportFsmToTruthTable(state).values.length)
  })

  it('ignores the output of a hidden Mealy row in the table', () => {
    const state = createState(specForSize(3, 'mealy'))
    writeRow(state, 0, '0', '1x', '1')

    // two state bits plus one output bit, every cell stays open
    expect(valueRow(exportFsmToTruthTable(state), 0b000)).toEqual(['-', '-', '-'])
    expect(validateFsm(state).valid).toBe(true)
  })

  it('clears a removed target as well and drops its stale index', () => {
    const state = createState(M2)
    stateManager.state.fsm = state
    removeStateRow(state, 2)
    const flagged = state.transitions.find((transition) => transition.removedTarget)
    if (!flagged) throw new Error('no dangling target was flagged')
    expect(flagged.toBinaryId).toBe('10')

    expect(FsmProject.clearHiddenRowBits()).toBeGreaterThan(0)

    // the cleanup replaces the row object, so read the state again
    const clearedRow = findRow(state, 0, '1')
    expect(clearedRow.removedTarget).toBe(false)
    expect(clearedRow.toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('clears nothing twice and leaves the drawn rows untouched', () => {
    const state = createState(M4)
    stateManager.state.fsm = state
    const drawnBefore = state.transitions
      .filter((transition) => !isHiddenTransition(transition))
      .map((transition) => ({ ...transition }))

    expect(FsmProject.clearHiddenRowBits()).toBe(4)
    expect(FsmProject.clearHiddenRowBits()).toBe(0)

    const drawnAfter = state.transitions.filter((transition) => !isHiddenTransition(transition))
    expect(drawnAfter.map((transition) => ({ ...transition }))).toEqual(drawnBefore)
  })

  it('reports pending hidden rows only while the drawn machine is valid', () => {
    const state = createState(specForCount(3))
    stateManager.state.fsm = state
    expect(countPendingHiddenRows(state)).toBe(0)

    writeRow(state, 0, '0', '1x')
    expect(countPendingHiddenRows(state)).toBe(1)

    // an error in a drawn row needs attention first: clearing bits cannot repair it
    writeRow(state, 2, '0', '11')
    expect(validateFsm(state).valid).toBe(false)
    expect(countPendingHiddenRows(state)).toBe(0)

    writeRow(state, 2, '0', '01')
    expect(countPendingHiddenRows(state)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Overlay choice and cross view consistency: one decision for every panel
// ---------------------------------------------------------------------------

// The next-state cells of the exported table must be open for hidden rows and only for them
function nextStateCellsAreOpenOnlyForHiddenRows(state: FsmState): boolean {
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

const IO_CASES: readonly { model: FsmModel; inputBits: number; outputBits: number }[] = [
  { model: 'mealy', inputBits: 1, outputBits: 1 },
  { model: 'mealy', inputBits: 2, outputBits: 3 },
  { model: 'moore', inputBits: 1, outputBits: 1 },
  { model: 'moore', inputBits: 3, outputBits: 2 },
]

function lifecycleSpec(
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

describe('the overlay follows the drawn edges only', () => {
  // Two or more state bits are needed for a partially filled hidden row
  IO_CASES.forEach(({ model, inputBits, outputBits }) => {
    ;[3, 4, 5, 8, 15, 16].forEach((stateCount) => {
      it(`${model} ${inputBits}/${outputBits} bits, ${stateCount} states: hide, clear, remove, add`, () => {
        const state = createState(lifecycleSpec(model, inputBits, outputBits, stateCount))
        stateManager.state.fsm = state
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')
        expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)

        FsmProject.addStateFromEditor()
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')

        // a half filled hidden row asks for the hidden overlay, the machine stays valid
        const firstInput = '0'.repeat(inputBits)
        writeRow(state, 0, firstInput, `0${'x'.repeat(Math.max(0, state.nodeIdBitCount - 1))}`)
        expect(validateFsm(state).valid).toBe(true)
        expect(fsmViewMode(state)).toBe('hidden-pending')
        expect(countPendingHiddenRows(state)).toBe(1)
        expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)

        // accepting them opens every view again
        expect(FsmProject.clearHiddenRowBits()).toBe(1)
        expect(fsmViewMode(state)).toBe('ready')
        expect(countPendingHiddenRows(state)).toBe(0)
        expectMatrix(state)

        // removing and adding states keeps the views ready and the matrix complete
        FsmProject.removeStateFromEditor(0)
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')
        FsmProject.addStateFromEditor()
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')
        expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)
      })
    })
  })

  IO_CASES.forEach(({ model, inputBits, outputBits }) => {
    ;[0, 1, 2].forEach((stateCount) => {
      it(`${model} ${inputBits}/${outputBits} bits, ${stateCount} states: the short machine never locks`, () => {
        const state = createState(lifecycleSpec(model, inputBits, outputBits, stateCount))
        stateManager.state.fsm = state
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')

        FsmProject.addStateFromEditor()
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')

        FsmProject.removeStateFromEditor(0)
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')

        FsmProject.addStateFromEditor()
        expectMatrix(state)
        expect(fsmViewMode(state)).toBe('ready')
        expect(validateFsm(state).valid).toBe(true)
        expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)
      })
    })
  })
})

describe('a broken drawn edge locks with the known overlay', () => {
  IO_CASES.forEach(({ model, inputBits, outputBits }) => {
    it(`${model} ${inputBits}/${outputBits} bits: invalid wins over pending hidden rows`, () => {
      const state = createState(lifecycleSpec(model, inputBits, outputBits, 3))
      stateManager.state.fsm = state
      expect(fsmViewMode(state)).toBe('ready')

      // a hidden row that still carries bits
      writeRow(state, 0, '0'.repeat(inputBits), '0x')
      expect(fsmViewMode(state)).toBe('hidden-pending')

      // a drawn row that names index 3, which has no state
      writeRow(state, 1, '0'.repeat(inputBits), '11')
      expect(fsmViewMode(state)).toBe('invalid')
      expect(countPendingHiddenRows(state)).toBe(0)
      const validity = validateFsm(state)
      expect(validity.valid).toBe(false)
      expect(validity.valid ? '' : validity.reason).toContain('q1')

      // repairing the drawn row brings the hidden overlay back, accepting it shows the views
      writeRow(state, 1, '0'.repeat(inputBits), '00')
      expect(fsmViewMode(state)).toBe('hidden-pending')
      expect(countPendingHiddenRows(state)).toBe(1)
      expect(FsmProject.clearHiddenRowBits()).toBe(1)
      expect(fsmViewMode(state)).toBe('ready')
      expectMatrix(state)
      expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)
    })
  })
})

describe('a next state removed in the table never locks', () => {
  IO_CASES.forEach(({ model, inputBits, outputBits }) => {
    ;[1, 2, 3, 5, 9].forEach((stateCount) => {
      it(`${model} ${inputBits}/${outputBits} bits, ${stateCount} states: the stale row stays hidden`, () => {
        const state = createState(lifecycleSpec(model, inputBits, outputBits, stateCount))
        stateManager.state.fsm = state

        removeStateRow(state, stateCount - 1)
        expectMatrix(state)
        expect(validateFsm(state).valid).toBe(true)
        expect(fsmViewMode(state)).not.toBe('invalid')
        expect(fsmViewMode(state)).toBe(stateCount > 1 ? 'hidden-pending' : 'ready')
        expect(nextStateCellsAreOpenOnlyForHiddenRows(state)).toBe(true)

        FsmProject.clearHiddenRowBits()
        expect(fsmViewMode(state)).toBe('ready')
        expectMatrix(state)
        expect(validateFsm(state).valid).toBe(true)
      })
    })
  })
})

describe('the views and the badge ask the same question', () => {
  it('reports every hidden row in the badge and only the pending ones in the notice', () => {
    const state = createState(specForSize(3, 'mealy'))
    stateManager.state.fsm = state
    // the machine starts as a placeholder matrix: the open rows are hidden, none shows bits
    expect(countHiddenRows(state)).toBe(5)
    expect(countHiddenRowsWithBits(state)).toBe(0)

    writeRow(state, 0, '0', '0x')
    writeRow(state, 1, '0', '1x')

    // the drawn row of the spec became hidden as well, two of them carry bits
    expect(countHiddenRows(state)).toBe(6)
    expect(countHiddenRowsWithBits(state)).toBe(2)
    expect(countPendingHiddenRows(state)).toBe(2)
    expect(fsmViewMode(state)).toBe('hidden-pending')

    // a drawn row with a missing state locks everything, the badge keeps its count
    writeRow(state, 2, '0', '11')
    expect(fsmViewMode(state)).toBe('invalid')
    expect(countHiddenRows(state)).toBe(5)
    expect(countHiddenRowsWithBits(state)).toBe(2)
    // the notice waits for the repair instead of counting
    expect(countPendingHiddenRows(state)).toBe(0)

    writeRow(state, 2, '0', '00')
    expect(countHiddenRows(state)).toBe(5)
    expect(countPendingHiddenRows(state)).toBe(2)
    expect(fsmViewMode(state)).toBe('hidden-pending')
  })
})

describe('hidden rows keep the machine consistent through a round trip', () => {
  it('keeps a removed target through a full editor round trip', async () => {
    const state = createState(M2)
    stateManager.state.fsm = state
    removeStateRow(state, 2)
    const before = state.transitions.filter((transition) => transition.removedTarget)
    expect(before.length).toBeGreaterThan(0)

    const synced = await throughEditor(state)

    // the stale row must survive as a hidden row, never as a repointed edge
    expect(synced.transitions.filter((transition) => transition.removedTarget)).toHaveLength(
      before.length,
    )
    // the marker itself survives, but its stale encoding degrades to don't cares
    expect(synced.transitions.find((transition) => transition.removedTarget)?.toBinaryId).toMatch(
      /^x+$/,
    )
    expect(fsmViewMode(synced)).toBe('hidden-pending')
    expect(validateFsm(synced).valid).toBe(true)
    expectMatrix(synced)
    expect(nextStateCellsAreOpenOnlyForHiddenRows(synced)).toBe(true)
  })

  it('ignores a Moore hidden row in the circuit as well', () => {
    const state = createState({ ...specForSize(3, 'moore'), outputBits: 2 })
    stateManager.state.fsm = state
    writeRow(state, 0, '0', '1x')

    const options = { encoding: 'Binary', flipFlopType: 'D' } as const
    const withHidden = stateMachineToLC(state, options).toString()

    expect(fsmViewMode(state)).toBe('hidden-pending')
    FsmProject.clearHiddenRowBits()

    // the hidden row only carried don't cares, so the circuit may not change
    expect(stateMachineToLC(state, options).toString()).toBe(withHidden)
    expect(validateFsm(state).valid).toBe(true)
    expectMatrix(state)
  })

  it('treats a missing FSM as ready', () => {
    expect(fsmViewMode(undefined)).toBe('ready')
  })
})

describe('the shared gate renders exactly one overlay and reacts to it', () => {
  // The gate reads the reactive FSM, so the tests mutate the same proxy the panels use
  function useGate(spec: FsmSpec, hint = 'Fix it.') {
    const state = reactive(createState(spec)) as FsmState
    stateManager.state.fsm = state
    const gate = mount(FsmViewGate, {
      props: { fsm: state, hint },
      slots: { default: '<p class="view-content">view content</p>' },
    })
    return { state, gate }
  }

  it('opens and closes the view the same way for Mealy and Moore', async () => {
    for (const model of ['mealy', 'moore'] as const) {
      const { state, gate } = useGate(lifecycleSpec(model, 1, 1, 3))

      // 1) a valid machine without pending rows shows the content
      expect(gate.text()).toContain('view content')

      // 2) a hidden row with bits: the new overlay, and the content is gone
      writeRow(state, 0, '0', '0x')
      await nextTick()
      expect(gate.text()).toContain('Hidden transitions')
      expect(gate.text()).toContain('Continue anyway')
      expect(gate.text()).not.toContain('view content')
      expect(gate.text()).not.toContain('FSM Invalid')

      // 3) accepting it clears the rows and reopens the view
      await gate.get('button').trigger('click')
      await nextTick()
      expect(gate.text()).toContain('view content')
      expect(gate.text()).not.toContain('Hidden transitions')
      expect(fsmViewMode(state)).toBe('ready')
      expectMatrix(state)

      // 4) a broken drawn row locks with the known overlay and names the row
      writeRow(state, 1, '0', '11')
      await nextTick()
      expect(gate.text()).toContain('FSM Invalid')
      expect(gate.text()).toContain('q1')
      expect(gate.text()).not.toContain('Continue anyway')

      // 5) repairing it asks for the hidden rows again, clearing them shows the view
      writeRow(state, 1, '0', '00')
      writeRow(state, 2, '1', '1x')
      await nextTick()
      expect(gate.text()).toContain('Hidden transitions')
      await gate.get('button').trigger('click')
      await nextTick()
      expect(gate.text()).toContain('view content')
      expect(validateFsm(state).valid).toBe(true)
      expectMatrix(state)
    }
  })

  it('locks a broken machine even while hidden rows are pending', async () => {
    const { state, gate } = useGate(lifecycleSpec('moore', 2, 2, 3))

    writeRow(state, 0, '00', '0x')
    await nextTick()
    expect(gate.text()).toContain('Hidden transitions')

    writeRow(state, 2, '11', '11')
    await nextTick()
    expect(gate.text()).toContain('FSM Invalid')
    expect(gate.text()).toContain('q2')
    expect(gate.text()).not.toContain('Continue anyway')

    writeRow(state, 2, '11', '10')
    await nextTick()
    expect(gate.text()).toContain('Hidden transitions')
    expect(gate.text()).not.toContain('FSM Invalid')
  })
})
