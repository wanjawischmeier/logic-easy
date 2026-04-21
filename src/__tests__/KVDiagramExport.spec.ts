import { describe, it, expect } from 'vitest'
import {
  hasUsableTruthTableData,
  resolveAutomatonKVMode,
  resolveUseAutomatonBinding,
  applyCellChangeToValues,
  cloneTruthTableValues,
  applyTruthTableStateToAutomaton,
} from '@/utility/automaton/kvDiagramExport'
import type { AutomatonState } from '@/projects/automaton/AutomatonTypes'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'

describe('KV Diagram Export & FSM Minimizer Sync - Defensive Tests', () => {
  describe('hasUsableTruthTableData - Data Validation', () => {
    it('should return true only when ALL required fields are populated', () => {
      const valid = {
        inputVars: ['a', 'b'],
        outputVars: ['x'],
        values: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [0, 1, 0, 1] as any,
        ],
      }
      // All required fields present and non-empty
      expect(hasUsableTruthTableData(valid)).toBe(true)
    })

    it('should return false when ANY required field is empty', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emptyInput: Record<string, any>[] = [
        { inputVars: [], outputVars: ['x'], values: [[0], [1]] },
        { inputVars: ['a'], outputVars: [], values: [[0], [1]] },
        { inputVars: ['a'], outputVars: ['x'], values: [] },
        { inputVars: undefined, outputVars: ['x'], values: [[0]] },
        { inputVars: ['a'], outputVars: undefined, values: [[0]] },
        { inputVars: ['a'], outputVars: ['x'], values: undefined },
      ]

      for (const testCase of emptyInput) {
        // Any missing or empty field should invalidate
        expect(hasUsableTruthTableData(testCase)).toBe(false)
      }
    })

    it('should handle single element arrays as valid', () => {
      const minimal = {
        inputVars: ['a'],
        outputVars: ['x'],
        values: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [0] as any,
        ],
      }
      expect(hasUsableTruthTableData(minimal)).toBe(true)
    })
  })

  describe('resolveAutomatonKVMode - Mode Resolution Logic', () => {
    it('should enable automaton mode when explicit true flag is set', () => {
      const result = resolveAutomatonKVMode({
        hasAutomatonState: false,
        hasUsableTruthTableData: true,
        isAutomatonProject: false,
        panelId: 'other',
        panelParams: { enableAutomatonKV: true },
      })
      expect(result.isAutomatonTransitionKV).toBe(true)
    })

    it('should disable automaton mode when explicit false flag is set', () => {
      const result = resolveAutomatonKVMode({
        hasAutomatonState: true,
        hasUsableTruthTableData: true,
        isAutomatonProject: true,
        panelId: 'fsm-engine',
        panelParams: { enableAutomatonKV: false },
      })
      expect(result.isAutomatonTransitionKV).toBe(false)
    })

    it('should force automaton mode when no usable truth table data exists', () => {
      const result = resolveAutomatonKVMode({
        hasAutomatonState: true,
        hasUsableTruthTableData: false,
        isAutomatonProject: false,
        panelId: 'state-table',
        panelParams: {},
      })
      expect(result.shouldForceAutomatonMode).toBe(true)
      expect(result.isAutomatonTransitionKV).toBe(true)
    })

    it('should recognize automaton panel IDs correctly', () => {
      const panelIds = [
        'state-table',
        'fsm-engine',
        'state-table-1',
        'fsm-engine-2',
        'transition-table', // backward compat
        'state-machine', // backward compat
        'transition-table-1', // backward compat
        'state-machine-42', // backward compat
      ]

      // Explicit true flag forces automaton mode
      for (const panelId of panelIds) {
        const result = resolveAutomatonKVMode({
          hasAutomatonState: true,
          hasUsableTruthTableData: false,
          isAutomatonProject: false,
          panelId,
          panelParams: {},
        })
        // Recognized panel IDs activate automaton transition mode
        expect(result.isAutomatonTransitionKV).toBe(true)
      }
    })

    it('should not activate automaton mode for unrelated panels', () => {
      const nonAutomatonPanels = ['kv-diagram', 'qmc', 'truth-table', 'custom-panel']

      for (const panelId of nonAutomatonPanels) {
        const result = resolveAutomatonKVMode({
          hasAutomatonState: true,
          hasUsableTruthTableData: true,
          isAutomatonProject: false,
          panelId,
          panelParams: {},
        })
        // Non-automaton panels don't activate automaton mode when data exists
        expect(result.isAutomatonTransitionKV).toBe(false)
      }
    })

    it('should respect export flags', () => {
      const withExportFalse = resolveAutomatonKVMode({
        hasAutomatonState: true,
        hasUsableTruthTableData: true,
        isAutomatonProject: true,
        panelId: 'fsm-engine',
        panelParams: { enableAutomatonKVExportToTable: false },
      })
      expect(withExportFalse.exportToTable).toBe(false)

      const withExportTrue = resolveAutomatonKVMode({
        hasAutomatonState: true,
        hasUsableTruthTableData: true,
        isAutomatonProject: true,
        panelId: 'fsm-engine',
        panelParams: { enableAutomatonKVExportToTable: true },
      })
      expect(withExportTrue.exportToTable).toBe(true)

      const withoutExportFlag = resolveAutomatonKVMode({
        hasAutomatonState: true,
        hasUsableTruthTableData: true,
        isAutomatonProject: true,
        panelId: 'fsm-engine',
        panelParams: {},
      })
      expect(withoutExportFlag.exportToTable).toBe(true) // default true
    })
  })

  describe('resolveUseAutomatonBinding - Binding Activation', () => {
    it('should require all conditions for automaton binding', () => {
      const fullYes = resolveUseAutomatonBinding({
        hasTransitionTableExport: true,
        isAutomatonTransitionKV: true,
        shouldForceAutomatonMode: false,
      })
      expect(fullYes).toBe(true)

      const missingExport = resolveUseAutomatonBinding({
        hasTransitionTableExport: false,
        isAutomatonTransitionKV: true,
        shouldForceAutomatonMode: false,
      })
      expect(missingExport).toBe(false)

      const noKV = resolveUseAutomatonBinding({
        hasTransitionTableExport: true,
        isAutomatonTransitionKV: false,
        shouldForceAutomatonMode: false,
      })
      expect(noKV).toBe(false)
    })

    it('should activate binding when forced even without explicit KV flag', () => {
      const forced = resolveUseAutomatonBinding({
        hasTransitionTableExport: true,
        isAutomatonTransitionKV: false,
        shouldForceAutomatonMode: true,
      })
      expect(forced).toBe(true)
    })

    it('should deactivate binding without transition table export', () => {
      const noExport = resolveUseAutomatonBinding({
        hasTransitionTableExport: false,
        isAutomatonTransitionKV: true,
        shouldForceAutomatonMode: true,
      })
      expect(noExport).toBe(false)
    })
  })

  describe('Truth Table Value Manipulation - Immutability & Correctness', () => {
    it('should create independent clone without shared references', () => {
      const original: TruthTableState['values'] = [
        [0, 1],
        [1, 0],
        [0, 0],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any
      const cloned = cloneTruthTableValues(original)

      expect(cloned).toEqual(original)
      // Different object references
      expect(cloned).not.toBe(original)
      expect(cloned[0]).not.toBe(original[0])
    })

    it('should not mutate original when modifying clone', () => {
      const original: TruthTableState['values'] = [
        [0, 1],
        [1, 0],
      ]
      const cloned = cloneTruthTableValues(original)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cloned[0]![0] = '1' as any
      // Original array unaffected
      expect(original[0]![0]).toBe(0)
      expect(cloned[0]![0]).toBe('1')
    })

    it('should handle empty values array', () => {
      const empty: TruthTableState['values'] = []
      const cloned = cloneTruthTableValues(empty)
      expect(cloned).toEqual([])
      expect(cloned).not.toBe(empty)
    })

    it('should apply cell changes to create new array', () => {
      const original: TruthTableState['values'] = [
        [0, 1],
        [1, 0],
      ]
      const result = applyCellChangeToValues(original, {
        rowIndex: 0,
        outputIndex: 0,
        value: 1,
      })

      expect(result).not.toBe(original) // new array
      expect(result?.[0]?.[0]).toBe(1) // changed value
      expect(original[0]?.[0]).toBe(0) // original unchanged
    })

    it('should return null for invalid cell coordinates', () => {
      const values: TruthTableState['values'] = [
        [0, 1],
        [1, 0],
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalid: Record<string, any>[] = [
        { rowIndex: -1, outputIndex: 0, value: 1 },
        { rowIndex: 0, outputIndex: -1, value: 1 },
        { rowIndex: 10, outputIndex: 0, value: 1 },
        { rowIndex: 0, outputIndex: 10, value: 1 },
        { rowIndex: NaN, outputIndex: 0, value: 1 },
      ]

      for (const test of invalid) {
        // Invalid coordinates should return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = applyCellChangeToValues(values, test as any)
        expect(result).toBeNull()
      }
    })

    it('should accept valid cell values (0, 1, don-t-care characters)', () => {
      const values: TruthTableState['values'] = [
        [0, 1],
        [1, 0],
      ]

      const validChanges = [
        { rowIndex: 0, outputIndex: 0, value: 0 },
        { rowIndex: 0, outputIndex: 0, value: 1 },
        { rowIndex: 0, outputIndex: 0, value: '-' },
        { rowIndex: 0, outputIndex: 0, value: 'x' },
      ]

      for (const change of validChanges) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = applyCellChangeToValues(values, change as any)
        expect(result).not.toBeNull()
      }
    })
  })

  describe('Automaton Truth Table Application - State Synthesis', () => {
    it('should handle empty automaton gracefully', () => {
      const empty: AutomatonState = {
        states: [],
        transitions: [],
        automatonType: 'mealy',
      }

      const truthTable: TruthTableState = {
        inputVars: ['a'],
        outputVars: ['y'],
        values: [[0], [1]],
        formulas: {},
        outputVariableIndex: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionType: 'DNF' as any,
        functionRepresentation: 'Minimal',
      }

      const result = applyTruthTableStateToAutomaton(empty, truthTable)
      expect(result.states).toHaveLength(0)
      expect(result.transitions).toHaveLength(0)
    })

    it('should preserve state IDs when applying truth table', () => {
      const original: AutomatonState = {
        states: [
          { id: 5, name: 'q5', initial: true, final: false },
          { id: 7, name: 'q7', initial: false, final: true },
        ],
        transitions: [
          { id: 1, from: 5, to: 7, input: '0', output: '0' },
          { id: 2, from: 5, to: 5, input: '1', output: '1' },
          { id: 3, from: 7, to: 5, input: '0', output: '1' },
          { id: 4, from: 7, to: 7, input: '1', output: '0' },
        ],
        automatonType: 'mealy',
      }

      const truthTable: TruthTableState = {
        inputVars: ['q', 'x'],
        outputVars: ['q_next', 'y'],
        values: [
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
        formulas: {},
        outputVariableIndex: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionType: 'DNF' as any,
        functionRepresentation: 'Minimal',
      }

      const result = applyTruthTableStateToAutomaton(original, truthTable)

      const resultIds = new Set(result.states.map((s) => s.id))
      expect(resultIds.has(5)).toBe(true)
      expect(resultIds.has(7)).toBe(true)
      expect(result.states.map((s) => s.id).length).toBe(original.states.length)
    })

    it('should maintain automaton type through application', () => {
      const mealy: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [{ id: 1, from: 0, to: 0, input: '0', output: '0' }],
        automatonType: 'mealy',
      }

      const moore: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: false }],
        transitions: [{ id: 1, from: 0, to: 0, input: '0', output: '1' }],
        automatonType: 'moore',
      }

      const truthTable: TruthTableState = {
        inputVars: ['x'],
        outputVars: ['y'],
        values: [[0], [1]],
        formulas: {},
        outputVariableIndex: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionType: 'DNF' as any,
        functionRepresentation: 'Minimal',
      }

      const mealyResult = applyTruthTableStateToAutomaton(mealy, truthTable)
      expect(mealyResult.automatonType).toBe('mealy')

      const mooreResult = applyTruthTableStateToAutomaton(moore, truthTable)
      expect(mooreResult.automatonType).toBe('moore')
    })

    it('should handle single-state automaton edge case', () => {
      const single: AutomatonState = {
        states: [{ id: 0, name: 'q0', initial: true, final: true }],
        transitions: [
          { id: 1, from: 0, to: 0, input: '0', output: '0' },
          { id: 2, from: 0, to: 0, input: '1', output: '1' },
        ],
        automatonType: 'mealy',
      }

      const truthTable: TruthTableState = {
        inputVars: ['x0', 'x1'],
        outputVars: ['y0'],
        values: [[0], [1], [1], [0]],
        formulas: {},
        outputVariableIndex: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionType: 'DNF' as any,
        functionRepresentation: 'Minimal',
      }

      const result = applyTruthTableStateToAutomaton(single, truthTable)
      expect(result.states).toHaveLength(1)
      expect(result.states[0]?.id).toBe(0)
    })
  })
})
