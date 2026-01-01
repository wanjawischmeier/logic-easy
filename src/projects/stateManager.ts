import { reactive, watch, type UnwrapNestedRefs, toRef } from 'vue'
import { projectManager } from '@/projects/projectManager'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type { AutomatonState } from '@/projects/automaton/AutomatonTypes'

const STORAGE_VERSION = 1

export interface AppState {
  version: number
  truthTable?: TruthTableState
  automaton?: AutomatonState
  panelStates?: Record<string, Record<string, unknown>>
  dockviewLayout?: unknown // Stores the dockview panel layout
}

/**
 * Manages application state and syncs with project storage
 * This is now just a thin wrapper around the project manager's state
 */
export class StateManager {
  public state: UnwrapNestedRefs<AppState>
  public isSaving = reactive({ value: false })
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private savingSpinnerTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.state = reactive({
      version: STORAGE_VERSION,
    }) as UnwrapNestedRefs<AppState>;

    // Auto-save to localStorage whenever state changes
    // Debounce to avoid excessive writes
    watch(
      () => this.state,
      () => {
        // Show spinner immediately on any state change
        this.isSaving.value = true
        if (this.savingSpinnerTimer) clearTimeout(this.savingSpinnerTimer)

        if (this.saveTimer) clearTimeout(this.saveTimer)
        this.saveTimer = setTimeout(() => {
          projectManager.saveCurrentProject()

          // Hide spinner 300ms after save completes
          this.savingSpinnerTimer = setTimeout(() => {
            this.isSaving.value = false
          }, 300)
        }, 300)
      },
      { deep: true }
    )
  }


  /**
   * Open file picker and load a project
   */
  async openFile(): Promise<void> {
    return projectManager.openProject()
  }

  /**
   * Get panel state by panel ID
   */
  getPanelState<T = Record<string, unknown>>(panelId: string): T | undefined {
    const panelState = this.state.panelStates?.[panelId]
    // Return a plain object copy to avoid reactivity issues
    return panelState ? JSON.parse(JSON.stringify(panelState)) as T : undefined
  }

  /**
   * Watch and auto-save panel state changes
   * @param panelId The panel ID to save state for
   * @param stateGetter Function that returns the current state object
   * @returns Cleanup function to stop watching
   */
  watchPanelState(panelId: string, stateGetter: () => Record<string, unknown>) {
    const stopWatch = watch(
      stateGetter,
      (newState) => {
        if (!this.state.panelStates) {
          this.state.panelStates = {}
        }
        this.state.panelStates[panelId] = newState
      },
      { deep: true, flush: 'post' }
    )

    return stopWatch
  }

  /**
   * Close the current project
   */
  closeCurrentProject(): void {
    projectManager.closeCurrentProject()
  }
}

export const stateManager = new StateManager()
