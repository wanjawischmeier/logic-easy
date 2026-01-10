import type { AddPanelPositionOptions, DockviewApi, IDockviewPanel } from 'dockview-vue';
import { checkDockEntryRequirements, findDockEntry } from '@/router/dockRegistry';
import { dockviewService } from '@/utility/dockview/service';
import { Toast } from '../toastService';

/**
 * Retrieves the Dockview API instance from the dockview service.
 *
 * @returns The current DockviewApi instance if the service is initialized; otherwise `null`.
 */
export function getDockviewApi(): DockviewApi | null {
  return dockviewService.getApi();
}

/**
 * Looks for a panel with an id in the currently open ones.
 * @param panelId The id for the respective panel.
 * @returns The panel if one could be found; otherwise `undefined`.
 */
function getPanelByID(panelId: string): IDockviewPanel | undefined {
  const api = getDockviewApi();
  if (!api || !api.panels) return undefined;

  return api.panels.find(p => p.id === panelId);
}

/**
 * Opens a dockview panel if all checks pass.
 * @param panelId The id that will be assigned to the respective panel.
 * @param label The label that dockview will show in the tab handle.
 * @param position Where to position the panel in the dockview.
 * @returns `true` if the panel was sucessfully created; `false` otherwise.
 */
export function createPanel(panelId: string, label: string, position?: AddPanelPositionOptions): boolean {
  const api = getDockviewApi();
  if (!api) {
    console.warn('Dockview API not ready yet');
    return false;
  }

  const registryEntry = findDockEntry(panelId);
  if (!registryEntry || !checkDockEntryRequirements(registryEntry, 'VIEW')) { // TODO: not sure 'VIEW' is correct here?
    console.warn(`Panel with id '${registryEntry?.id}' doesnt pass the requirements`);
    return false;
  }

  // Check if panel with this component already exists
  const existingPanel = getPanelByID(panelId);
  if (existingPanel) {
    console.log(`Panel with id '${panelId}' already exists, focusing on it`);
    existingPanel.api.setActive();
    return true;
  }

  try {
    api.addPanel({
      id: panelId,
      component: panelId,
      title: label,
      position: position
    });
    return true;
  } catch (err) {
    console.error('Failed to create panel', err);
    Toast.error('Failed to create panel')
    return false;
  }
}
