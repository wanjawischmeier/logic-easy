import { describe, expect, it } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { calcBitNumber } from '@/utility/fsm/bitOperations'
import {
  ensureTransitionMatrix,
  isHiddenTransition,
  toggleTransitionOutputBit,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmNode, FsmState } from '@/projects/state-machine/FsmTypes'
import { createState, findRow, specForCount, writeRow } from './support/fixtures'
import { M2, M3, M5 } from './support/specs'
import { valueRow } from './support/assertions'

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
})

describe('M3 (Moore, two inputs, one don\u2019t-care next state)', () => {
  it('encoded truth table uses the Moore output of the state the row starts in', () => {
    const table = exportFsmToTruthTable(createState(M3))
    expect(table.inputVars).toEqual(['Z_1^n', 'Z_0^n', 'X_1', 'X_0'])
    expect(table.outputVars).toEqual(['Z_1^(n+1)', 'Z_0^(n+1)', 'Y_1', 'Y_0'])
    expect(table.values).toHaveLength(16)
    // (S0, 00) -> S2 (10), and the output is the one of S0 itself, which is 01
    expect(valueRow(table, 0)).toEqual([1, 0, 0, 1])
    // (S0, 10) -> S1 (01), the output stays the one of S0
    expect(valueRow(table, 2)).toEqual([0, 1, 0, 1])
    // (S3, 11) is the don't care row of the sheet: only the next state stays open
    expect(valueRow(table, 15)).toEqual(['-', '-', 0, 0])
  })

  it('takes the output from the present state, never from the next state', () => {
    const state = createState({
      model: 'moore',
      inputBits: 1,
      outputBits: 1,
      stateCount: 2,
      mooreOutputs: ['0', '1'],
      edges: [[0, 1, '1']],
    })
    const table = exportFsmToTruthTable(state)
    // (q0, 0) is unassigned and (q0, 1) goes to q1, but q0 outputs 0 for both inputs
    expect(valueRow(table, 0b00)).toEqual(['-', 0])
    expect(valueRow(table, 0b01)).toEqual([1, 0])
    // and q1 outputs 1 for both of its inputs
    expect(valueRow(table, 0b10)[1]).toBe(1)
    expect(valueRow(table, 0b11)[1]).toBe(1)
  })
})

// The output of a row never depends on its target state, so an open next state leaves it alone
describe('a hidden row keeps the output of its own row', () => {
  it('keeps the Mealy output of a row whose next state is open', () => {
    const state = createState({
      model: 'mealy',
      inputBits: 1,
      outputBits: 1,
      stateCount: 2,
      edges: [[0, 1, '1', '1']],
    })
    // open the next state of an otherwise concrete row, its output stays
    writeRow(state, 0, '1', 'x', '1')
    expect(isHiddenTransition(findRow(state, 0, '1'))).toBe(true)
    expect(valueRow(exportFsmToTruthTable(state), 0b01)).toEqual(['-', 1])
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
})

describe('truth table uses the same encoding as the state table', () => {
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

  it('keeps the state bit width and the row count for every state count', () => {
    for (const count of [1, 2, 3, 4, 5, 8, 9, 15, 16]) {
      const state = createState(specForCount(count))
      expect(state.nodeIdBitCount).toBe(calcBitNumber(count))
      const table = exportFsmToTruthTable(state)
      // one variable per state bit plus the input bits, and no row may be lost
      expect(table.inputVars).toHaveLength(state.nodeIdBitCount + 1)
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
})
