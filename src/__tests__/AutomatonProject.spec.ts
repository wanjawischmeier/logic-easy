import { describe, it, expect, beforeEach } from 'vitest'
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'
import type { AutomatonState, AutomatonType } from '@/projects/automaton/AutomatonTypes'

describe('AutomatonProject - Defensive Tests for Code Quality Detection', () => {
  describe('Automaton Type Validation', () => {
    it('should preserve automaton types exactly (mealy and moore)', () => {
      const mealyResult = AutomatonProject['normalizeState']({
        states: [],
        transitions: [],
        automatonType: 'mealy' as AutomatonType,
      })
      expect(mealyResult.automatonType).toBe('mealy')
      expect(mealyResult.automatonType).not.toBe('moore')

      const mooreResult = AutomatonProject['normalizeState']({
        states: [],
        transitions: [],
        automatonType: 'moore' as AutomatonType,
      })
      expect(mooreResult.automatonType).toBe('moore')
      expect(mooreResult.automatonType).not.toBe('mealy')
    })

    it('should default invalid types to mealy with no exceptions', () => {
      const invalidTypes = [
        undefined as unknown as AutomatonType,
        null as unknown as AutomatonType,
        '' as AutomatonType,
        'invalid' as unknown as AutomatonType,
        'MEALY' as unknown as AutomatonType,
        123 as unknown as AutomatonType,
        {} as unknown as AutomatonType,
        [] as unknown as AutomatonType,
      ]

      for (const invalid of invalidTypes) {
        const result = AutomatonProject['normalizeState']({
          states: [],
          transitions: [],
          automatonType: invalid,
        })
        expect(result.automatonType).toBe('mealy')
      }
    })
  })

  describe('State Normalization - Input Immutability & Data Integrity', () => {
    it('should not mutate input states array reference', () => {
      const original = [
        { id: 3, name: 'q3', initial: false, final: false },
        { id: 1, name: 'q1', initial: false, final: false },
      ]
      const input = { states: original, transitions: [], automatonType: 'mealy' as const }
      const originalRef = input.states

      AutomatonProject['normalizeState'](input)

      // Input reference must not be mutated
      expect(input.states).toBe(originalRef)
    })

    it('should produce sorted output without mutating input order', () => {
      const unsorted = [
        { id: 5, name: 'q5', initial: false, final: false },
        { id: 2, name: 'q2', initial: false, final: false },
        { id: 1, name: 'q1', initial: false, final: false },
      ]
      const input = { states: unsorted, transitions: [], automatonType: 'mealy' as const }
      const originalOrder = unsorted.map((s) => s.id)

      const result = AutomatonProject['normalizeState'](input)

      // Output must be sorted
      expect(result.states.map((s) => s.id)).toEqual([1, 2, 5])
      // Input must remain unchanged
      expect(input.states.map((s) => s.id)).toEqual(originalOrder)
    })

    it('should reject states with non-integer id field', () => {
      const invalid = [
        { id: null as unknown as number, name: 'a', initial: false, final: false },
        { id: undefined as unknown as number, name: 'b', initial: false, final: false },
        { id: NaN, name: 'c', initial: false, final: false },
        { id: 1.5, name: 'd', initial: false, final: false }, // decimal ids invalid
      ]
      const valid = { id: 1, name: 'q1', initial: false, final: false }

      const result = AutomatonProject['normalizeState']({
        states: [...invalid, valid] as AutomatonState['states'],
        transitions: [],
        automatonType: 'mealy',
      })

      expect(result.states).toHaveLength(1)
      expect(result.states[0]?.id).toBe(1)
    })

    it('should maintain exact numeric precision for positions', () => {
      const testPositions = [
        { x: 0, y: 0 },
        { x: 100.5, y: -200.7 },
        { x: 999999.123, y: -999999.456 },
      ]

      const result = AutomatonProject['normalizeState']({
        states: testPositions.map((p, i) => ({
          id: i,
          name: `q${i}`,
          initial: false,
          final: false,
          x: p.x,
          y: p.y,
        })),
        transitions: [],
        automatonType: 'mealy' as const,
      })

      result.states.forEach((state, idx) => {
        expect(state.x).toBe(testPositions[idx]!.x)
        expect(state.y).toBe(testPositions[idx]!.y)
      })
    })
  })

  describe('Transition Normalization - Correctness & Invariants', () => {
    it('should only accept transitions with valid from state id', () => {
      const result = AutomatonProject['normalizeState']({
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 5, name: 'q5', initial: false, final: false },
        ],
        transitions: [
          { id: 1, from: 0, to: 5, input: '1', output: '0' }, // valid
          { id: 2, from: 5, to: 0, input: '0', output: '1' }, // valid
          { id: 3, from: 99, to: 0, input: 'x', output: 'y' }, // invalid from
          { id: 4, from: -1, to: 5, input: 'z', output: 'w' }, // invalid from
        ],
        automatonType: 'mealy',
      })

      const fromIds = new Set(result.transitions.map((t) => t.from))
      // Only valid state IDs should be present
      expect(fromIds.has(0)).toBe(true)
      expect(fromIds.has(5)).toBe(true)
      // Invalid from IDs should be filtered
      expect(fromIds.has(99)).toBe(false)
      expect(fromIds.has(-1)).toBe(false)
    })

    it('should maintain stable sort order: (from, input) lexicographically', () => {
      const result = AutomatonProject['normalizeState']({
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: false },
          { id: 2, name: 'q2', initial: false, final: false },
        ],
        transitions: [
          { id: 10, from: 2, to: 0, input: 'c', output: '0' },
          { id: 5, from: 0, to: 1, input: 'b', output: '1' },
          { id: 2, from: 0, to: 0, input: 'a', output: '0' },
          { id: 8, from: 1, to: 2, input: 'z', output: '1' },
          { id: 3, from: 0, to: 2, input: 'c', output: '0' },
        ],
        automatonType: 'mealy',
      })

      // Verify invariant: each transition respects ordering
      for (let i = 0; i < result.transitions.length - 1; i++) {
        const curr = result.transitions[i]!
        const next = result.transitions[i + 1]!
        const currKey = `${curr.from}:${curr.input}`
        const nextKey = `${next.from}:${next.input}`

        // The comparison should show current <= next
        expect(currKey <= nextKey || currKey.localeCompare(nextKey) <= 0).toBe(true)
      }
    })

    it('should enforce globally unique transition IDs after normalization', () => {
      const result = AutomatonProject['normalizeState']({
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: false },
        ],
        transitions: [
          { id: 5, from: 0, to: 1, input: '1', output: '0' },
          { id: 5, from: 1, to: 0, input: '0', output: '1' }, // duplicate
          { id: 10, from: 0, to: 0, input: '0', output: '1' },
          { id: 10, from: 1, to: 1, input: '1', output: '0' }, // duplicate
        ],
        automatonType: 'mealy',
      })

      const ids = result.transitions.map((t) => t.id)
      const idCounts = new Map<number, number>()
      ids.forEach((id) => {
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
      })

      // All IDs must be globally unique
      for (const [, count] of idCounts.entries()) {
        expect(count).toBe(1)
      }
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should preserve toPattern patterns and handle don-t-care states', () => {
      const result = AutomatonProject['normalizeState']({
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [
          { id: 1, from: 0, to: -1, toPattern: 'x1', input: '1', output: '0' },
          { id: 2, from: 0, to: 1, toPattern: undefined, input: '0', output: '1' },
          { id: 3, from: 1, to: 99, toPattern: '01', input: '1', output: '0' }, // invalid to, rely on pattern
        ],
        automatonType: 'mealy',
      })

      const withPattern = result.transitions.find((t) => t.id === 1)
      expect(withPattern?.toPattern).toBe('x1')

      const concrete = result.transitions.find((t) => t.id === 2)
      expect(concrete?.to).toBe(1)

      const patternFallback = result.transitions.find((t) => t.id === 3)
      expect(patternFallback?.toPattern).toBeDefined()
    })
  })

  describe('State Comparison - Semantic Equivalence', () => {
    it('should return true only when ALL fields match exactly', () => {
      const base: AutomatonState = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [
          { id: 1, from: 0, to: 1, input: '1', output: '1' },
          { id: 2, from: 1, to: 0, input: '0', output: '0' },
        ],
        automatonType: 'mealy',
      }

      const identical: AutomatonState = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [
          { id: 1, from: 0, to: 1, input: '1', output: '1' },
          { id: 2, from: 1, to: 0, input: '0', output: '0' },
        ],
        automatonType: 'mealy',
      }

      expect(AutomatonProject['isSameAutomatonState'](base, identical)).toBe(true)
    })

    it('should detect automaton type mismatch', () => {
      const mealy: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'mealy',
      }

      const moore: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'moore',
      }

      expect(AutomatonProject['isSameAutomatonState'](mealy, moore)).toBe(false)
    })

    it('should detect state id differences', () => {
      const s1: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'mealy',
      }

      const s2: AutomatonState = {
        states: [{ id: 1, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'mealy',
      }

      expect(AutomatonProject['isSameAutomatonState'](s1, s2)).toBe(false)
    })

    it('should detect position differences', () => {
      const s1: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false, x: 100, y: 200 }],
        transitions: [],
        automatonType: 'mealy',
      }

      const s2: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false, x: 150, y: 250 }],
        transitions: [],
        automatonType: 'mealy',
      }

      const s3: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'mealy',
      }

      expect(AutomatonProject['isSameAutomatonState'](s1, s2)).toBe(false)
      expect(AutomatonProject['isSameAutomatonState'](s1, s3)).toBe(false)
    })

    it('should detect transition differences', () => {
      const base: AutomatonState = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [{ id: 1, from: 0, to: 1, input: '1', output: '1' }],
        automatonType: 'mealy',
      }

      const edited: AutomatonState = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [{ id: 1, from: 0, to: 1, input: '0', output: '1' }],
        automatonType: 'mealy',
      }

      expect(AutomatonProject['isSameAutomatonState'](base, edited)).toBe(false)
    })

    it('should handle null/undefined inputs safely', () => {
      const state: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [],
        automatonType: 'mealy',
      }

      expect(AutomatonProject['isSameAutomatonState'](null, null)).toBe(false)
      expect(AutomatonProject['isSameAutomatonState'](undefined, undefined)).toBe(false)
      expect(AutomatonProject['isSameAutomatonState'](state, null)).toBe(false)
      expect(AutomatonProject['isSameAutomatonState'](null, state)).toBe(false)
    })
  })

  describe('Update Source Tracking - State Machine Correctness', () => {
    beforeEach(() => {
      AutomatonProject.setLastUpdateSource(null)
    })

    it('should track update source correctly through transitions', () => {
      expect(AutomatonProject.getLastUpdateSource()).toBeNull()

      AutomatonProject.setLastUpdateSource('automatoneditor')
      expect(AutomatonProject.getLastUpdateSource()).toBe('automatoneditor')

      AutomatonProject.setLastUpdateSource('table')
      expect(AutomatonProject.getLastUpdateSource()).toBe('table')

      AutomatonProject.setLastUpdateSource(null)
      expect(AutomatonProject.getLastUpdateSource()).toBeNull()
    })
  })

  describe('Listener Lifecycle - Idempotency', () => {
    it('should allow multiple attach calls without failure', () => {
      expect(() => {
        AutomatonProject.attachFsmListener()
        AutomatonProject.attachFsmListener()
        AutomatonProject.attachFsmListener()
      }).not.toThrow()
    })

    it('should allow multiple dispose calls without failure', () => {
      expect(() => {
        AutomatonProject.disposeFsmListener()
        AutomatonProject.disposeFsmListener()
        AutomatonProject.disposeFsmListener()
      }).not.toThrow()
    })
  })
})
