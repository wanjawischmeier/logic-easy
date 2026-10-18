import { describe, expect, it } from 'vitest'
import { calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import {
  MAX_FSM_IO_BITS,
  MAX_FSM_STATES,
  addStateRow,
  isHiddenTransition,
  needsHiddenCleanup,
  removeStateRow,
  renameState,
  resolveTransitionTargetNodes,
  sanitizeStateName,
  setInputBitCount,
  toggleStateMooreOutputBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import { createState, findRow, specForCount } from './support/fixtures'
import { M2 } from './support/specs'
import { expectMatrix, nodeAt } from './support/assertions'

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

  it('clamps the fixed input and output bit counts and keeps the matrix complete', () => {
    const state = createState(M2)
    setInputBitCount(state, 99)
    expect(state.inputBitCount).toBe(MAX_FSM_IO_BITS)
    setInputBitCount(state, 0)
    expect(state.inputBitCount).toBe(1)
    expectMatrix(state)

    // a wider input adds a row per state, narrowing removes them again
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

describe('Moore output editing', () => {
  it('toggles the output of one state in the states column and leaves the others alone', () => {
    const state = createState(specForCount(3, 'moore'))

    // the state column cycles 0 -> 1 -> x -> 0 on the state itself
    toggleStateMooreOutputBit(state, 1, 0)
    expect(nodeAt(state, 1).mooreOutput).toBe('0')
    toggleStateMooreOutputBit(state, 1, 0)
    expect(nodeAt(state, 1).mooreOutput).toBe('1')
    toggleStateMooreOutputBit(state, 1, 0)
    expect(nodeAt(state, 1).mooreOutput).toBe('x')
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['x', 'x', 'x'])

    // an id without a state is ignored
    toggleStateMooreOutputBit(state, 99, 0)
    expect(state.nodes.map((node) => node.mooreOutput)).toEqual(['x', 'x', 'x'])
  })
})

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
