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

/**
 * Create requirements propagate down
 */
type Requirements = {
  create?: PanelRequirement[];
  view?: PanelRequirement[];
}

/**
 * Dock panel entry
 */
type DockEntry = {
  id: string;
  label: string;
  component: unknown;
  projectType?: ProjectType;
  requires?: Requirements;
  minimumWidth?: number;
};

/**
 * Menu node that groups dock entries
 */
type DockMenuNode = {
  label: string;
  children: DockRegistryEntry[];
  requires?: Requirements;
};

/**
 * Union type for registry entries
 */
type DockRegistryEntry = DockEntry | DockMenuNode;

/**
 * Type guard to check if an entry is a DockEntry
 */
function isDockEntry(entry: DockRegistryEntry): entry is DockEntry {
  return 'id' in entry;
}

/**
 * Type guard to check if an entry is a DockMenuNode
 */
function isDockMenuNode(entry: DockRegistryEntry): entry is DockMenuNode {
  return 'children' in entry && !('id' in entry);
}

export type MenuEntry = {
  label: string;
  action?: () => void;
  tooltip?: string;
  panelId?: string;
  children?: MenuEntry[];
  createProject?: boolean;
  disabled?: boolean;
};

export const dockRegistry: DockRegistryEntry[] = [
  {
    id: 'truth-table',
    label: 'Truth Table',
    component: TruthTablePanel,
    projectType: 'truth-table',
    minimumWidth: 500,
    requires: {
      view: ['TruthTable']
    }
  },
  {
    label: 'Minimization',
    requires: {
      view: ['TruthTable']
    },
    children: [
      {
        id: 'kv-diagram',
        label: 'Karnaugh-Veitch',
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

const convertRegistryEntryToMenuEntry = (entry: DockRegistryEntry, requirementType: RequirementType, createProject = false): MenuEntry => {
  if (isDockMenuNode(entry)) {
    // Menu node with children
    const requirementsMet = checkDockMenuNodeRequirements(entry, requirementType);

    return {
      label: entry.label,
      children: requirementsMet
        ? entry.children.map(child => convertRegistryEntryToMenuEntry(child, requirementType, createProject))
        : undefined,
      disabled: !requirementsMet
    };
  }

  // Actual dock entry
  const menuEntry: MenuEntry = {
    label: entry.label,
    panelId: entry.id,
    disabled: !checkDockEntryRequirements(entry, requirementType)
  };

  if (createProject) {
    menuEntry.createProject = true;
  }

  return menuEntry;
};

export const newMenu = computed<MenuEntry[]>(() => {
  // Flatten the registry to get only DockEntries with projectType
  const flatEntries = flattenDockEntries();
  return flatEntries
    .filter((entry) => entry.projectType !== undefined)
    .map((entry) => convertRegistryEntryToMenuEntry(entry, 'CREATE', true))
    .sort((a, b) => Number(a.disabled ?? false) - Number(b.disabled ?? false));
});

export const viewMenu = computed<MenuEntry[]>(() => {
  return dockRegistry
    .map((entry) => convertRegistryEntryToMenuEntry(entry, 'VIEW'))
    .sort((a, b) => Number(a.disabled ?? false) - Number(b.disabled ?? false));
});

/**
 * Recursively searches for a DockEntry by id, including nested children.
 * @param id The id to search for.
 * @param entries The entries to search through (defaults to top-level dockRegistry).
 * @returns The found DockEntry or undefined.
 */
export function findDockEntry(id: string, entries: DockRegistryEntry[] = dockRegistry): DockEntry | undefined {
  for (const entry of entries) {
    if (isDockEntry(entry)) {
      if (entry.id === id) return entry;
    } else if (isDockMenuNode(entry)) {
      const found = findDockEntry(id, entry.children);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Recursively flattens all DockEntry entries including nested children.
 * @param entries The entries to flatten (defaults to top-level dockRegistry).
 * @returns A flat array of all DockEntry objects (excludes menu nodes).
 */
function flattenDockEntries(entries: DockRegistryEntry[] = dockRegistry): DockEntry[] {
  const result: DockEntry[] = [];
  for (const entry of entries) {
    if (isDockEntry(entry)) {
      result.push(entry);
    } else if (isDockMenuNode(entry)) {
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

export const checkDockMenuNodeRequirements = (node: DockMenuNode, requirementType: RequirementType): boolean => {
  if (!node.requires) return true;

  const createPanelRequirementsPassed = checkPanelRequirements(node.requires.create);
  if (requirementType === 'CREATE') {
    return createPanelRequirementsPassed;
  }

  // Create requirements propagate down
  return createPanelRequirementsPassed && checkPanelRequirements(node.requires.view);
}
