import { reactive, watch, type UnwrapNestedRefs } from 'vue'
import { type TruthTableState } from './truthTableState'
import { projectManager } from './projectManager'
import { getDockviewApi } from '../dockviewIntegration'

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
 * Load state from project manager
 */
function loadState(): AppState | null {
  try {
    // Try to get current project from project manager
    const currentProject = projectManager.getCurrentProject()

    if (currentProject) {
      // Version migration logic
      if (currentProject.state.version !== STORAGE_VERSION) {
        console.warn('State version mismatch, resetting to defaults')
        return createDefaultAppState()
      }
      return currentProject.state
    }

    // No current project
    console.log('No current project found')
    return null
  } catch (error) {
    console.error('Failed to load state from project manager:', error)
    return null
  }
}

/**
 * Save state to project manager
 */
function saveState(state: AppState): void {
  try {
    const currentProjectInfo = projectManager.currentProjectInfo
    if (currentProjectInfo) {
      projectManager.updateProjectState(currentProjectInfo.id, state)
      console.log('Saved app state to project:', currentProjectInfo.name)
    } else {
      console.warn('No current project to save state to')
    }
  } catch (error) {
    console.error('Failed to save state to project manager:', error)
  }
}

/**
 * Create a reactive state manager with auto-persistence
 */
export function createStateManager() {
  const state = reactive(loadState() || createDefaultAppState()) as UnwrapNestedRefs<AppState>

  // Ensure panelStates exists if state is loaded
  if (!state.panelStates) {
    state.panelStates = {}
  }

  // Auto-save to localStorage whenever state changes
  // Debounce to avoid excessive writes
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => state,
    (newState) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveState(newState as AppState)
      }, 300)
    },
    { deep: true }
  )

  return {
    state,

    /**
     * Load a project by ID
     */
    loadProject: (projectId: string) => {
      if (projectManager.setCurrentProject(projectId)) {
        const newState = loadState() || createDefaultAppState()

        // Clear existing state
        Object.keys(state).forEach(key => delete (state as Record<string, unknown>)[key])

        // Assign new project state
        Object.assign(state, newState)

        if (!state.panelStates) {
          state.panelStates = {}
        }
      }
    },

    async openFile() {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.le,.lc';
        input.multiple = false;
        input.style.display = 'none';
        document.body.appendChild(input);

        const file: File | null = await new Promise((resolve) => {
          input.addEventListener('change', () => {
            resolve(input.files && input.files[0] ? input.files[0] : null);
          }, { once: true });
          input.click();
        });

        document.body.removeChild(input);

        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'le') {
          await projectManager.loadProjectFromFile(file);

          const projectInfo = projectManager.currentProjectInfo;
          if (projectInfo) {
            stateManager.loadProject(projectInfo.id)
          }
        } else {
          alert('Opening of LogicCircuits not supported yet');
        }
      } catch (err) {
        console.error('Failed to load project from file', err);
      }
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
    },

    /**
     * Close the current project by closing all open panels
     * This will trigger the automatic project close when panels reach 0
     */
    closeCurrentProject: () => {
      const api = getDockviewApi()
      if (!api) {
        console.warn('Dockview API not available, closing project directly')
        projectManager.closeCurrentProject()
        return
      }

      // Close all panels - this will automatically trigger projectManager.closeCurrentProject()
      // through the updatePanelCount listener in DockView.vue
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
    }
  }
}

export const stateManager = createStateManager()
