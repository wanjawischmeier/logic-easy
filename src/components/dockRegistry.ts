import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue';
import TruthTablePanel from '@/panels/TruthTablePanel.vue';
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue';
import LogicCircuitsTestingPanel from '@/panels/LogicCircuitsTestingPanel.vue';
import { stateManager } from '@/utility/states/stateManager';
import TruthTablePopup from './popups/TruthTablePopup.vue';
import { computed } from 'vue';

export type PanelRequirement = 'TruthTable' | 'TransitionTable' | 'Min2InputVars' | 'Max4InputVars' | 'NotSupported';

type DockEntry = {
  id: string;
  label: string;
  component: unknown;
  createPopup?: unknown;
  requires?: PanelRequirement[];
};

export type MenuEntry = {
  label: string;
  action?: () => void;
  tooltip?: string;
  panelKey?: string;
  children?: MenuEntry[];
  withPopup?: boolean;
  disabled?: boolean;
};

export const newMenu = computed<MenuEntry[]>(() =>
  dockRegistry
    .filter((menuEntry) => menuEntry.createPopup)
    .map((menuEntry) => ({
      label: menuEntry.label,
      panelKey: menuEntry.id,
      withPopup: true,
      disabled: !checkPanelRequirement(menuEntry)
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
);

export const viewMenu = computed<MenuEntry[]>(() => {
  return dockRegistry
    .map((menuEntry) => ({
      label: menuEntry.label,
      panelKey: menuEntry.id,
      disabled: !checkPanelRequirement(menuEntry)
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
});

export const dockRegistry: DockEntry[] = [
  {
    id: 'truth-table',
    label: 'Truth Table',
    component: TruthTablePanel,
    createPopup: TruthTablePopup,
    requires: ['TruthTable']
  },
  {
    id: 'kv-diagram',
    label: 'KV Diagram',
    component: KVDiagramPanel,
    createPopup: TruthTablePopup,
    requires: ['TruthTable', 'Min2InputVars', 'Max4InputVars']
  },
  {
    id: 'transition-table',
    label: 'Transition Table',
    component: KVDiagramPanel,
    createPopup: TruthTablePopup,
    requires: ['NotSupported']
  },
  {
    id: 'state-table',
    label: 'State Table',
    component: KVDiagramPanel,
    createPopup: TruthTablePopup,
    requires: ['NotSupported']
  },
  {
    id: 'state-machine',
    label: 'State Machine',
    component: KVDiagramPanel,
    createPopup: TruthTablePopup,
    requires: ['NotSupported']
  },
  {
    id: 'espresso-testing',
    label: 'Espresso Testing Panel',
    component: EspressoTestingPanel
  },
  {
    id: 'lc-testing',
    label: 'Logic Circuits Panel',
    component: LogicCircuitsTestingPanel
  },
];

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  dockRegistry.map((e) => [e.id, e.component])
) as Record<string, unknown>;

export const checkPanelRequirement = (panel: DockEntry): boolean => {
  if (!panel.requires) return true;

  let checkPassed = true;

  panel.requires.forEach((requirement) => {
    console.log(requirement)
    switch (requirement) {
      case 'TruthTable':
        if (stateManager.state.truthTable === undefined) {
          checkPassed = false;
        }
        break;

      case 'Min2InputVars':
        if ((stateManager.state.truthTable?.inputVars?.length ?? 0) < 2) {
          checkPassed = false;
        }
        break;

      case 'Max4InputVars':
        if ((stateManager.state.truthTable?.inputVars?.length ?? 0) > 4) {
          checkPassed = false;
        }
        break;

      case 'NotSupported':
        checkPassed = false;
        break;

      default:
        break;
    }
  });
  return checkPassed;
}
