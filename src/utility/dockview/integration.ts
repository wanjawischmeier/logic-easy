import type { AddPanelPositionOptions, DockviewApi, IDockviewPanel } from 'dockview-vue';
import { popupService } from '@/utility/popupService';
import { checkDockEntryRequirements, dockRegistry, type MenuEntry } from '@/router/dockRegistry';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import { stateManager } from '@/states/stateManager';
import { dockviewService } from '@/utility/dockview/service';
import { getProjectType } from '@/projects/projectRegistry';

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

  const registryEntry = dockRegistry.find(item => item.id === panelId);
  if (!registryEntry || !checkDockEntryRequirements(registryEntry, 'VIEW')) { // TODO: not sure 'VIEW' is correct here?
    console.log(`Panel with id '${registryEntry}' :(`);
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
      position: position,
      params: {
        state: stateManager.state?.truthTable,
        updateTruthTable
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to add panel', err);
    return false;
  }
}

/**
 * Creates a new panel after first showing a popup.
 * @param panelId The id with which the new panel should be created.
 * @returns Wether or not the panel was sucessfully created.
 */
export function createPanelAfterPopup(panelId: string): boolean;

/**
 * Creates a new panel after first showing a popup.
 * @param menuEntry The menu entry whose id will be assigned to the new panel.
 * @returns Wether or not the panel was sucessfully created.
 */
export function createPanelAfterPopup(menuEntry: MenuEntry): boolean;

// Main function called by both overloads
export function createPanelAfterPopup(panelIdOrMenuEntry: string | MenuEntry): boolean {
  let panelId: string;
  let menuEntry: MenuEntry | undefined;

  // Type guard to determine which overload was called
  if (typeof panelIdOrMenuEntry === 'string') {
    panelId = panelIdOrMenuEntry;
  } else {
    menuEntry = panelIdOrMenuEntry;
    if (!menuEntry?.panelId) return false;
    panelId = menuEntry.panelId;
  }

  const registryEntry = dockRegistry.find(item => item.id === panelId);
  if (!registryEntry?.projectType) return false;

  const projectType = getProjectType(registryEntry.projectType);

  popupService.open({
    projectPropsComponent: projectType.propsComponent,
    initialProps: projectType.defaultProps,
    onProjectCreate: async (props: any) => {
      const { projectManager } = await import('@/projects/projectManager');
      projectManager.createProject(props.name, registryEntry.projectType, props);
    },
  });
  return true;
}
