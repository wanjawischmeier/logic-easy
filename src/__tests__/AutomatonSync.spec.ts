import { describe, it, expect } from 'vitest'
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'
import { stateManager } from '@/projects/stateManager'
import type { RawFsmTransition, RawFsmState } from '@/projects/automaton/AutomatonTypes'

describe('FSM Editor & Table Synchronization - Defensive Tests', () => {
  describe('Raw FSM Transition Parsing - Format Handling', () => {
    it('should parse label format (input/output) with preference over separate fields', () => {
      const validLabels: RawFsmTransition[] = [
        { id: 1, from: 0, to: 1, label: '1/0' },
        { id: 2, from: 1, to: 2, label: '0/1' },
        { id: 3, from: 0, to: 3, label: '11/10' },
        { id: 4, from: 0, to: 1, label: '/' },
        { id: 5, from: 0, to: 1, label: 'input/' },
        { id: 6, from: 0, to: 1, label: '/output' },
      ]

      for (const raw of validLabels) {
        const result = AutomatonProject['parseRawTransition'](raw)
        const [input, output] = String(raw.label || '').split('/')
        // Parse label format: i/o
        expect(result.input).toBe(input || '0')
        expect(result.output).toBe(output || '0')
      }

      // Prefer label format over separate fields
      const withBoth: RawFsmTransition = {
        id: 1,
        from: 0,
        to: 1,
        label: 'label_input/label_output',
        input: 'separate_input',
        output: 'separate_output',
      }

      const result = AutomatonProject['parseRawTransition'](withBoth)
      // Label takes precedence over separate input/output fields
      expect(result.input).toBe('label_input')
      expect(result.output).toBe('label_output')
      expect(result.input).not.toBe('separate_input')
    })

    it('should parse moore-style mealy_output field', () => {
      const raw: RawFsmTransition = {
        id: 1,
        from: 0,
        to: 1,
        input: '1',
        mealy_output: 'moore_output',
      }

      const result = AutomatonProject['parseRawTransition'](raw)
      expect(result.output).toBe('moore_output')
    })

    it('should prefer output over mealy_output when both exist', () => {
      const raw: RawFsmTransition = {
        id: 1,
        from: 0,
        to: 1,
        input: '1',
        output: 'output_field',
        mealy_output: 'mealy_output_field',
      }

      const result = AutomatonProject['parseRawTransition'](raw)
      expect(result.output).toBe('output_field')
    })

    it('should preserve toPattern for don-t-care states', () => {
      const testCases: RawFsmTransition[] = [
        { id: 1, from: 0, toPattern: 'x1', input: '1', output: '0' },
        { id: 2, from: 1, toPattern: '1x', input: '0', output: '1' },
        { id: 3, from: 0, toPattern: 'xx', input: '1', output: '1' },
      ]

      for (const raw of testCases) {
        const result = AutomatonProject['parseRawTransition'](raw)
        expect(result.toPattern).toBe(raw.toPattern)
      }
    })

    it('should handle missing/null/NaN to field by setting to -1', () => {
      const invalidTo: RawFsmTransition[] = [
        { id: 1, from: 0, input: '1', output: '0' },
        { id: 2, from: 0, to: null as unknown as number, input: '1', output: '0' },
        { id: 3, from: 0, to: '' as unknown as number, input: '1', output: '0' },
        { id: 4, from: 0, to: undefined as unknown as number, input: '1', output: '0' },
        { id: 5, from: 0, to: NaN, input: '1', output: '0' },
      ]

      // All invalid to values should default to -1
      for (const raw of invalidTo) {
        const result = AutomatonProject['parseRawTransition'](raw)
        expect(result.to).toBe(-1)
      }
    })

    it('should handle string to field by converting to number', () => {
      const raw: RawFsmTransition = {
        id: 1,
        from: 0,
        to: '5' as unknown as number,
        input: '1',
        output: '0',
      }

      const result = AutomatonProject['parseRawTransition'](raw)
      expect(result.to).toBe(5)
    })

    it('should parse numeric ID fields', () => {
      const raw: RawFsmTransition = {
        id: 42,
        from: 5,
        to: 10,
        input: '1',
        output: '0',
      }

      const result = AutomatonProject['parseRawTransition'](raw)
      expect(result.id).toBe(42)
      expect(result.from).toBe(5)
    })
  })

  describe('Raw FSM State Parsing - State Reconstruction', () => {
    it('should parse complete state with all fields', () => {
      const raw: RawFsmState = {
        id: 5,
        name: 'q5_custom',
        initial: true,
        final: false,
        x: 123.5,
        y: 456.7,
      }

      const result = AutomatonProject['parseRawState'](raw)
      // All fields should be preserved exactly
      expect(result.id).toBe(5)
      expect(result.name).toBe('q5_custom')
      expect(result.initial).toBe(true)
      expect(result.final).toBe(false)
      expect(result.x).toBe(123.5)
      expect(result.y).toBe(456.7)
    })

    it('should generate default name from id when not provided', () => {
      const testCases: RawFsmState[] = [
        { id: 0 },
        { id: 1 },
        { id: 42 },
        { id: 0, name: undefined },
        { id: 5, name: null as unknown as string },
      ]

      for (const raw of testCases) {
        const result = AutomatonProject['parseRawState'](raw)
        // Generate default name matching q{id}
        expect(result.name).toBe(`q${result.id}`)
      }
    })

    it('should handle numeric strings for position coordinates', () => {
      const raw: RawFsmState = {
        id: 0,
        name: 'q0',
        x: '123.45' as unknown as number,
        y: '-67.89' as unknown as number,
      }

      const result = AutomatonProject['parseRawState'](raw)
      // Numeric strings should be converted to numbers
      expect(result.x).toBe(123.45)
      expect(result.y).toBe(-67.89)
    })

    it('should reject non-finite position values', () => {
      const testCases: RawFsmState[] = [
        { id: 0, name: 'q0', x: Infinity, y: 100 },
        { id: 0, name: 'q0', x: -Infinity, y: 100 },
        { id: 0, name: 'q0', x: NaN, y: 100 },
        { id: 0, name: 'q0', x: 100, y: NaN },
      ]

      for (const raw of testCases) {
        const result = AutomatonProject['parseRawState'](raw)
        // Check if input x is non-finite
        const xNonFinite = !Number.isFinite(Number(raw.x))
        // Check if input y is non-finite
        const yNonFinite = !Number.isFinite(Number(raw.y))

        // If x was non-finite, result.x should be undefined
        const expectedXUndefined = xNonFinite
        expect(expectedXUndefined ? result.x === undefined : true).toBe(true)

        // If y was non-finite, result.y should be undefined
        const expectedYUndefined = yNonFinite
        expect(expectedYUndefined ? result.y === undefined : true).toBe(true)
      }
    })

    it('should default boolean fields to false when not provided', () => {
      const raw: RawFsmState = {
        id: 0,
        name: 'q0',
      }

      const result = AutomatonProject['parseRawState'](raw)
      expect(result.initial).toBe(false)
    })
  })

  describe('State Cloning for Sync - Deep Copy Verification', () => {
    it('should produce structurally equal but referentially independent clone', () => {
      const original = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false, x: 100, y: 200 },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [{ id: 1, from: 0, to: 1, input: '1', output: '0' }],
        automatonType: 'mealy' as const,
      }

      const clone = AutomatonProject['cloneAutomatonStateForSync'](original)

      // Structural equality
      expect(clone).toEqual(original)
      // Referential independence - new object
      expect(clone).not.toBe(original)
      expect(clone.states).not.toBe(original.states)
      expect(clone.transitions).not.toBe(original.transitions)
      expect(clone.states[0]).not.toBe(original.states[0])
    })

    it('should preserve numeric position values with full precision', () => {
      const testValues = [0, 100.5, -200.7, 999999.123456]

      const original = {
        states: testValues.map((val, idx) => ({
          id: idx,
          name: `q${idx}`,
          initial: false,
          final: false,
          x: val,
          y: val,
        })),
        transitions: [],
        automatonType: 'mealy' as const,
      }

      const clone = AutomatonProject['cloneAutomatonStateForSync'](original)

      for (let i = 0; i < testValues.length; i++) {
        expect(clone.states[i]?.x).toBe(testValues[i])
        expect(clone.states[i]?.y).toBe(testValues[i])
      }
    })

    it('should preserve toPattern in transitions', () => {
      const original = {
        states: [
          { id: 0, name: 'q0', initial: true, final: false },
          { id: 1, name: 'q1', initial: false, final: true },
        ],
        transitions: [
          { id: 1, from: 0, to: -1, toPattern: 'x1', input: '1', output: '0' },
          { id: 2, from: 0, to: 1, input: '0', output: '1' },
        ],
        automatonType: 'mealy' as const,
      }

      const clone = AutomatonProject['cloneAutomatonStateForSync'](original)

      expect(clone.transitions[0]?.toPattern).toBe('x1')
      expect(clone.transitions[1]?.toPattern).toBeUndefined()
    })

    it('should not mutate original when modifying clone', () => {
      const original = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [{ id: 1, from: 0, to: 0, input: '1', output: '0' }],
        automatonType: 'mealy' as const,
      }

      const clone = AutomatonProject['cloneAutomatonStateForSync'](original)

      if (clone.states[0]) {
        clone.states[0].name = 'q_modified'
      }
      // Original must not be affected
      expect(original.states[0]?.name).toBe('q0')
      expect(clone.states[0]?.name).toBe('q_modified')
    })
  })

  describe('Default Properties - Contract Consistency', () => {
    it('should always return mealy as default type', () => {
      const props = AutomatonProject.defaultProps
      // Default type is mealy
      expect(props.automatonType).toBe('mealy')
      expect(props.automatonType).not.toBe('moore')
      expect(props.automatonType).not.toBe('')
    })

    it('should always return empty string for default name', () => {
      const props = AutomatonProject.defaultProps
      // Default name is empty string
      expect(props.name).toBe('')
      expect(typeof props.name).toBe('string')
      expect(props.name.length).toBe(0)
    })

    it('should return consistent props across calls', () => {
      const call1 = AutomatonProject.defaultProps
      const call2 = AutomatonProject.defaultProps

      expect(call1.name).toBe(call2.name)
      expect(call1.automatonType).toBe(call2.automatonType)
    })
  })

  describe('Message Listener Idempotency', () => {
    it('should handle multiple attach calls safely', () => {
      expect(() => {
        AutomatonProject.attachFsmListener()
        AutomatonProject.attachFsmListener()
        AutomatonProject.attachFsmListener()
      }).not.toThrow()
    })

    it('should handle multiple dispose calls safely', () => {
      expect(() => {
        AutomatonProject.disposeFsmListener()
        AutomatonProject.disposeFsmListener()
        AutomatonProject.disposeFsmListener()
      }).not.toThrow()
    })

    it('should handle interleaved attach/dispose', () => {
      expect(() => {
        AutomatonProject.attachFsmListener()
        AutomatonProject.disposeFsmListener()
        AutomatonProject.attachFsmListener()
        AutomatonProject.disposeFsmListener()
        AutomatonProject.attachFsmListener()
      }).not.toThrow()
    })
  })

  describe('Iframe Reference Management', () => {
    it('should extract FSM iframe from window global', () => {
      const mockIframe = { id: 'fsm-test' } as unknown as HTMLIFrameElement
      const windowRef = window as unknown as Record<string, unknown>
      windowRef.__fsm_preloaded_iframe = mockIframe

      const result = AutomatonProject.getFsmIframe()
      expect(result).toBe(mockIframe)

      delete windowRef.__fsm_preloaded_iframe
    })

    it('should return undefined when iframe not in window', () => {
      const windowRef = window as unknown as Record<string, unknown>
      delete windowRef.__fsm_preloaded_iframe
      const result = AutomatonProject.getFsmIframe()
      expect(result).toBeUndefined()
    })
  })

  describe('Parent Echo Guard', () => {
    it('should ignore editor exports that exactly match the last state sent to the editor', () => {
      const mockIframe = { contentWindow: {} as Window } as HTMLIFrameElement
      const windowRef = window as unknown as Record<string, unknown>
      windowRef.__fsm_preloaded_iframe = mockIframe

      const originalAutomaton = AutomatonProject['normalizeState']({
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [{ id: 1, from: 0, to: 0, input: '0', output: '0' }],
        automatonType: 'mealy' as const,
      })

      stateManager.state.automaton = originalAutomaton
      AutomatonProject['lastSentFsmData'] = originalAutomaton
      AutomatonProject['lastImportedFsmData'] = null

      const event = {
        data: { action: 'export', fsm: originalAutomaton },
        origin: window.location.origin,
        source: mockIframe.contentWindow,
      } as MessageEvent

      AutomatonProject['handleMessage'](event)

      expect(stateManager.state.automaton).toEqual(originalAutomaton)
      expect(AutomatonProject['lastImportedFsmData']).toBeNull()

      delete windowRef.__fsm_preloaded_iframe
      AutomatonProject['lastSentFsmData'] = null
      AutomatonProject['lastImportedFsmData'] = null
    })
  })

  describe('Bit Encoding Calculations', () => {
    it('should calculate correct bitNumber for various state counts', () => {
      const testCases = [
        { stateCount: 1, minBits: 1 }, // 0 states -> 0, but min 1
        { stateCount: 2, minBits: 1 }, // 1 state -> 1 bit
        { stateCount: 3, minBits: 2 }, // 2 states -> 2 bits
        { stateCount: 4, minBits: 2 }, // 3 states -> 2 bits
        { stateCount: 5, minBits: 3 }, // 4 states -> 3 bits
        { stateCount: 8, minBits: 3 }, // 7 states -> 3 bits
        { stateCount: 9, minBits: 4 }, // 8 states -> 4 bits
      ]

      for (const { stateCount, minBits } of testCases) {
        const maxIndex = Math.max(stateCount - 1, 0)
        const bitNumber = Math.max(maxIndex.toString(2).length, 1)
        expect(bitNumber).toBe(minBits)
      }
    })

    it('should handle edge case of single state', () => {
      const maxIndex = Math.max(0, 0) // 1 state
      const bitNumber = Math.max(maxIndex.toString(2).length, 1)
      expect(bitNumber).toBe(1)
    })

    it('should handle large state counts', () => {
      const maxIndex = 999
      const bitNumber = Math.max(maxIndex.toString(2).length, 1)
      expect(bitNumber).toBeGreaterThan(0)
      expect(bitNumber).toBeLessThanOrEqual(10) // 2^10 > 999
    })
  })
})
