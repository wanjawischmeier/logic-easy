import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue';
import TruthTablePanel from '@/panels/TruthTablePanel.vue';
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue';
import LogicCircuitsTestingPanel from '@/panels/LogicCircuitsTestingPanel.vue';
import FsmEnginePanel from '@/panels/FsmEnginePanel.vue';
import StateTablePanel from '@/panels/StateTablePanel.vue';
import { stateManager } from '@/states/stateManager';
import TruthTableProjectProps from '@/components/popups/TruthTableProjectProps.vue';
import { computed, markRaw } from 'vue';

export type PanelRequirement = 'TruthTable' | 'TransitionTable' | 'Min2InputVars' | 'Max4InputVars' | 'NotSupported';
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
  projectPropsComponent?: unknown;
  requires?: Requirements;
};

export type MenuEntry = {
  label: string;
  action?: () => void;
  tooltip?: string;
  panelId?: string;
  children?: MenuEntry[];
  withPopup?: boolean;
  disabled?: boolean;
};

export const dockRegistry: DockEntry[] = [
  {
    id: 'truth-table',
    label: 'Truth Table',
    component: TruthTablePanel,
    projectPropsComponent: markRaw(TruthTableProjectProps),
    requires: {
      view: ['TruthTable']
    }
  },
  {
    id: 'kv-diagram',
    label: 'KV Diagram',
    component: KVDiagramPanel,
    projectPropsComponent: markRaw(TruthTableProjectProps),
    requires: {
      view: ['TruthTable', 'Min2InputVars', 'Max4InputVars']
    }
  },
    {
    id: 'state-table',
    label: 'State Table',
    component: StateTablePanel
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
    .filter((menuEntry) => menuEntry.projectPropsComponent)
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

export const checkDockEntryRequirements = (panel: DockEntry, requirementType: RequirementType): boolean => {
  if (!panel.requires) return true;

  const createPanelRequirementsPassed = checkPanelRequirements(panel.requires.create);
  if (requirementType === 'CREATE') {
    return createPanelRequirementsPassed;
  }

  // Create requirements propagate down
  return createPanelRequirementsPassed && checkPanelRequirements(panel.requires.view);
}
