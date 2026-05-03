/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager, STORAGE_VERSION } from '@/projects/stateManager'
import { disposeFsmSyncService, initFsmSyncService } from '@/utility/fsm/EditorSync/fsmListener'
import StatesTable from '@/components/StatesTable.vue'
import TransitionsTable from '@/components/TransitionsTable.vue'

function resetStateManager() {
  Object.keys(stateManager.state).forEach((key) => {
    if (key !== 'version') {
      delete (stateManager.state as Record<string, unknown>)[key]
    }
  })
  stateManager.state.version = STORAGE_VERSION
}

describe('FSM editor <-> table transition sync', () => {
  beforeEach(() => {
    resetStateManager()
    FsmProject.createState({
      name: 'FSM',
      initialFsmType: 'mealy',
      initialInputBits: 1,
      initialOutputBits: 1,
    })
  })

  afterEach(() => {
    disposeFsmSyncService()
    delete (window as any).__fsm_preloaded_iframe
    resetStateManager()
  })

  async function addStateViaTable() {
    const wrapper = mount(StatesTable)
    const addButton = wrapper.find('button[title="Add state"]')
    expect(addButton.exists()).toBe(true)
    await addButton.trigger('click')
    await nextTick()
    wrapper.unmount()
  }

  function mountTransitionsTable() {
    return mount(TransitionsTable, {
      global: {
        stubs: {
          'vue-latex': { template: '<span />' },
        },
      },
    })
  }

  it('a) first editor-added node is displayed with full dont-care transition coverage and editable cells', async () => {
    FsmProject.importEditorExport({
      states: [{ id: 42, name: 'q0', initial: true }],
      transitions: [],
    })

    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    const firstRow = rows[0]
    expect(firstRow).toBeDefined()

    const editableInFirstRow = firstRow!.findAll('td[tabindex="0"]')
    expect(editableInFirstRow).toHaveLength(2)
    expect(editableInFirstRow[0]!.text().trim()).toBe('x')
    expect(editableInFirstRow[1]!.text().trim()).toBe('x')

    await editableInFirstRow[0]!.trigger('click')
    await editableInFirstRow[1]!.trigger('click')
    await nextTick()

    const fsm = stateManager.state.fsm
    expect(fsm).toBeDefined()
    expect(fsm!.nodes).toHaveLength(1)
    expect(fsm!.nodeIdBitCount).toBe(1)

    const transitions = fsm!.transitions
    expect(transitions).toHaveLength(2)
    expect(transitions.map((t) => t.input)).toEqual(['0', '1'])
    expect(transitions.every((t) => t.fromNodeId === 0)).toBe(true)
    const edited = transitions.find((t) => t.input === '0')
    expect(edited?.toNodeId).toBe(0)
    expect(edited?.mealyOutput).toBe('0')

    wrapper.unmount()
  })

  it('b) first state-table-added node is displayed with full dont-care transition coverage', async () => {
    await addStateViaTable()

    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    const editableCells = rows.flatMap((row) => row.findAll('td[tabindex="0"]'))
    expect(editableCells).toHaveLength(4)
    expect(editableCells.every((cell) => cell.text().trim() === 'x')).toBe(true)

    const fsm = stateManager.state.fsm
    expect(fsm).toBeDefined()

    expect(fsm!.nodes).toHaveLength(1)
    expect(fsm!.nodeIdBitCount).toBe(1)
    expect(fsm!.transitions).toHaveLength(2)
    expect(fsm!.transitions.map((t) => t.input)).toEqual(['0', '1'])
    // Cast to any to handle the 'toPattern' property check
    expect(fsm!.transitions.every((t: any) => (t.toPattern ?? 'x') === 'x')).toBe(true)
    expect(fsm!.transitions.every((t) => (t.mealyOutput ?? 'x') === 'x')).toBe(true)

    wrapper.unmount()
  })

  it('c) with 3 nodes, changing y=x and z^(n+1)=x* to y=0 and z^(n+1)=0* is exported to editor', async () => {
    await addStateViaTable()
    await addStateViaTable()
    await addStateViaTable()

    expect(stateManager.state.fsm?.nodes).toHaveLength(3)
    expect(stateManager.state.fsm?.nodeIdBitCount).toBe(2)

    const postMessage = vi.fn()
    ;(window as any).__fsm_preloaded_iframe = {
      contentWindow: { postMessage },
    }

    initFsmSyncService()
    postMessage.mockClear()

    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    const firstRow = rows[0]
    expect(firstRow).toBeDefined()

    const editableInFirstRow = firstRow!.findAll('td[tabindex="0"]')
    expect(editableInFirstRow).toHaveLength(3)

    await editableInFirstRow[0]!.trigger('click')
    await editableInFirstRow[2]!.trigger('click')

    await nextTick()
    await nextTick()

    const changed = stateManager.state.fsm?.transitions.find(
      (t) => t.fromNodeId === 0 && t.input === '0',
    ) as any
    expect(changed).toBeDefined()
    expect(changed.toNodeId).toBe(-1)
    expect(changed.toPattern).toBe('0x')
    expect(changed.mealyOutput).toBe('0')

    expect(postMessage).toHaveBeenCalled()
    const calls = postMessage.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall).toBeDefined()
    const lastPayload = lastCall![0]
    expect(lastPayload.action).toBe('fsmimport')

    const exported = lastPayload.fsm.transitions.find((t: any) => t.from === 0 && t.input === '0')

    expect(exported).toBeDefined()
    expect(exported.to).toBe(-1)
    expect(exported.toPattern).toBe('0x')
    expect(exported.output).toBe('0')
    expect(exported.mealy_output).toBe('0')

    wrapper.unmount()
  })

  it('d) clicking rightmost z^(n+1) cell updates transition toPattern in state for 3-node FSM', async () => {
    await addStateViaTable()
    await addStateViaTable()
    await addStateViaTable()

    const fsm = stateManager.state.fsm
    expect(fsm).toBeDefined()
    expect(fsm!.nodes).toHaveLength(3)

    const targetTransitionIndex = fsm!.transitions.findIndex(
      (t) => t.fromNodeId === 1 && t.input === '1',
    )
    expect(targetTransitionIndex).toBeGreaterThanOrEqual(0)

    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    const row = rows[targetTransitionIndex]
    expect(row).toBeDefined()

    const editable = row!.findAll('td[tabindex="0"]')
    const nodeBits = stateManager.state.fsm!.nodeIdBitCount
    const rightmostToBit = editable[nodeBits - 1]
    expect(rightmostToBit).toBeDefined()

    expect(rightmostToBit!.text().trim()).toBe('x')

    await rightmostToBit!.trigger('click')
    await nextTick()

    const updated = stateManager.state.fsm!.transitions[targetTransitionIndex] as any
    expect(updated).toBeDefined()
    expect(updated.toNodeId).toBe(-1)
    expect(updated.toPattern).toBeDefined()
    expect(updated.toPattern.charAt(nodeBits - 1)).toBe('0')

    wrapper.unmount()
  })
})
