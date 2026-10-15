import { describe, expect, it } from 'vitest'
import { stateMachineToLC } from '@/utility/LogicCircuitsExport/StateMachineToLC'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { removeStateRow, resolveMooreOutput } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import {
  countHiddenRows,
  countHiddenRowsWithBits,
  countPendingHiddenRows,
  fsmViewMode,
  validateFsm,
} from '@/utility/fsm/EditorSync/fsmValidation'
import {
  createState,
  findRow,
  specForCount,
  specForSize,
  useFsm,
  useSize,
  writeRow,
} from './support/fixtures'
import { M2, M3 } from './support/specs'
import {
  IO_CASES,
  expectMatrix,
  lifecycleSpec,
  nextStateCellsAreOpenOnlyForHiddenRows,
} from './support/assertions'
import { throughEditor } from './support/editorHarness'

describe('Moore rows over a covered group', () => {
  it('keeps a covered group with different outputs valid and shows the shared output', () => {
    const state = createState(M3)
    const row = findRow(state, 0, '00')
    row.toNodeId = -1
    // 1x covers the states q2 (11) and q3 (00), whose outputs differ
    row.toBinaryId = '1x'
    expect(validateFsm(state).valid).toBe(true)
    expect(resolveMooreOutput(state, row)).toBe('xx')

    // a concrete pattern reports the output of the state it points at
    row.toBinaryId = '01'
    expect(resolveMooreOutput(state, row)).toBe('10')
  })

  it('still locks a Moore row that names a state which does not exist', () => {
    const state = useFsm(specForCount(3, 'moore'))
    // index 3 has no state, and a don't care in the output cannot hide that
    writeRow(state, 0, '0', '11')
    expect(validateFsm(state)).toEqual({
      valid: false,
      reason: 'The transition from "q0" with input 0 points at a non-existing state.',
    })

    writeRow(state, 0, '0', '01')
    expect(validateFsm(state).valid).toBe(true)
  })
})

describe('the overlay follows the drawn edges only', () => {
  // Two or more state bits are needed for a partially filled hidden row
  IO_CASES.forEach(({ model, inputBits, outputBits }) => {
    ;[3, 4, 5, 8, 15, 16].forEach((stateCount) => {
      it(`${model} ${inputBits}/${outputBits} bits, ${stateCount} states: hide, clear, remove, add`, () => {
        const state = useFsm(lifecycleSpec(model, inputBits, outputBits, stateCount))
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
        const state = useFsm(lifecycleSpec(model, inputBits, outputBits, stateCount))
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
      const state = useFsm(lifecycleSpec(model, inputBits, outputBits, 3))
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
        const state = useFsm(lifecycleSpec(model, inputBits, outputBits, stateCount))

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
    const state = useSize(3, 'mealy')
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
    const state = useFsm(M2)
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
    const state = useFsm({ ...specForSize(3, 'moore'), outputBits: 2 })
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
