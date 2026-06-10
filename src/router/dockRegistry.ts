import TruthTablePanel from '@/panels/TruthTablePanel.vue'
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue'
import LogicCircuitsPanel from '@/panels/LogicCircuitsPanel.vue'
import FsmEnginePanel from '@/panels/FsmEnginePanel.vue'
import StateTablePanel from '@/panels/StateTablePanel.vue'
import { computed } from 'vue'
import { projectTypes } from '@/projects/projectRegistry'
import type { ProjectType } from '@/projects/projectRegistry'
import { stateManager } from '@/projects/stateManager'
import { projectManager } from '@/projects/projectManager'
import QMCPanel from '@/panels/QMCPanel.vue'

export type PanelRequirement =
  | 'TruthTable'
  | 'Fsm'
  | 'Min2InputVars'
  | 'Max4InputVars'
  | 'NotSupported'
export type RequirementType = 'CREATE' | 'VIEW'

/**
 * Create requirements propagate down
 */
type Requirements = {
  create?: PanelRequirement[]
  view?: PanelRequirement[]
}

/**
 * Dock panel entry
 */
type DockEntry = {
  id: string
  label: string
  component: unknown
  projectType?: ProjectType
  requires?: Requirements
  minimumWidth?: number
}

/**
 * Menu node that groups dock entries
 */
type DockMenuNode = {
  label: string
  children: DockRegistryEntry[]
  requires?: Requirements
}

/**
 * Union type for registry entries
 */
type DockRegistryEntry = DockEntry | DockMenuNode

/**
 * Type guard to check if an entry is a DockEntry
 */
function isDockEntry(entry: DockRegistryEntry): entry is DockEntry {
  return 'id' in entry
}

/**
 * Type guard to check if an entry is a DockMenuNode
 */
function isDockMenuNode(entry: DockRegistryEntry): entry is DockMenuNode {
  return 'children' in entry && !('id' in entry)
}

export type MenuEntry = {
  label: string
  action?: () => void
  tooltip?: string
  panelId?: string
  children?: MenuEntry[]
  createProject?: boolean
  disabled?: boolean
}

export const dockRegistry: DockRegistryEntry[] = [
  {
    id: 'truth-table',
    label: 'Truth Table',
    component: TruthTablePanel,
    projectType: 'combinatorial-circuit',
    minimumWidth: 500,
    requires: {
      view: ['TruthTable'],
    },
  },
  {
    label: 'Minimization',
    children: [
      {
        id: 'kv-diagram',
        label: 'Karnaugh-Veitch',
        component: KVDiagramPanel,
        projectType: 'combinatorial-circuit',
        minimumWidth: 400,
        requires: {
          view: ['Min2InputVars', 'Max4InputVars'],
        },
      },
      {
        id: 'qmc-visualization',
        label: 'Quine McCluskey',
        component: QMCPanel,
        projectType: 'combinatorial-circuit',
        minimumWidth: 400,
        requires: {
          view: ['TruthTable'],
        },
      },
    ],
  },
  {
    id: 'state-table',
    label: 'State Table',
    component: StateTablePanel,
    requires: {
      view: ['Fsm'],
    },
  },
  {
    id: 'lc-iframe',
    label: 'Logic Circuits',
    component: LogicCircuitsPanel,
    requires: {
      view: ['TruthTable'],
    },
  },
  {
    id: 'fsm-editor',
    label: 'Automaton Editor',
    component: FsmEnginePanel,
    projectType: 'automaton',
    requires: {
      view: ['Fsm'],
    },
  },
]

const convertRegistryEntryToMenuEntry = (
  entry: DockRegistryEntry,
  requirementType: RequirementType,
  createProject = false,
): MenuEntry => {
  if (isDockMenuNode(entry)) {
    // Menu node with children
    const requirementsMet = checkDockMenuNodeRequirements(entry, requirementType)

    const convertedChildren = requirementsMet
      ? entry.children.map((child) =>
          convertRegistryEntryToMenuEntry(child, requirementType, createProject),
        )
      : undefined

    // Disable the menu if its own requirements aren't met, or if all children are disabled
    const allChildrenDisabled =
      convertedChildren && convertedChildren.length > 0
        ? convertedChildren.every((child) => child.disabled)
        : false

    return {
      label: entry.label,
      children: convertedChildren,
      disabled: !requirementsMet || allChildrenDisabled,
    }
  }

  // Actual dock entry
  const menuEntry: MenuEntry = {
    label: entry.label,
    panelId: entry.id,
    disabled: !checkDockEntryRequirements(entry, requirementType),
  }

  if (createProject) {
    menuEntry.createProject = true
  }

  return menuEntry
}

export const newMenu = computed<MenuEntry[]>(() => {
  const groups = new Map<string, DockEntry[]>()

  for (const entry of flattenDockEntries()) {
    if (!entry.projectType) continue
    if (!groups.has(entry.projectType)) groups.set(entry.projectType, [])
    groups.get(entry.projectType)!.push(entry)
  }

  return [...groups.entries()].map(([type, entries]) => ({
    label: projectTypes[type]?.name ?? type,
    children: entries.map((entry) => convertRegistryEntryToMenuEntry(entry, 'CREATE', true)),
  }))
})

export const viewMenu = computed<MenuEntry[]>(() => {
  return dockRegistry
    .map((entry) => convertRegistryEntryToMenuEntry(entry, 'VIEW'))
    .sort((a, b) => Number(a.disabled ?? false) - Number(b.disabled ?? false))
})

/**
 * Recursively searches for a DockEntry by id, including nested children.
 * @param id The id to search for.
 * @param entries The entries to search through (defaults to top-level dockRegistry).
 * @returns The found DockEntry or undefined.
 */
export function findDockEntry(
  id: string,
  entries: DockRegistryEntry[] = dockRegistry,
): DockEntry | undefined {
  for (const entry of entries) {
    if (isDockEntry(entry)) {
      if (entry.id === id) return entry
    } else if (isDockMenuNode(entry)) {
      const found = findDockEntry(id, entry.children)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Recursively flattens all DockEntry entries including nested children.
 * @param entries The entries to flatten (defaults to top-level dockRegistry).
 * @returns A flat array of all DockEntry objects (excludes menu nodes).
 */
function flattenDockEntries(entries: DockRegistryEntry[] = dockRegistry): DockEntry[] {
  const result: DockEntry[] = []
  for (const entry of entries) {
    if (isDockEntry(entry)) {
      result.push(entry)
    } else if (isDockMenuNode(entry)) {
      result.push(...flattenDockEntries(entry.children))
    }
  }
  return result
}

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  flattenDockEntries().map((e) => [e.id, e.component]),
) as Record<string, unknown>

const checkPanelRequirements = (requirements?: PanelRequirement[]): boolean => {
  if (!requirements) return true
  let checkPassed = true

  const currentProjectType = projectManager.currentProjectInfo?.projectType ?? null

  // determine available input variable count for both truth-table and fsm contexts
  const getAvailableInputVarCount = (): number => {
    const tt = stateManager.state.truthTable
    if (tt && Array.isArray(tt.inputVars)) return tt.inputVars.length

    const fsm = stateManager.state.fsm
    if (fsm) {
      const stateCount = (fsm.nodes || []).length
      const stateBits =
        stateCount <= 1 ? 0 : Math.max(0, Math.ceil(Math.log2(Math.max(1, stateCount))))
      const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
      return stateBits + inputBits
    }

    return 0
  }

  requirements.forEach((requirement) => {
    switch (requirement) {
      case 'TruthTable':
        // Only allow for combinatorial-circuit projects, even if FSM sync created a truth table state
        if (!stateManager.state.truthTable || currentProjectType !== 'combinatorial-circuit') {
          checkPassed = false
        }
        break

      case 'Fsm':
        if (!stateManager.state.fsm || currentProjectType !== 'automaton') {
          checkPassed = false
        }
        break

      case 'Min2InputVars':
        // Require at least 2 minimizer input variables
        if (getAvailableInputVarCount() < 2) {
          checkPassed = false
        }
        break

      case 'Max4InputVars':
        // Require less than 5 minimizer input variables
        if (getAvailableInputVarCount() > 4) {
          checkPassed = false
        }
        break

      case 'NotSupported':
        checkPassed = false
        break

      default:
        break
    }
  })
  return checkPassed
}

export const checkDockEntryRequirements = (
  panel: DockEntry,
  requirementType: RequirementType,
): boolean => {
  if (!panel.requires) return true

  const createPanelRequirementsPassed = checkPanelRequirements(panel.requires.create)
  if (requirementType === 'CREATE') {
    return createPanelRequirementsPassed
  }

  // Create requirements propagate down
  return createPanelRequirementsPassed && checkPanelRequirements(panel.requires.view)
}

export const checkDockMenuNodeRequirements = (
  node: DockMenuNode,
  requirementType: RequirementType,
): boolean => {
  if (!node.requires) return true

  const createPanelRequirementsPassed = checkPanelRequirements(node.requires.create)
  if (requirementType === 'CREATE') {
    return createPanelRequirementsPassed
  }

  // Create requirements propagate down
  return createPanelRequirementsPassed && checkPanelRequirements(node.requires.view)
}
