import type { AddPanelPositionOptions, DockviewApi, IDockviewPanel } from 'dockview-vue'
import { checkDockEntryRequirements, dockRegistry } from '@/router/dockRegistry'
import { updateTruthTable } from '@/utility/truthtable/interpreter'
import { stateManager } from '@/projects/stateManager'
import { dockviewService } from '@/utility/dockview/service'

/**
 * Retrieves the Dockview API instance from the dockview service.
 *
 * @returns The current DockviewApi instance if the service is initialized; otherwise `null`.
 */
export function getDockviewApi(): DockviewApi | null {
  return dockviewService.getApi()
}

/**
 * Looks for a panel with an id in the currently open ones.
 * @param panelId The id for the respective panel.
 * @returns The panel if one could be found; otherwise `undefined`.
 */
function getPanelByID(panelId: string): IDockviewPanel | undefined {
  const api = getDockviewApi()
  if (!api || !api.panels) return undefined

  return api.panels.find((p) => p.id === panelId)
}

/**
 * Opens a dockview panel if all checks pass.
 * @param panelId The id that will be assigned to the respective panel.
 * @param label The label that dockview will show in the tab handle.
 * @param position Where to position the panel in the dockview.
 * @returns `true` if the panel was sucessfully created; `false` otherwise.
 */

export function createPanel(panelId: string, label: string, position?: AddPanelPositionOptions, params?: Record<string, unknown>): boolean {
  const api = getDockviewApi()
  if (!api) {
    console.warn('Dockview API not ready yet')
    return false
  }

  const registryEntry = dockRegistry.find((item) => item.id === panelId)
  if (!registryEntry || !checkDockEntryRequirements(registryEntry, 'VIEW')) {
    console.log(`Panel with id '${registryEntry}' :(`)
    return false
  }

  const existingPanel = getPanelByID(panelId)
  if (existingPanel) {
    console.log(`Panel with id '${panelId}' already exists, focusing on it`)
    existingPanel.api.setActive()
    return true
  }

  try {
    api.addPanel({
      id: panelId,
      component: panelId,
      title: label,
      position: position,
      // unspecific params possible for automaton, ppbly TODO: use same style for both state types
      params: params ?? {
        state: stateManager.state?.truthTable,
        updateTruthTable,
      },
    })
    return true
  } catch (err) {
    console.error('Failed to add panel', err)
    return false
  }
}
