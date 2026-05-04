// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  active_transition,
  engine_mode,
  fsm_type,
  initial_state,
  node_list,
  stage_ref,
  store,
  transition_list,
} from '../../public/fsm-engine/src/lib/stores.js'
import { extractFsmData } from '../../public/fsm-engine/src/lib/export.js'
import {
  handleTransitionSave,
  setTransitionBitLengths,
} from '../../public/fsm-engine/src/lib/transitions.js'

type MockShape = {
  text: ReturnType<typeof vi.fn>
  x: ReturnType<typeof vi.fn>
  y: ReturnType<typeof vi.fn>
}

function makeNode(id: number) {
  return {
    id,
    x: 100 + id * 60,
    y: 100,
    name: `q${id}`,
    radius: 40,
    fill: '#4a6fae88',
    type: {
      initial: id === 0,
      intermediate: id !== 0,
      final: false,
    },
    moore_output: '',
    transitions: [],
  }
}

function resetStore(stage: any = null) {
  store.set(node_list, [])
  store.set(transition_list, [])
  store.set(initial_state, null)
  store.set(fsm_type, 'mealy')
  store.set(engine_mode, { type: 'Free Style', alphabets: [] })
  store.set(active_transition, null)
  store.set(stage_ref, stage)
}

function makeStageMock(transitionIds: number[]): { stage: any; shapes: Map<string, MockShape> } {
  const shapes = new Map<string, MockShape>()

  transitionIds.forEach((id) => {
    const textShape = { text: vi.fn() }
    const labelShape = { x: vi.fn(), y: vi.fn() }
    shapes.set(`#trtext_${id}`, textShape as MockShape)
    shapes.set(`#tr_label${id}`, labelShape as MockShape)
  })

  const stage = {
    x: vi.fn(() => 0),
    y: vi.fn(() => 0),
    scaleX: vi.fn(() => 1),
    scaleY: vi.fn(() => 1),
    findOne: vi.fn((selector: string) => shapes.get(selector) ?? null),
    batchDraw: vi.fn(),
  }

  return { stage, shapes }
}

async function waitForTransitionCount(expectedCount: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const count = (store.get(transition_list) ?? []).filter(Boolean).length
    if (count === expectedCount) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error(`Timed out waiting for ${expectedCount} transitions`)
}

describe('FSM engine wildcard transition mapping', () => {
  beforeEach(() => {
    resetStore()
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetStore()
  })

  it.each([
    ['trailing wildcard', '0x', ['00', '01']],
    ['leading wildcard', 'x0', ['00', '10']],
    ['double wildcard', 'xx', ['00', '01', '10', '11']],
    ['concrete target', '01', ['01']],
  ])(
    'round-trips %s without losing the next-state pattern',
    async (_name, pattern, expectedTargets) => {
      const nodes = [makeNode(0), makeNode(1), makeNode(2), makeNode(3)]
      const importPayload = {
        states: nodes.map((node) => ({
          id: node.id,
          name: node.name,
          initial: node.type.initial,
          final: node.type.final,
          x: node.x,
          y: node.y,
          moore_output: '',
        })),
        transitions: [
          {
            id: 7,
            from: 0,
            to: -1,
            toBinaryId: pattern,
            input: '0',
            output: '1',
            mealy_output: '1',
          },
        ],
        fsmType: 'mealy',
      }

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { action: 'fsmimport', fsm: importPayload },
          origin: window.location.origin,
          source: window.parent,
        }),
      )

      await waitForTransitionCount(expectedTargets.length)

      const importedTransitions = (store.get(transition_list) ?? []).filter(Boolean)
      expect(importedTransitions).toHaveLength(expectedTargets.length)
      expect(new Set(importedTransitions.map((transition) => transition.groupId))).toEqual(
        new Set([7]),
      )
      expect(importedTransitions.map((transition) => transition.toBinaryId).sort()).toEqual(
        expectedTargets.slice().sort(),
      )

      const exported = extractFsmData()
      expect(exported.transitions).toHaveLength(1)
      expect(exported.transitions[0]?.toBinaryId).toBe(pattern)
      expect(exported.transitions[0]?.input).toBe('0')
      expect(exported.transitions[0]?.output).toBe('1')
    },
  )

  it('propagates label edits across all edges of one logical transition group', async () => {
    const { stage } = makeStageMock([0, 1])
    resetStore(stage)
    store.set(node_list, [makeNode(0), makeNode(1), makeNode(2), makeNode(3)])
    store.set(transition_list, [
      {
        id: 0,
        groupId: 7,
        from: 0,
        to: 0,
        toBinaryId: '00',
        input: '0',
        output: '1',
        mealyOutput: '1',
        label: '0/1',
        points: [0, 0, 10, 10, 20, 20],
        isDraft: false,
      },
      {
        id: 1,
        groupId: 7,
        from: 0,
        to: 1,
        toBinaryId: '01',
        input: '0',
        output: '1',
        mealyOutput: '1',
        label: '0/1',
        points: [0, 0, 10, 10, 20, 20],
        isDraft: false,
      },
    ])
    store.set(active_transition, 0)

    handleTransitionSave(['1/0'])

    const updatedTransitions = (store.get(transition_list) ?? []).filter(Boolean)
    expect(updatedTransitions.every((transition) => transition.label === '1/0')).toBe(true)

    const exported = extractFsmData()
    expect(exported.transitions).toHaveLength(1)
    expect(exported.transitions[0]?.input).toBe('1')
    expect(exported.transitions[0]?.output).toBe('0')
    expect(exported.transitions[0]?.toBinaryId).toBe('0x')
  })

  it('rejects an input change that would overlap with another transition from the same state', () => {
    const { stage } = makeStageMock([0, 1])
    resetStore(stage)
    store.set(node_list, [makeNode(0), makeNode(1), makeNode(2), makeNode(3)])
    store.set(transition_list, [
      {
        id: 0,
        groupId: 7,
        from: 0,
        to: 0,
        toBinaryId: '01',
        input: '1',
        output: '1',
        mealyOutput: '1',
        label: '1/1',
        points: [0, 0, 10, 10, 20, 20],
        isDraft: false,
      },
      {
        id: 1,
        groupId: 8,
        from: 0,
        to: 1,
        toBinaryId: '10',
        input: '0',
        output: '0',
        mealyOutput: '0',
        label: '0/0',
        points: [0, 0, 10, 10, 20, 20],
        isDraft: false,
      },
    ])
    store.set(active_transition, 0)

    handleTransitionSave(['0x/1'])

    const transitions = (store.get(transition_list) ?? []).filter(Boolean)
    expect(transitions[0]?.label).toBe('1/1')
    expect(transitions[1]?.label).toBe('0/0')
  })

  it('requires labels to match the current input and output bit counts exactly', () => {
    const { stage } = makeStageMock([0])
    resetStore(stage)
    store.set(node_list, [makeNode(0), makeNode(1), makeNode(2), makeNode(3)])
    store.set(transition_list, [
      {
        id: 0,
        groupId: 7,
        from: 0,
        to: 1,
        toBinaryId: '01',
        input: '00',
        output: '11',
        mealyOutput: '11',
        label: '00/11',
        points: [0, 0, 10, 10, 20, 20],
        isDraft: false,
      },
    ])
    store.set(active_transition, 0)

    setTransitionBitLengths(2, 2)
    store.set(active_transition, 0)

    handleTransitionSave(['1/11'])

    expect((store.get(transition_list) ?? [])[0]?.label).toBe('00/11')

    store.set(active_transition, 0)
    handleTransitionSave(['111/11'])

    expect((store.get(transition_list) ?? [])[0]?.label).toBe('00/11')

    store.set(active_transition, 0)
    handleTransitionSave(['00/1'])

    expect((store.get(transition_list) ?? [])[0]?.label).toBe('00/11')

    store.set(active_transition, 0)
    handleTransitionSave(['00/111'])

    expect((store.get(transition_list) ?? [])[0]?.label).toBe('00/11')

    store.set(active_transition, 0)
    handleTransitionSave(['01/10'])

    const updated = (store.get(transition_list) ?? []).filter(Boolean)
    expect(updated[0]?.label).toBe('01/10')

    const exported = extractFsmData()
    expect(exported.transitions).toHaveLength(1)
    expect(exported.transitions[0]?.input).toBe('01')
    expect(exported.transitions[0]?.output).toBe('10')
  })
})
