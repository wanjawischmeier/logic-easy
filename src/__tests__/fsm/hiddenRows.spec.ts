import { describe, expect, it } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { stateMachineToLC } from '@/utility/LogicCircuitsExport/StateMachineToLC'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { buildFsmImportPayload } from '@/utility/fsm/EditorSync/fsmListener'
import {
  isHiddenTransition,
  needsHiddenCleanup,
  removeStateRow,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { countPendingHiddenRows, validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import {
  createState,
  findRow,
  specForCount,
  specForSize,
  useFsm,
  useSize,
  writeRow,
} from './support/fixtures'
import { M2, M4 } from './support/specs'
import { expectMatrix, valueRow } from './support/assertions'
import { editorModules } from './support/editorHarness'

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

  it('clears the bits of every hidden row once, without changing the derived views', () => {
    const state = useFsm(M4)
    const tableBefore = exportFsmToTruthTable(state)
    const lcBefore = stateMachineToLC(state, { encoding: 'Binary', flipFlopType: 'D' }).toString()
    const drawnBefore = state.transitions
      .filter((transition) => !isHiddenTransition(transition))
      .map((transition) => ({ ...transition }))

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
    // a second run has nothing left to clear and leaves the drawn rows untouched
    expect(FsmProject.clearHiddenRowBits()).toBe(0)
    const drawnAfter = state.transitions.filter((transition) => !isHiddenTransition(transition))
    expect(drawnAfter.map((transition) => ({ ...transition }))).toEqual(drawnBefore)
  })

  it('clears the output of a hidden Mealy row as well', () => {
    const state = useFsm(specForCount(3))
    writeRow(state, 0, '0', '1x', '1')
    expect(needsHiddenCleanup(findRow(state, 0, '0'))).toBe(true)

    FsmProject.clearHiddenRowBits()

    expect(findRow(state, 0, '0').mealyOutput).toBe('x'.repeat(state.outputBitCount ?? 1))
    expect(validateFsm(state).valid).toBe(true)
  })

  it('agrees with the editor about which rows are hidden', async () => {
    const { stores, exportModule } = await editorModules()

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

      exportModule.clearFsmFromParent()
      stores.store.set(stores.stage_ref, null)
      exportModule.applyFsmImport(buildFsmImportPayload(state))

      const entry = (stores.store.get(stores.transition_list) ?? []).find(
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

  it('leaves the cells of a hidden row open in the table, Mealy and Moore alike', () => {
    // Moore: (q0, 0) is hidden, so only its next-state cells stay open while the output
    // stays the one of the state the row starts in
    const moore = createState({
      ...specForSize(4, 'moore'),
      outputBits: 2,
      mooreOutputs: ['01', '10', '11', '00'],
    })
    const drawnBefore = exportFsmToTruthTable(moore)
    // (q1, 0) -> q2 keeps the output of the state the row starts in, which is q1
    writeRow(moore, 1, '0', 2)
    expect(valueRow(exportFsmToTruthTable(moore), 0b010)).toEqual([1, 0, 1, 0])

    writeRow(moore, 0, '0', 'x0')
    expect(valueRow(exportFsmToTruthTable(moore), 0b000)).toEqual(['-', '-', 0, 1])
    expect(validateFsm(moore).valid).toBe(true)
    expect(drawnBefore.values).toHaveLength(exportFsmToTruthTable(moore).values.length)

    // Mealy: two state bits plus one output bit, the output of a hidden row is ignored
    const mealy = createState(specForSize(3, 'mealy'))
    writeRow(mealy, 0, '0', '1x', '1')
    expect(valueRow(exportFsmToTruthTable(mealy), 0b000)).toEqual(['-', '-', '-'])
    expect(validateFsm(mealy).valid).toBe(true)
  })

  it('clears a removed target as well and drops its stale index', () => {
    const state = useFsm(M2)
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

  it('reports pending hidden rows only while the drawn machine is valid', () => {
    const state = useFsm(specForCount(3))
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

describe('the panels unlock as soon as the machine is valid again', () => {
  it('keeps a hidden row valid and resolves it again once a next state is picked', () => {
    const state = useFsm(M2)
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
