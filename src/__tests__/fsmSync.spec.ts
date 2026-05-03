/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager, STORAGE_VERSION } from '@/projects/stateManager'
import { disposeFsmSyncService, initFsmSyncService } from '@/utility/fsm/EditorSync/fsmListener'
import StatesTable from '@/components/StatesTable.vue'
import TransitionsTable from '@/components/TransitionsTable.vue'

if (typeof window !== 'undefined' && !(window as any).Worker) {
  (window as any).Worker = class {
    onmessage = () => {}
    postMessage = () => {}
    terminate = () => {}
    addEventListener = () => {}
    removeEventListener = () => {}
  }
}

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
          'vue-latex': { template: '<span><slot /></span>' },
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

    const row = rows[0]
    expect(row).toBeDefined()
    const editableInFirstRow = row!.findAll('td[tabindex="0"]')
    expect(editableInFirstRow).toHaveLength(2)
    expect(editableInFirstRow[0]!.text().trim()).toBe('x')

    await editableInFirstRow[0]!.trigger('click')
    await editableInFirstRow[1]!.trigger('click')
    await nextTick()

    const fsm = stateManager.state.fsm
    expect(fsm?.transitions).toBeDefined()
    const edited = fsm!.transitions.find((t) => t.input === '0')
    expect(edited?.toNodeId).toBe(0)

    wrapper.unmount()
  })

  it('b) first state-table-added node is displayed with full dont-care transition coverage', async () => {
    await addStateViaTable()
    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    const editableCells = rows.flatMap((row) => row.findAll('td[tabindex="0"]'))
    expect(editableCells.every((cell) => cell.text().trim() === 'x')).toBe(true)

    wrapper.unmount()
  })

  it('c) with 3 nodes, changing y=x and z^(n+1)=x* to y=0 and z^(n+1)=0* is exported to editor', async () => {
    await addStateViaTable()
    await addStateViaTable()
    await addStateViaTable()

    const postMessage = vi.fn()
    ;(window as any).__fsm_preloaded_iframe = {
      contentWindow: { postMessage },
    }

    initFsmSyncService()
    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    const firstRow = rows[0]
    expect(firstRow).toBeDefined()
    const editableInFirstRow = firstRow!.findAll('td[tabindex="0"]')

    await editableInFirstRow[0]!.trigger('click')
    await nextTick()

    await editableInFirstRow[2]!.trigger('click')
    await nextTick()

    await new Promise(resolve => setTimeout(resolve, 0))

    const changed = stateManager.state.fsm?.transitions.find(
      (t) => t.fromNodeId === 0 && t.input === '0',
    )

    expect(changed).toBeDefined()
    expect(changed?.toBinaryId).toBe('0x')
    expect(changed?.mealyOutput).toBe('0')
    expect(postMessage).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('d) clicking rightmost z^(n+1) cell updates transition toPattern in state for 3-node FSM', async () => {
    await addStateViaTable()
    await addStateViaTable()
    await addStateViaTable()

    const fsm = stateManager.state.fsm
    expect(fsm).toBeDefined()
    const targetIndex = fsm!.transitions.findIndex(t => t.fromNodeId === 1 && t.input === '1')
    expect(targetIndex).toBeGreaterThan(-1)

    const wrapper = mountTransitionsTable()
    await nextTick()

    const rows = wrapper.findAll('tbody tr')
    const row = rows[targetIndex]
    expect(row).toBeDefined()

    const editable = row!.findAll('td[tabindex="0"]')
    const nodeBits = fsm!.nodeIdBitCount
    const rightmostToBit = editable[nodeBits - 1]
    expect(rightmostToBit).toBeDefined()

    await rightmostToBit!.trigger('click')
    await nextTick()

    const updated = stateManager.state.fsm!.transitions[targetIndex]
    expect(updated).toBeDefined()
    expect(updated!.toBinaryId).toBeDefined()
    expect(updated!.toBinaryId!.charAt(nodeBits - 1)).toBe('0')

    wrapper.unmount()
  })
})
