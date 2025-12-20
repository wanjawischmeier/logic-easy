import { reactive, watch, type UnwrapNestedRefs } from 'vue'
import { projectManager } from '../projects/projectManager'
import { getDockviewApi } from '../utility/dockviewIntegration'
import { StateFileOperations } from './stateFileOperations'
import { dockviewService } from '../utility/dockviewService'
import type { TruthTableState } from './truthTableState'

const STORAGE_VERSION = 1

/**
 * Root state structure
 */
export interface AppState {
  version: number
  truthTable?: TruthTableState
  panelStates?: Record<string, Record<string, unknown>>
  dockviewLayout?: unknown // Stores the dockview panel layout
}

/**
 * Default state factory
 */
export function createDefaultAppState(): AppState {
  return {
    version: STORAGE_VERSION,
    panelStates: {}
  }
}

/**
 * Manages application state and syncs with project storage
 */
export class StateManager {
  public state: UnwrapNestedRefs<AppState>
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private fileOps: StateFileOperations

  constructor() {
    this.fileOps = new StateFileOperations()
    this.state = reactive(this.loadState() || createDefaultAppState()) as UnwrapNestedRefs<AppState>

    // Ensure panelStates exists if state is loaded
    if (!this.state.panelStates) {
      this.state.panelStates = {}
    }

    // Auto-save to localStorage whenever state changes
    // Debounce to avoid excessive writes
    watch(
      () => this.state,
      (newState) => {
        if (this.saveTimer) clearTimeout(this.saveTimer)
        this.saveTimer = setTimeout(() => {
          this.saveState(newState as AppState)
        }, 300)
      },
      { deep: true }
    )
  }

  // TODO: fix this
  /**
   * Load state from project manager
   */
  private loadState(): AppState | null {
    try {
      // Don't load project here - projectManager.initializeCurrentProject() will handle it
      // This avoids issues with reactive updates and ensures loading screen shows
      return createDefaultAppState()
    } catch (error) {
      console.error('Failed to initialize state:', error)
      return null
    }
  }

  /**
   * Save state to project manager
   */
  private saveState(state: AppState): void {
    try {
      const currentProjectInfo = projectManager.currentProjectInfo
      if (currentProjectInfo) {
        projectManager.updateProjectState(currentProjectInfo.id, state)
        console.log(`Saved app state to project: ${projectManager.projectString(currentProjectInfo)}`)
      } else {
        console.warn('No current project to save state to')
      }
    } catch (error) {
      console.error(`Failed to save state to project manager: ${error}`)
    }
  }

  /**
   * Open file picker and load a project
   */
  async openFile(): Promise<void> {
    return this.fileOps.openFile()
  }

  /**
   * Manually trigger a save
   */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveState(this.state as AppState)
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
    // Immediately minimize the dock view to avoid flash
    dockviewService.minimize()

    // A bit odd, but this ensures a smooth animation and avoids a flickering of the empty dock view
    setTimeout(() => {
      const api = getDockviewApi()
      if (!api) {
        console.warn('Dockview API not available, closing project directly')
        projectManager.closeCurrentProject()
        return
      }

      // Close all panels - will automatically trigger projectManager.closeCurrentProject()
      const panelIds = api.panels.map(p => p.id)
      panelIds.forEach(id => {
        const panel = api.panels.find(p => p.id === id)
        if (panel) {
          api.removePanel(panel)
        }
      })

      // If no panels to close, close project directly
      if (panelIds.length === 0) {
        projectManager.closeCurrentProject()
      }
    }, 100)
  }
}

export const stateManager = new StateManager()
