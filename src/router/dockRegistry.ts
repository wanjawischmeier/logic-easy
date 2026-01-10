import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue';
import TruthTablePanel from '@/panels/TruthTablePanel.vue';
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue';
import LogicCircuitsPanel from '@/panels/LogicCircuitsPanel.vue';
import FsmEnginePanel from '@/panels/FsmEnginePanel.vue';
import StateTablePanel from '@/panels/StateTablePanel.vue';
import { computed } from 'vue';
import type { ProjectType } from '@/projects/projectRegistry';
import { stateManager } from '@/projects/stateManager';
import QMCPanel from '@/panels/QMCPanel.vue';

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
  minimumWidth?: number;
  children?: DockEntry[];
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
    label: 'Minimization',
    component: KVDiagramPanel,
    projectType: 'truth-table',
    minimumWidth: 500,
    requires: {
      view: ['TruthTable', 'Min2InputVars', 'Max4InputVars']
    },
    children: [
      {
        id: 'kv-diagram',
        label: 'KV Diagram',
        component: KVDiagramPanel,
        projectType: 'truth-table',
        minimumWidth: 400,
        requires: {
          view: ['TruthTable', 'Min2InputVars', 'Max4InputVars']
        },
      },
      {
        id: 'qmc-visualization',
        label: 'Quine McCluskey',
        component: QMCPanel,
        projectType: 'truth-table',
        minimumWidth: 400,
        requires: {
          view: ['TruthTable']
        },
      }
    ]
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
    id: 'lc-iframe',
    label: 'Logic Circuits Panel',
    component: LogicCircuitsPanel,
  },
  {
    id: 'fsm-engine',
    label: 'FSM Engine',
    component: FsmEnginePanel,
    projectType: 'automaton',
    requires: {
      view: ['Automaton']
    }
  },
];

const convertDockEntryToMenuEntry = (entry: DockEntry, requirementType: RequirementType, createProject = false): MenuEntry => {
  const menuEntry: MenuEntry = {
    label: entry.label,
    panelId: entry.id,
    disabled: !checkDockEntryRequirements(entry, requirementType)
  };

  if (createProject) {
    menuEntry.createProject = true;
  }

  if (entry.children) {
    menuEntry.children = entry.children.map(child => convertDockEntryToMenuEntry(child, requirementType, createProject));
    delete menuEntry.panelId;
  }

  return menuEntry;
};

export const newMenu = computed<MenuEntry[]>(() =>
  dockRegistry
    .filter((menuEntry) => menuEntry.projectType !== undefined)
    .map((menuEntry) => convertDockEntryToMenuEntry(menuEntry, 'CREATE', true))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
);

export const viewMenu = computed<MenuEntry[]>(() => {
  return dockRegistry
    .map((menuEntry) => convertDockEntryToMenuEntry(menuEntry, 'VIEW'))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
});

/**
 * Recursively searches for a DockEntry by id, including nested children.
 * @param id The id to search for.
 * @param entries The entries to search through (defaults to top-level dockRegistry).
 * @returns The found DockEntry or undefined.
 */
export function findDockEntry(id: string, entries: DockEntry[] = dockRegistry): DockEntry | undefined {
  for (const entry of entries) {
    if (entry.id === id) return entry;
    if (entry.children) {
      const found = findDockEntry(id, entry.children);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Recursively flattens all DockEntry entries including nested children.
 * @param entries The entries to flatten (defaults to top-level dockRegistry).
 * @returns A flat array of all DockEntry objects.
 */
function flattenDockEntries(entries: DockEntry[] = dockRegistry): DockEntry[] {
  const result: DockEntry[] = [];
  for (const entry of entries) {
    result.push(entry);
    if (entry.children) {
      result.push(...flattenDockEntries(entry.children));
    }
  }
  return result;
}

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  flattenDockEntries().map((e) => [e.id, e.component])
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
