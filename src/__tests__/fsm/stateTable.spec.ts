import { describe, expect, it } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import {
  MAX_FSM_IO_BITS,
  MAX_FSM_STATES,
  addStateRow,
  isHiddenTransition,
  needsHiddenCleanup,
  removeStateRow,
  renameState,
  resolveMooreOutput,
  resolveTransitionTargetNodes,
  sanitizeStateName,
  setInputBitCount,
  toggleMooreOutputBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import { createState, findRow, specForCount, writeRow } from './support/fixtures'
import { M2 } from './support/specs'
import { expectMatrix, nodeAt, rowAt, valueRow } from './support/assertions'

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
