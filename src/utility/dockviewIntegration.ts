import type { AddPanelPositionOptions } from 'dockview-vue';
import { popupService } from './popupService';
import { checkDockEntryRequirements, dockRegistry } from '@/components/dockRegistry';
import { updateTruthTable } from './truthTableInterpreter';
import { createTruthTableProject } from './projects/create/truthTableProjectCreation';
import { stateManager } from './states/stateManager';

export type DockviewApiMinimal = {
  addPanel: (opts: {
    // TODO: Resolve duplicate id/component
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: AddPanelPositionOptions;
  }) => void;
  removePanel: (panel: { id: string }) => void;
  panels: Array<{
    id: string;
    api: {
      setActive: () => void;
    };
  }>;
};

export function getDockviewApi(): DockviewApiMinimal | null {
  const api = (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api;
  return api ?? null;
}

function findPanelByComponent(component: string): { id: string; api: { setActive: () => void } } | null {
  const api = getDockviewApi();
  if (!api || !api.panels) return null;

  const panel = api.panels.find(p => p.id === component);
  return panel ? { id: panel.id, api: panel.api } : null;
}

export function addPanel(panelKey: string, label: string, position?: AddPanelPositionOptions): boolean {
  const api = getDockviewApi();
  if (!api) {
    console.warn('Dockview API not ready yet');
    return false;
  }

  const registryEntry = dockRegistry.find(item => item.id === panelKey);
  if (!registryEntry || !checkDockEntryRequirements(registryEntry, 'VIEW')) { // TODO: not sure 'VIEW' is correct here?
    return false;
  }

  // Check if panel with this component already exists
  const existingPanel = findPanelByComponent(panelKey);
  if (existingPanel) {
    console.log(`Panel with component '${panelKey}' already exists, focusing it`);
    existingPanel.api.setActive();
    return true;
  }

  try {
    api.addPanel({
      id: panelKey,
      component: panelKey,
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

export function addPanelWithPopup(panelKey: string, label: string): boolean {
  const registryEntry = dockRegistry.find(item => item.id === panelKey);
  if (!registryEntry) return false;

  if (!registryEntry.projectPropsComponent) {
    // Fallback to adding directly
    return addPanel(panelKey, label);
  }

  // Define creation logic based on panel type
  const onProjectCreate = (projectName: string, props: Record<string, unknown>) => {
    switch (panelKey) {
      case 'truth-table':
      case 'kv-diagram':
        if (props.inputCount === null || props.outputCount === null) {
          return;
        }

        createTruthTableProject(
          projectName,
          props.inputCount as number,
          props.outputCount as number
        );
        break;

      default:
        break;
    }
  };

  popupService.open({
    projectPropsComponent: registryEntry.projectPropsComponent,
    onProjectCreate,
  });
  return true;
}
