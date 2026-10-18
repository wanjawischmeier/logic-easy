import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import FsmViewGate from '@/components/FsmViewGate.vue'
import TransitionsTable from '@/components/TransitionsTable.vue'
import HiddenEdgesNotice from '@/components/HiddenEdgesNotice.vue'
import HiddenTransitionsBadge from '@/components/HiddenTransitionsBadge.vue'
import { stateManager } from '@/projects/stateManager'
import { removeStateRow } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import { fsmViewMode, validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import type { FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { createState, findRow, specForCount, writeRow } from './support/fixtures'
import type { FsmSpec } from './support/fixtures'
import { M2 } from './support/specs'
import { expectMatrix, lifecycleSpec } from './support/assertions'

describe('the transitions table marks the rows the editor hides', () => {
  function mountTable(state: FsmState) {
    stateManager.state.fsm = state
    return mount(TransitionsTable, { global: { stubs: { 'vue-latex': true } } })
  }

  // The whole row is dimmed, the numbers as well as the editable cells
  function isDimmedRow(row: { classes(): string[] }): boolean {
    return row.classes().includes('text-on-surface-disabled')
  }

  it('dims a row with a partial next state and a row without any next state', () => {
    const state = createState(specForCount(4))
    writeRow(state, 0, '0', 'x0') // q0 -0-> covers two states
    writeRow(state, 1, '0', 2) // q1 -0-> stays concrete
    const wrapper = mountTable(state)

    expect(findRow(state, 0, '0').toNodeId).toBe(-1)
    expect(findRow(state, 1, '0').toNodeId).toBe(2)

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(8)
    expect(isDimmedRow(rows[0]!)).toBe(true) // q0 -0-> two states
    expect(isDimmedRow(rows[1]!)).toBe(true) // q0 -1-> still unassigned
    expect(isDimmedRow(rows[2]!)).toBe(false) // q1 -0-> q2 is concrete
    expect(isDimmedRow(rows[3]!)).toBe(true) // q1 -1-> still unassigned
  })

  it('dims a row whose target was removed until it is picked again', () => {
    const state = createState(M2)
    removeStateRow(state, 2)
    const wrapper = mountTable(state)

    const rows = wrapper.findAll('tbody tr')
    const flaggedRow = state.transitions.find((transition) => transition.removedTarget)
    const index = state.transitions.indexOf(flaggedRow as FsmTransition)
    expect(isDimmedRow(rows[index]!)).toBe(true)

    writeRow(state, 0, '1', 0)
    const fixed = mountTable(state)
    expect(isDimmedRow(fixed.findAll('tbody tr')[index]!)).toBe(false)
  })
})

describe('the hidden row overlays', () => {
  it('tells the user about the hidden rows and confirms with the button', async () => {
    const wrapper = mount(HiddenEdgesNotice, { props: { count: 3 } })
    expect(wrapper.text()).toContain('Hidden transitions')
    expect(wrapper.text()).toContain("3 transitions have a don't care (-) as their next state")
    // what the click does has to be readable before clicking
    expect(wrapper.text()).toContain('have to be set completely to -')

    const button = wrapper.get('button')
    expect(button.text()).toBe('Continue anyway')
    await button.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    // the single case has to read as one sentence, never as a plural mix
    const single = mount(HiddenEdgesNotice, { props: { count: 1 } })
    expect(single.text()).toContain("One transition has a don't care (-) as its next state")
    expect(single.text()).toContain('It is not drawn')
    expect(single.text()).not.toContain('transitions have')
    expect(single.text()).not.toContain('They are not drawn')
  })

  it('names the count, points the hidden edges badge at the rules and explains them on hover', () => {
    const wrapper = mount(HiddenTransitionsBadge, { props: { count: 3, pending: 2 } })
    const link = wrapper.get('a')

    expect(link.attributes('href')).toContain(
      'docs/views/state-machine/tables.html#hidden-next-states',
    )
    expect(link.attributes('title')).toContain(
      "A next state with - (don't care) covers several states",
    )
    expect(link.attributes('title')).toContain('it never makes the machine invalid')
    expect(link.attributes('title')).toContain('2 of them still show bits')
    expect(link.text()).toBe('3 edges hidden')
    // an info badge, never an error badge
    expect(link.classes()).toContain('text-primary-variant')
    expect(link.classes().join(' ')).not.toContain('red-')

    // the badge reports every hidden edge, so the pending part is optional
    const clean = mount(HiddenTransitionsBadge, { props: { count: 4 } })
    expect(clean.get('a').attributes('title')).toContain('None of them still shows bits')
    expect(clean.get('a').text()).toBe('4 edges hidden')

    // a single hidden edge reads as one edge
    const single = mount(HiddenTransitionsBadge, { props: { count: 1, pending: 1 } })
    expect(single.get('a').text()).toBe('1 edge hidden')
    expect(single.get('a').attributes('title')).toContain('One of them still shows bits')
  })
})

describe('the shared gate renders exactly one overlay and reacts to it', () => {
  // The gate reads the reactive FSM, so the tests mutate the same proxy the panels use
  function useGate(spec: FsmSpec, hint = 'Fix it.') {
    const state = reactive(createState(spec)) as FsmState
    stateManager.state.fsm = state
    const gate = mount(FsmViewGate, {
      props: { fsm: state, hint },
      slots: { default: '<p class="view-content">view content</p>' },
    })
    return { state, gate }
  }

  it('opens and closes the view the same way for Mealy and Moore', async () => {
    for (const model of ['mealy', 'moore'] as const) {
      const { state, gate } = useGate(lifecycleSpec(model, 1, 1, 3))

      // 1) a valid machine without pending rows shows the content
      expect(gate.text()).toContain('view content')

      // 2) a hidden row with bits: the new overlay, and the content is gone
      writeRow(state, 0, '0', '0x')
      await nextTick()
      expect(gate.text()).toContain('Hidden transitions')
      expect(gate.text()).toContain('Continue anyway')
      expect(gate.text()).not.toContain('view content')
      expect(gate.text()).not.toContain('FSM Invalid')

      // 3) accepting it clears the rows and reopens the view
      await gate.get('button').trigger('click')
      await nextTick()
      expect(gate.text()).toContain('view content')
      expect(gate.text()).not.toContain('Hidden transitions')
      expect(fsmViewMode(state)).toBe('ready')
      expectMatrix(state)

      // 4) a broken drawn row locks with the known overlay and names the row
      writeRow(state, 1, '0', '11')
      await nextTick()
      expect(gate.text()).toContain('FSM Invalid')
      expect(gate.text()).toContain('q1')
      expect(gate.text()).not.toContain('Continue anyway')

      // 5) repairing it asks for the hidden rows again, clearing them shows the view
      writeRow(state, 1, '0', '00')
      writeRow(state, 2, '1', '1x')
      await nextTick()
      expect(gate.text()).toContain('Hidden transitions')
      await gate.get('button').trigger('click')
      await nextTick()
      expect(gate.text()).toContain('view content')
      expect(validateFsm(state).valid).toBe(true)
      expectMatrix(state)
    }
  })

  it('locks a broken machine even while hidden rows are pending', async () => {
    const { state, gate } = useGate(lifecycleSpec('moore', 2, 2, 3))

    writeRow(state, 0, '00', '0x')
    await nextTick()
    expect(gate.text()).toContain('Hidden transitions')

    writeRow(state, 2, '11', '11')
    await nextTick()
    expect(gate.text()).toContain('FSM Invalid')
    expect(gate.text()).toContain('q2')
    expect(gate.text()).not.toContain('Continue anyway')

    writeRow(state, 2, '11', '10')
    await nextTick()
    expect(gate.text()).toContain('Hidden transitions')
    expect(gate.text()).not.toContain('FSM Invalid')
  })
})
