import { describe, expect, it } from 'vitest'
import { exportFsmToTruthTable } from '@/utility/fsm/kvSync'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { calcBitNumber } from '@/utility/fsm/bitOperations'
import {
  addStateRow,
  ensureTransitionMatrix,
  isHiddenTransition,
  removeStateRow,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { createState, findRow } from './support/fixtures'
import { FSM_SPECS, M4 } from './support/specs'
import {
  clickOutputBitsUntil,
  clickTargetBitsUntil,
  coveredNames,
  expectMatrix,
  nodeAt,
  nodeName,
  roundtrip,
  rowAt,
  snapshot,
  targetPattern,
  toEditorPayload,
  valueRow,
} from './support/assertions'

describe('the FSM stays identical in table, central state and editor sync', () => {
  FSM_SPECS.forEach(({ name, spec, expected }) => {
    it(`${name}: central state is exactly the drawn, well formed FSM`, () => {
      const state = createState(spec)
      if (expected.length > 0) expect(snapshot(state)).toEqual(expected)
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

  // Coordinates travel with the states, so one spec proves it for all of them
  it('moving states only carries coordinates', () => {
    const state = createState(M4)
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
    const swapped = createState(M4)
    nodeAt(swapped, 0).editorCoordX = 400
    nodeAt(swapped, swapped.nodes.length - 1).editorCoordX = 5
    expect(snapshot(roundtrip(swapped))).toEqual(snapshot(swapped))
  })
})

describe('M4 (six states, patterns, two inputs)', () => {
  it('keeps partial patterns as hidden rows and opens only their next state cells', () => {
    const state = createState(M4)
    expectMatrix(state)
    expect(validateFsm(state).valid).toBe(true)

    const table = exportFsmToTruthTable(state)
    // three state bits plus two input bits -> 32 rows
    expect(table.inputVars).toHaveLength(5)
    expect(table.values).toHaveLength(32)
    // (q0, 10) covers q0 and q1 (pattern 00x) -> hidden, so only the next state cells stay
    // open while the row keeps the output of its own transition
    const row = findRow(state, 0, '10')
    expect(row.toBinaryId).toBe('00x')
    expect(isHiddenTransition(row)).toBe(true)
    expect(valueRow(table, 0b00010)).toEqual(['-', '-', '-', 1, 1])
    // (q4, 11) covers q2 and q3 (pattern 01x) -> hidden as well
    expect(valueRow(table, 0b10011)).toEqual(['-', '-', '-', 1, 0])
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
