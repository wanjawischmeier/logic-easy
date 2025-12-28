import { reactive, watch, type UnwrapNestedRefs } from 'vue'
import { projectManager } from '@/projects/projectManager'
import type { BaseProjectState } from '@/projects/Project'

/**
 * Manages application state and syncs with project storage
 * This is now just a thin wrapper around the project manager's state
 */
export class StateManager {
  public state: UnwrapNestedRefs<BaseProjectState>
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.state = reactive({}) as UnwrapNestedRefs<BaseProjectState>

    // Auto-save to localStorage whenever state changes
    // Debounce to avoid excessive writes
    watch(
      () => this.state,
      (newState) => {
        if (this.saveTimer) clearTimeout(this.saveTimer)
        this.saveTimer = setTimeout(() => {
          this.saveState(newState as BaseProjectState)
        }, 300)
      },
      { deep: true }
    )
  }

  /**
   * Save state to project manager
   */
  // CHECK: doesnt make any sense?
  private saveState(state: BaseProjectState): void {
    projectManager.saveCurrentProject()
  }

  /**
   * Open file picker and load a project
   */
  async openFile(): Promise<void> {
    return projectManager.openProject()
  }

  /**
   * Manually trigger a save
   */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    projectManager.saveCurrentProject()
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
