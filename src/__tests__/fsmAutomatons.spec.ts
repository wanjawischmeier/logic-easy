import { describe, expect, it } from 'vitest'
import type { FsmModel, FsmNode, FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import {
  MAX_FSM_IO_BITS,
  MAX_FSM_STATES,
  addStateRow,
  ensureTransitionMatrix,
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
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import { buildFsmImportPayload } from '@/utility/fsm/EditorSync/fsmListener'
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

interface AutoSpec {
  model: FsmModel
  inputBits: number
  outputBits: number
  stateCount: number
  edges: readonly Edge[]
  mooreOutputs?: readonly string[]
}

function createState(spec: AutoSpec): FsmState {
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

// Readable, order independent picture of the automaton; targets are printed as names,
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

function padRight(value: string, length: number): string {
  return String(value ?? '')
    .replace(/-/g, 'x')
    .padStart(length, 'x')
    .slice(-length)
}

// Mirrors the payload the panel sends before the editor renders it
function toEditorPayload(state: FsmState) {
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
      toBinaryId: transition.toBinaryId,
      input: padRight(transition.input, inputBits),
      output: output(transition),
      mealy_output: output(transition),
    })),
  }
}

// Panel -> editor -> panel: the automaton must come back unchanged
function roundtrip(state: FsmState): FsmState {
  const { nodes, transitions } = importEditorPayload(toEditorPayload(state), state)
  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}

// ---------------------------------------------------------------------------
// The automatons
// ---------------------------------------------------------------------------

// Foto 4: A -0/00-> B, A -1/11-> C, B -0/00-> B, B -1/11-> A, C -0/00-> B, C -1/11-> A
const M2: AutoSpec = {
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
const M1: AutoSpec = {
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
const M3: AutoSpec = {
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

// Extra automaton with six states, two inputs and partial patterns
const M4: AutoSpec = {
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
const M5: AutoSpec = {
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

const AUTOMATA: readonly { name: string; spec: AutoSpec; expected: string[] }[] = [
  { name: 'M2 (three states, Foto 4)', spec: M2, expected: M2_SNAPSHOT },
  { name: 'M1 (four states, Abb. 1.1)', spec: M1, expected: M1_SNAPSHOT },
  { name: 'M3 (Moore, Foto 1)', spec: M3, expected: M3_SNAPSHOT },
  { name: 'M4 (six states, patterns)', spec: M4, expected: [] },
  { name: 'M5 (output patterns)', spec: M5, expected: M5_SNAPSHOT },
]

describe('automatons stay identical in table, central state and editor sync', () => {
  AUTOMATA.forEach(({ name, spec, expected }) => {
    if (expected.length > 0) {
      it(`${name}: central state is exactly the drawn automaton`, () => {
        const state = createState(spec)
        expect(snapshot(state)).toEqual(expected)
      })
    }

    it(`${name}: central state keeps every invariant`, () => {
      const state = createState(spec)
      expectMatrix(state)
      expect(validateFsm(state).valid).toBe(true)
    })

    it(`${name}: table path (cell cycles) builds the same automaton`, () => {
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
  it('encoded truth table matches the automaton by hand', () => {
    const table = exportFsmToTruthTable(createState(M2))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_0^n'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1^n', 'Y_0^n'])
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
  it('encoded truth table uses the output of the target state', () => {
    const table = exportFsmToTruthTable(createState(M3))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_1^n', 'X_0^n'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1^n', 'Y_0^n'])
    expect(table.values).toHaveLength(16)
    // (S0, 00) -> S2 (10) and the output comes from S2, which is 11
    expect(valueRow(table, 0)).toEqual([1, 0, 1, 1])
    // (S0, 10) -> S1 (01), output of S1 is 10
    expect(valueRow(table, 2)).toEqual([0, 1, 1, 0])
    // (S3, 11) is the don't care row of the sheet
    expect(valueRow(table, 15)).toEqual(['-', '-', '-', '-'])
  })

  it('reports different outputs of a covered group and locks the editor', () => {
    const state = createState(M3)
    const row = findRow(state, 0, '00')
    row.toNodeId = -1
    // 10xx covers the states q2 (11) and q3 (00), whose outputs differ
    row.toBinaryId = '1x'
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason:
        'In Moore mode a transition covers states with different outputs - give these states the same output, or use concrete next states.',
    })
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
  it('keeps partial patterns and reports them as don\u2019t cares in the table', () => {
    const state = createState(M4)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)

    const table = exportFsmToTruthTable(state)
    // three state bits plus two input bits -> 32 rows
    expect(table.inputVars).toHaveLength(5)
    expect(table.values).toHaveLength(32)
    // (q0, 10) covers q0 and q1 (pattern 00x) -> next state bits 0, 0, -
    const row = findRow(state, 0, '10')
    expect(row.toBinaryId).toBe('00x')
    expect(valueRow(table, 0b00010).slice(0, 3)).toEqual([0, 0, '-'])
    // (q4, 11) covers q2 and q3 (pattern 01x) -> next state bits 0, 1, -
    expect(valueRow(table, 0b10011).slice(0, 3)).toEqual([0, 1, '-'])
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

  it('flags a dangling target and keeps the row for the user', () => {
    const state = createState(M2)
    removeStateRow(state, 2)
    const flagged = state.transitions.filter((transition) => transition.removedTarget)
    expect(flagged.length).toBeGreaterThan(0)
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason: 'A transition points at a non-existing state.',
    })
    // the encoding of the removed state is kept, so the user can see what was meant
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
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_0^n'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1^n', 'Y_0^n'])
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
  const specForCount = (count: number): AutoSpec => ({
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
    expect(table.inputVars).toEqual(['Z_0^n', 'X_0^n'])
    expect(table.outputVars).toEqual(['Z_0^(n+1)', 'Y_0^n'])
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

  it('builds one D flip-flop per state bit for every automaton', () => {
    AUTOMATA.forEach(({ name, spec }) => {
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

  it('derives JK excitation equations without changing the automaton', () => {
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
function specForCount(count: number, model: FsmModel = 'mealy'): AutoSpec {
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

  it('a partial pattern that covers a non-existing state locks the editor', () => {
    const state = createState(specForCount(3))
    // "1x" would also cover index 11, which has no state
    writeRow(state, 0, '0', '1x')
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason: 'A transition points at a non-existing state.',
    })
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

describe('editor internals', () => {
  it('asks the app to create a state instead of minting an id itself', async () => {
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const editor = await import('../../public/fsm-engine/src/lib/editor.js')
    // @ts-expect-error - the editor submodule ships plain JS without type declarations
    const stores = await import('../../public/fsm-engine/src/lib/stores.js')
    const { store, node_list, editor_state } = stores

    store.set(node_list, [])
    store.set(editor_state, 'Add')

    const messages: unknown[] = []
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: (message: unknown) => messages.push(message) },
    })

    const clickEvent = {
      target: {
        getStage: () => ({
          findOne: () => ({ getRelativePointerPosition: () => ({ x: 10, y: 20 }) }),
        }),
      },
    }

    try {
      editor.HandleEditorClick(clickEvent)
    } finally {
      delete (window as unknown as Record<string, unknown>).parent
    }

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

    const messages: unknown[] = []
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: (message: unknown) => messages.push(message) },
    })

    try {
      editor.HandleStateClick({ cancelBubble: false, evt: { button: 0 } }, 1)
    } finally {
      delete (window as unknown as Record<string, unknown>).parent
    }

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
  console.log(
    'DBG before import flags',
    state.transitions
      .filter((t) => t.removedTarget)
      .map((t) => `${t.fromNodeId}|${t.input}`)
      .join(','),
  )
  const { nodes, transitions } = importEditorPayload(editorExport.extractFsmData(), state)
  console.log(
    'DBG after import flags',
    transitions
      .filter((t) => t.removedTarget)
      .map((t) => `${t.fromNodeId}|${t.input}`)
      .join(','),
  )

  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}

describe('state requests sync through the editor', () => {
  function useFsm(spec: AutoSpec): FsmState {
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

    const synced = await throughEditor(state)
    expect(snapshot(synced)).toEqual(snapshot(state))
    // a row whose target is gone keeps its marker, so the machine stays invalid until it is fixed
    expect(validateFsm(synced).valid).toBe(false)
    expect(snapshot(await throughEditor(synced))).toEqual(snapshot(synced))

    // the id compaction must not repoint a row at another state
    expect(snapshot(synced)).toContain('q0|00->q5/01')
    expect(snapshot(synced)).toContain('q0|01->q1/10')
    expect(snapshot(synced)).toContain('q0|10->pattern:00x/11')
    expect(snapshot(synced).some((row) => row.includes('q2'))).toBe(false)
  })

  it('syncs the complete automaton again once the removed targets are fixed', async () => {
    const state = useFsm(M4)
    FsmProject.removeStateFromEditor(2)

    const synced = await throughEditor(state)
    const dangling = synced.transitions
      .map((transition, index) => (transition.removedTarget ? index : -1))
      .filter((index) => index >= 0)
    expect(dangling).toHaveLength(2)

    // the cells stay togglable while the machine is invalid, so the rows can be repaired
    dangling.forEach((index) => clickTargetBitsUntil(synced, index, '011'))
    expect(validateFsm(synced).valid).toBe(true)

    const repaired = await throughEditor(synced)
    expect(validateFsm(repaired).valid).toBe(true)
    expect(snapshot(repaired)).toEqual(snapshot(synced))
    expectMatrix(repaired)
    // the repair points at the state with the index 3, whose name drifted to q4 after the import
    expect(snapshot(repaired)).toContain('q1|00->q4/11')
    expect(snapshot(repaired)).toContain('q4|11->q4/10')
    expect(snapshot(repaired).some((row) => row.includes('removed:'))).toBe(false)
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
})
