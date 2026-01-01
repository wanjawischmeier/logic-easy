import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue';
import TruthTablePanel from '@/panels/TruthTablePanel.vue';
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue';
import LogicCircuitsTestingPanel from '@/panels/LogicCircuitsTestingPanel.vue';
import FsmEnginePanel from '@/panels/FsmEnginePanel.vue';
import StateTablePanel from '@/panels/StateTablePanel.vue';
import { computed } from 'vue';
import type { ProjectType } from '@/projects/projectRegistry';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject';
import { stateManager } from '@/states/stateManager';

export type PanelRequirement = 'TruthTable' | 'Automaton' | 'Min2InputVars' | 'Max4InputVars' | 'NotSupported';
export type RequirementType = 'CREATE' | 'VIEW'

// Create requirements propagate down
type Requirements = {
  create?: PanelRequirement[];
  view?: PanelRequirement[];
}

type DockEntry = {
  id: string;
  label: string;
  component: unknown;
  projectType?: ProjectType;
  requires?: Requirements;
};

export type MenuEntry = {
  label: string;
  action?: () => void;
  tooltip?: string;
  panelId?: string;
  children?: MenuEntry[];
  createProject?: boolean;
  disabled?: boolean;
};

export const dockRegistry: DockEntry[] = [
  {
    id: 'truth-table',
    label: 'Truth Table',
    component: TruthTablePanel,
    projectType: 'truth-table',
    requires: {
      view: ['TruthTable']
    }
  },
  {
    id: 'kv-diagram',
    label: 'KV Diagram',
    component: KVDiagramPanel,
    projectType: 'truth-table',
    requires: {
      view: ['TruthTable', 'Min2InputVars', 'Max4InputVars']
    }
  },
  {
    id: 'transition-table',
    label: 'Transition Table',
    component: KVDiagramPanel,
    projectType: 'truth-table',
    requires: {
      create: ['NotSupported']
    }
  },
  {
    id: 'state-table',
    label: 'State Table',
    component: StateTablePanel,
    projectType: 'automaton',
    requires: {
      view: ['Automaton']
    }
  },
  {
    id: 'state-machine',
    label: 'State Machine',
    component: KVDiagramPanel,
    projectType: 'truth-table',
    requires: {
      create: ['NotSupported']
    }
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
  {
    id: 'fsm-engine',
    label: 'FSM Engine',
    component: FsmEnginePanel
  },
];

export const newMenu = computed<MenuEntry[]>(() =>
  dockRegistry
    .filter((menuEntry) => menuEntry.projectType !== undefined)
    .map((menuEntry) => ({
      label: menuEntry.label,
      panelId: menuEntry.id,
      withPopup: true,
      disabled: !checkDockEntryRequirements(menuEntry, 'CREATE')
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
);

export const viewMenu = computed<MenuEntry[]>(() => {
  return dockRegistry
    .map((menuEntry) => ({
      label: menuEntry.label,
      panelId: menuEntry.id,
      disabled: !checkDockEntryRequirements(menuEntry, 'VIEW')
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
});

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  dockRegistry.map((e) => [e.id, e.component])
) as Record<string, unknown>;

const checkPanelRequirements = (requirements?: PanelRequirement[]): boolean => {
  if (!requirements) return true;
  let checkPassed = true;

  requirements.forEach((requirement) => {
    switch (requirement) {
      case 'TruthTable':
        // Check if truth table state exists
        if (!stateManager.state.truthTable) {
          checkPassed = false;
        }
        break;

      case 'Automaton':
        // Check if truth table state exists
        if (!stateManager.state.automaton) {
          checkPassed = false;
        }
        break;

      case 'Min2InputVars':
        // Check if truth table has at least 2 input variables
        if ((stateManager.state.truthTable?.inputVars?.length ?? 0) < 2) {
          checkPassed = false;
        }
        break;

      case 'Max4InputVars':
        // Check if truth table has at most 4 input variables
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

export const checkDockEntryRequirements = (panel: DockEntry, requirementType: RequirementType): boolean => {
  if (!panel.requires) return true;

  const createPanelRequirementsPassed = checkPanelRequirements(panel.requires.create);
  if (requirementType === 'CREATE') {
    return createPanelRequirementsPassed;
  }

  // Create requirements propagate down
  return createPanelRequirementsPassed && checkPanelRequirements(panel.requires.view);
}
