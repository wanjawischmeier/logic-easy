import { describe, expect, it } from 'vitest'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmModel, FsmState } from '@/projects/state-machine/FsmTypes'
import type { FsmSpec } from './support/fixtures'
import {
  compactIds,
  findRow,
  namesOf,
  specForCount,
  specForSize,
  useFsm,
  useSize,
  writeRow,
} from './support/fixtures'
import { M2 } from './support/specs'
import { expectMatrix, roundtrip, snapshot } from './support/assertions'

// ---------------------------------------------------------------------------
// An editor-side removal drops the state with its edges, so the rows stay exact
// ---------------------------------------------------------------------------

describe('editor-side removal keeps the rows exact', () => {
  function removeFromEditor(spec: FsmSpec, nodeId: number): FsmState {
    const state = useFsm(spec)
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

  it('unassigns a pattern whose survivors are no subcube', () => {
    const state = useFsm({
      model: 'mealy',
      inputBits: 1,
      outputBits: 1,
      stateCount: 8,
      edges: [],
    })
    writeRow(state, 0, '0', 'x0x')
    FsmProject.removeStateFromEditor(1)

    const row = findRow(state, 0, '0')
    expect(row.toNodeId).toBe(-1)
    expect(row.toBinaryId).toBe('x'.repeat(state.nodeIdBitCount))
    expect(validateFsm(state).valid).toBe(true)
  })

  it('keeps a pattern that loses nothing', () => {
    const state = useFsm(specForCount(4))
    writeRow(state, 1, '0', '0x')
    FsmProject.removeStateFromEditor(3)

    expect(findRow(state, 1, '0').toBinaryId).toBe('0x')
    expect(validateFsm(state).valid).toBe(true)
  })

  it('drops the rows of the removed state and keeps the coordinates', () => {
    const state = useFsm(M2)
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
    const state = useFsm({
      ...specForCount(4, 'moore'),
      mooreOutputs: ['0', '0', '1', '0'],
    })
    writeRow(state, 0, '0', 'x0')
    expect(validateFsm(state).valid).toBe(true)

    FsmProject.removeStateFromEditor(2)

    expect(findRow(state, 0, '0').toNodeId).toBe(0)
    expect(validateFsm(state).valid).toBe(true)
  })

  it('stays compact and stable over repeated remove and add cycles', () => {
    const state = useFsm(specForCount(5))

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
    const state = useFsm({
      ...specForSize(3, 'moore'),
      outputBits: 2,
      mooreOutputs: ['01', '10', '11'],
    })

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
