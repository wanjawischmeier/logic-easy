import { reactive, watch, type UnwrapNestedRefs, toRef } from 'vue'
import { projectManager } from '@/projects/projectManager'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type { AutomatonState } from '@/projects/automaton/AutomatonProject'

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
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private stateUpdateListeners: Set<() => void> = new Set()

  constructor() {
    this.state = reactive({
      version: STORAGE_VERSION
    }) as UnwrapNestedRefs<AppState>
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

  /**
   * Subscribe to state updates
   * @returns Unsubscribe function
   */
  onStateUpdate(callback: () => void): () => void {
    this.stateUpdateListeners.add(callback)
    return () => this.stateUpdateListeners.delete(callback)
  }

  /**
   * Notify all listeners that state has been updated
   * Also triggers a save
   */
  notifyStateUpdate(): void {
    console.log('[StateManager] notifyStateUpdate called, notifying', this.stateUpdateListeners.size, 'listeners')
    this.stateUpdateListeners.forEach(listener => listener())
    this.save()
  }
}

export const stateManager = new StateManager()
