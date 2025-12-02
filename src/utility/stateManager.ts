import { reactive, watch, type UnwrapNestedRefs } from 'vue'
import type { TruthTableData } from '@/components/TruthTable.vue'
import type { Formula } from '@/utility/truthTableInterpreter'

const STORAGE_KEY = 'logic-easy-state'
const STORAGE_VERSION = 1

/**
 * Truth table state structure
 */
export interface TruthTableState {
  inputVars: string[]
  outputVars: string[]
  values: TruthTableData
  minifiedValues: TruthTableData
  formulas: Record<string, Record<string, Formula>>
}

/**
 * Root state structure
 */
export interface AppState {
  version: number
  truthTable: TruthTableState
}

/**
 * Default state factory
 */
function createDefaultState(): AppState {
  return {
    version: STORAGE_VERSION,
    truthTable: {
      inputVars: ['a', 'b', 'c', 'd'],
      outputVars: ['x', 'y'],
      values: [
        [1, 0], [1, 0], [1, 0], [1, 1],
        [1, 1], [1, 0], ['-', 1], [0, 1],
        [0, 0], [1, 0], [1, 0], [1, 1],
        ['-', 1], [0, 0], ['-', 1], [0, 1],
      ] as TruthTableData,
      minifiedValues: [] as TruthTableData,
      formulas: {} as Record<string, Record<string, Formula>>
    }
  }
}

/**
 * Load state from localStorage
 */
function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return createDefaultState()
    }

    const parsed = JSON.parse(stored) as AppState

    // Version migration logic
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('State version mismatch, resetting to defaults')
      return createDefaultState()
    }

    return parsed
  } catch (error) {
    console.error('Failed to load state from localStorage:', error)
    return createDefaultState()
  }
}

/**
 * Save state to localStorage
 */
function saveState(state: AppState): void {
  try {
    const serialized = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Failed to save state to localStorage:', error)
  }
}

/**
 * Create a reactive state manager with auto-persistence
 */
export function createStateManager() {
  const state = reactive(loadState()) as UnwrapNestedRefs<AppState>

  // Auto-save to localStorage whenever state changes
  // Debounce to avoid excessive writes
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => state,
    () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveState(state as AppState)
      }, 300)
    },
    { deep: true }
  )

  return {
    state,

    /**
     * Reset state to defaults
     */
    reset: () => {
      const defaults = createDefaultState()
      Object.assign(state, defaults)
      saveState(state as AppState)
    },

    /**
     * Manually trigger a save
     */
    save: () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveState(state as AppState)
    }
  }
}

export const stateManager = createStateManager()
