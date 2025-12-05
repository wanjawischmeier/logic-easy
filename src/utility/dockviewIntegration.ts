import type { AddPanelPositionOptions } from 'dockview-vue';
import { popupService } from './popupService';
import { checkPanelRequirement, dockRegistry } from '@/components/dockRegistry';

export type DockviewApiMinimal = {
  addPanel: (opts: {
    // TODO: Resolve duplicate id/component
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: AddPanelPositionOptions;
  }) => void;
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
  if (!registryEntry || !checkPanelRequirement(registryEntry)) {
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
      position: position
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

  if (!registryEntry.createPopup) {
    // Fallback to adding directly
    return addPanel(panelKey, label);
  }

  popupService.open({
    component: registryEntry.createPopup,
  });
  return true;
}
