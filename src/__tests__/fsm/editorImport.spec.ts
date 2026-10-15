import { describe, expect, it } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { buildFsmImportPayload } from '@/utility/fsm/EditorSync/fsmListener'
import {
  ensureTransitionMatrix,
  isHiddenTransition,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmState } from '@/projects/state-machine/FsmTypes'
import { createState, findRow, specForCount, writeRow } from './support/fixtures'
import { M2, M2_SNAPSHOT, M5 } from './support/specs'
import {
  expectMatrix,
  nodeAt,
  rowAt,
  roundtrip,
  snapshot,
  toEditorPayload,
  valueRow,
} from './support/assertions'
import { importIntoEditor } from './support/editorHarness'

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

  it('dropping rows in the editor leaves them unassigned and the others untouched', () => {
    const state = createState(M2)
    const payload = toEditorPayload(state)
    // the editor drops the arrows for (q0, input 1) and (q1, input 0): no transition comes back
    payload.transitions = payload.transitions.filter(
      (entry) =>
        !(entry.from === 0 && entry.input === '1') && !(entry.from === 1 && entry.input === '0'),
    )
    const { nodes, transitions } = importEditorPayload(payload, state)
    const after: FsmState = { ...state, nodes, transitions }
    ensureTransitionMatrix(after)
    expectMatrix(after)

    const cleared = findRow(after, 0, '1')
    expect(cleared.toNodeId).toBe(-1)
    expect(cleared.toBinaryId).toBe('x'.repeat(after.nodeIdBitCount))
    expect(cleared.removedTarget).toBeFalsy()
    expect(findRow(after, 1, '0').toNodeId).toBe(-1)
    expect(validateFsm(after).valid).toBe(true)
    // the untouched rows stay exactly as they were
    expect(snapshot(after)).toContain('q0|0->q1/00')
    expect(snapshot(after)).toContain('q1|1->q0/11')
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

describe('hidden target patterns survive the import', () => {
  it('keeps hidden target patterns separate from concrete target transitions while merging inputs', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
      ],
      transitions: [
        { id: 1, from: 1, to: 0, input: '00', output: '0' },
        { id: 2, from: 1, to: 0, input: '01', output: '0' },
        { id: 3, from: 1, to: -1, toBinaryId: 'x', input: '10', output: '0' },
        { id: 4, from: 1, to: -1, toBinaryId: 'x', input: '11', output: '0' },
      ],
      fsmType: 'mealy',
      inputBitCount: 2,
      outputBitCount: 1,
    })

    const merged = (stores.store.get(stores.transition_list) ?? []).filter(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(merged).toHaveLength(2)
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: '0x', to: 0, hiddenDontCare: false }),
        expect.objectContaining({ input: '1x', to: -1, hiddenDontCare: true }),
      ]),
    )
  })

  it('keeps node references in both directions for hidden target patterns', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
      ],
      transitions: [{ id: 1, from: 1, to: -1, toBinaryId: 'x', input: '0', output: '0' }],
      fsmType: 'mealy',
      inputBitCount: 1,
      outputBitCount: 1,
    })

    const hidden = (stores.store.get(stores.transition_list) ?? []).find(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(hidden).toMatchObject({ hiddenDontCare: true })
    const hiddenNodes = stores.store.get(stores.node_list) as Array<{
      transitions?: Array<{ id?: number }>
    }>
    expect(hiddenNodes[1]?.transitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: hidden.id })]),
    )
    expect(hiddenNodes[0]?.transitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: hidden.id })]),
    )
  })
})
