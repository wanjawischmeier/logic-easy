import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { buildFsmImportPayload, forceSyncTableToEditor } from '@/utility/fsm/EditorSync/fsmListener'
import {
  ensureTransitionMatrix,
  isHiddenTransition,
  removeStateRow,
} from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmState } from '@/projects/state-machine/FsmTypes'
import { findRow, specForCount, useFsm, writeRow } from './support/fixtures'
import { M2, M4 } from './support/specs'
import { expectMatrix, snapshot } from './support/assertions'
import { throughEditor } from './support/editorHarness'

describe('state requests sync through the editor', () => {
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
})

// ---------------------------------------------------------------------------
// The app and the editor talk over strings, so a rename there must fail loudly
// ---------------------------------------------------------------------------
describe('app <-> editor protocol', () => {
  it('posts the action name the editor listener compares against', async () => {
    useFsm(M2)

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
