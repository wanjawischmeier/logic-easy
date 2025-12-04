import { popupService } from './popupService';
import TruthTablePopup from '@/components/popups/TruthTablePopup.vue';

export type DockviewApiMinimal = {
  addPanel: (opts: {
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: unknown;
  }) => void;
  panels: Array<{
    id: string;
    api: {
      component: string;
      setActive: () => void;
    };
  }>;
};

export function getDockviewApi(): DockviewApiMinimal | null {
  const api = (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api;
  return api ?? null;
}

export function getSharedParams(): Record<string, unknown> | undefined {
  const params = (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams;
  return params;
}

function findPanelByComponent(component: string): { id: string; api: { setActive: () => void } } | null {
  const api = getDockviewApi();
  if (!api || !api.panels) return null;

  const panel = api.panels.find(p => p.api.component === component);
  return panel ? { id: panel.id, api: panel.api } : null;
}

export function addPanel(panelKey: string, label: string): boolean {
  const api = getDockviewApi();
  if (!api) {
    console.warn('Dockview API not ready yet');
    return false;
  }

  // Check if panel with this component already exists
  const existingPanel = findPanelByComponent(panelKey);
  if (existingPanel) {
    console.log(`Panel with component '${panelKey}' already exists, focusing it`);
    existingPanel.api.setActive();
    return true;
  }

  const sharedParams = getSharedParams();
  const id = `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    api.addPanel({
      id,
      component: panelKey,
      title: label,
      params: sharedParams,
    });
    return true;
  } catch (err) {
    console.error('Failed to add panel', err);
    return false;
  }
}

export function addPanelWithPopup(panelKey: string, label: string): boolean {
  // Show popup for truth-table
  if (panelKey === 'truth-table') {
    popupService.open({
      component: TruthTablePopup,
    });
    return true;
  }

  // For other panels, add directly
  return addPanel(panelKey, label);
}
