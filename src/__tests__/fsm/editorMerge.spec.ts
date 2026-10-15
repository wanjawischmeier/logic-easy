import { describe, expect, it } from 'vitest'
import { importIntoEditor } from './support/editorHarness'

// ---------------------------------------------------------------------------
// Grouping: the editor merges transitions that only differ in don't-care bits
// ---------------------------------------------------------------------------

describe('the editor merges only transitions of one target and output class', () => {
  it('merges only adjacent equal-output inputs in the editor', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
      ],
      transitions: [
        { id: 1, from: 1, to: 0, input: '0', output: '0' },
        { id: 2, from: 1, to: 0, input: '1', output: '0' },
      ],
      fsmType: 'mealy',
      inputBitCount: 1,
      outputBitCount: 1,
    })

    const merged = (stores.store.get(stores.transition_list) ?? []).filter(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ input: 'x', label: 'x/0', output: '0' })
    const shownNodes = stores.store.get(stores.node_list) as Array<{
      transitions?: Array<{ id?: number }>
    }>
    expect(shownNodes[1]?.transitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: merged[0].id })]),
    )
    expect(shownNodes[0]?.transitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: merged[0].id })]),
    )
  })

  it('merges all four two-bit inputs into one double dont-care transition', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
      ],
      transitions: [
        { id: 1, from: 1, to: 0, input: '00', output: '0' },
        { id: 2, from: 1, to: 0, input: '01', output: '0' },
        { id: 3, from: 1, to: 0, input: '10', output: '0' },
        { id: 4, from: 1, to: 0, input: '11', output: '0' },
      ],
      fsmType: 'mealy',
      inputBitCount: 2,
      outputBitCount: 1,
    })

    const merged = (stores.store.get(stores.transition_list) ?? []).filter(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ input: 'xx', label: 'xx/0', output: '0' })
  })

  it('keeps only the mergeable parts when one two-bit input differs', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
        { id: 2, name: 'd' },
      ],
      transitions: [
        { id: 1, from: 1, to: 0, input: '00', output: '0' },
        { id: 2, from: 1, to: 0, input: '01', output: '0' },
        { id: 3, from: 1, to: 0, input: '10', output: '0' },
        { id: 4, from: 1, to: 2, input: '11', output: '0' },
      ],
      fsmType: 'mealy',
      inputBitCount: 2,
      outputBitCount: 1,
    })

    const merged = (stores.store.get(stores.transition_list) ?? []).filter(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(merged).toHaveLength(3)
    expect(merged.map((transition: { input?: string }) => transition.input).sort()).toEqual([
      '0x',
      '10',
      '11',
    ])
    expect(
      merged.find((transition: { input?: string }) => transition.input === '0x'),
    ).toMatchObject({
      to: 0,
    })
    expect(
      merged.find((transition: { input?: string }) => transition.input === '10'),
    ).toMatchObject({
      to: 0,
    })
    expect(
      merged.find((transition: { input?: string }) => transition.input === '11'),
    ).toMatchObject({
      to: 2,
    })
  })

  it('merges independent dont-care positions for three input bits', async () => {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', initial: true },
        { id: 1, name: 'c' },
      ],
      transitions: [
        { id: 1, from: 1, to: 0, input: '000', output: '0' },
        { id: 2, from: 1, to: 0, input: '001', output: '0' },
        { id: 3, from: 1, to: 0, input: '010', output: '0' },
        { id: 4, from: 1, to: 0, input: '011', output: '0' },
      ],
      fsmType: 'mealy',
      inputBitCount: 3,
      outputBitCount: 1,
    })

    const merged = (stores.store.get(stores.transition_list) ?? []).filter(
      (transition: { from?: number }) => transition?.from === 1,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ input: '0xx', label: '0xx/0', to: 0 })
  })

  it('never merges two-bit inputs across a target/output class', async () => {
    // Exhaust every assignment of the four input combinations to six distinct
    // Mealy classes: two targets (q0/q2) times three outputs (0/1/x).
    // This proves both safety (no over-merge) and completeness (no input lost).
    const inputs = ['00', '01', '10', '11']
    const classes = [
      { to: 0, output: '0' },
      { to: 0, output: '1' },
      { to: 0, output: 'x' },
      { to: 2, output: '0' },
      { to: 2, output: '1' },
      { to: 2, output: 'x' },
    ]
    const expand = (pattern: string): string[] => {
      if (!pattern.includes('x')) return [pattern]
      return expand(pattern.replace('x', '0')).concat(expand(pattern.replace('x', '1')))
    }

    for (let assignment = 0; assignment < classes.length ** inputs.length; assignment += 1) {
      let value = assignment
      const selected = inputs.map(() => {
        const selectedClass = classes[value % classes.length]
        if (!selectedClass) throw new Error('missing exhaustive merge class')
        value = Math.floor(value / classes.length)
        return selectedClass
      })

      const { stores } = await importIntoEditor({
        states: [
          { id: 0, name: 'q0', initial: true },
          { id: 1, name: 'c' },
          { id: 2, name: 'q2' },
        ],
        transitions: inputs.map((input, index) => ({
          id: index + 1,
          from: 1,
          to: selected[index]?.to,
          input,
          output: selected[index]?.output,
        })),
        fsmType: 'mealy',
        inputBitCount: 2,
        outputBitCount: 1,
      })

      const rendered = (stores.store.get(stores.transition_list) ?? []).filter(
        (transition: { from?: number }) => transition?.from === 1,
      ) as Array<{ input?: string; to?: number; output?: string }>
      const covered = new Map<string, number>()
      rendered.forEach((transition) => {
        const pattern = String(transition.input ?? '').replace(/-/g, 'x')
        expand(pattern).forEach((input) => {
          const expected = selected[inputs.indexOf(input)]
          if (!expected) throw new Error(`missing expected class for ${input}`)
          expect(covered.has(input)).toBe(false)
          covered.set(input, expected.to * 3)
          expect(transition.to).toBe(expected.to)
          expect(transition.output).toBe(expected.output)
        })
      })
      expect([...covered.keys()].sort()).toEqual(inputs)
    }
  })
})

interface EditorEdge {
  from?: number
  input?: string
  to?: number
  toBinaryId?: string
  hiddenDontCare?: boolean
  points?: number[]
}

describe('parallel edges between the same states', () => {
  const q0Rows: { id: number; from: number; to?: number; toBinaryId?: string; input: string }[] = [
    { id: 1, from: 0, to: 1, input: '00' },
    { id: 2, from: 0, to: -1, toBinaryId: 'xx', input: '01' },
    { id: 3, from: 0, to: 1, input: '10' },
    { id: 4, from: 0, to: 1, input: '11' },
  ]

  async function importQ0(transitions: unknown[]) {
    const { stores } = await importIntoEditor({
      states: [
        { id: 0, name: 'q0', moore_output: '00', initial: true },
        { id: 1, name: 'q1', moore_output: '11' },
        { id: 2, name: 'q2', moore_output: '01' },
        { id: 3, name: 'q3', moore_output: '10' },
      ],
      transitions,
      fsmType: 'moore',
      inputBitCount: 2,
      outputBitCount: 2,
    })
    return ((stores.store.get(stores.transition_list) ?? []) as EditorEdge[]).filter(
      (edge) => edge.from === 0,
    )
  }

  function pointKey(edges: EditorEdge[]) {
    return edges
      .map((edge) => `${edge.input}:${JSON.stringify(edge.points)}`)
      .sort()
      .join('|')
  }

  it('keeps the unassigned row out of the merge and draws the rest apart', async () => {
    const rows = await importQ0(q0Rows)
    const drawn = rows.filter((edge) => !edge.hiddenDontCare)
    const hidden = rows.filter((edge) => edge.hiddenDontCare)

    // 00 and 10 merge into x0 and 11 stays its own edge, the unassigned 01 is none of them
    expect(drawn).toHaveLength(2)
    expect(drawn.map((edge) => edge.input).sort()).toEqual(['11', 'x0'])
    expect(drawn.every((edge) => edge.to === 1)).toBe(true)

    // the unassigned row keeps its own row without a target and is never drawn
    expect(hidden).toHaveLength(1)
    expect(hidden[0]).toMatchObject({ input: '01', to: -1, toBinaryId: 'xx' })

    // parallel edges are fanned out instead of being stacked on top of each other
    expect(drawn[0]?.points).not.toEqual(drawn[1]?.points)
  })

  it('does not let the unassigned row shift the drawn geometry', async () => {
    const withHidden = await importQ0(q0Rows)
    const withoutHidden = await importQ0(q0Rows.filter((row) => row.to === 1))

    expect(pointKey(withHidden.filter((edge) => !edge.hiddenDontCare))).toBe(
      pointKey(withoutHidden),
    )
  })
})
