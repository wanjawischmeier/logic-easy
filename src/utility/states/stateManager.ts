import { reactive, watch, type UnwrapNestedRefs } from 'vue'
import { type TruthTableState } from './truthTableState'

const STORAGE_KEY = 'logic-easy-state'
const STORAGE_VERSION = 1

/**
 * Root state structure
 */
export interface AppState {
  version: number
  truthTable?: TruthTableState
  panelStates?: Record<string, Record<string, unknown>>
}

/**
 * Default state factory
 */
function createDefaultState(): AppState {
  return {
    version: STORAGE_VERSION,
    panelStates: {}
  }
}

/**
 * Load state from localStorage
 */
function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      // return createDefaultState()
      return { version: STORAGE_VERSION }
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
    console.log('Saved app state')
  } catch (error) {
    console.error('Failed to save state to localStorage:', error)
  }
}

/**
 * Create a reactive state manager with auto-persistence
 */
export function createStateManager() {
  const state = reactive(loadState()) as UnwrapNestedRefs<AppState>

  // Ensure panelStates exists
  if (!state.panelStates) {
    state.panelStates = {}
  }

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
    },

    /**
     * Get panel state by panel ID
     */
    getPanelState: <T = Record<string, unknown>>(panelId: string): T | undefined => {
      const panelState = state.panelStates?.[panelId]
      // Return a plain object copy to avoid reactivity issues
      return panelState ? JSON.parse(JSON.stringify(panelState)) as T : undefined
    },

    /**
     * Update panel state by panel ID
     */
    updatePanelState: (panelId: string, panelState: Record<string, unknown>) => {
      if (!state.panelStates) {
        state.panelStates = {}
      }
      state.panelStates[panelId] = panelState
    },

    /**
     * Clear panel state by panel ID
     */
    clearPanelState: (panelId: string) => {
      if (state.panelStates) {
        delete state.panelStates[panelId]
      }
    },

    /**
     * Watch and auto-save panel state changes
     * @param panelId The panel ID to save state for
     * @param stateGetter Function that returns the current state object
     * @returns Cleanup function to stop watching
     */
    watchPanelState: (panelId: string, stateGetter: () => Record<string, unknown>) => {
      const stopWatch = watch(
        stateGetter,
        (newState) => {
          if (!state.panelStates) {
            state.panelStates = {}
          }
          state.panelStates[panelId] = newState
        },
        { deep: true, flush: 'post' }
      )

      return stopWatch
    }
  }
}

export const stateManager = createStateManager()
