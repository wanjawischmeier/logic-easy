import { computed } from 'vue'
import { newMenu, viewMenu, type MenuEntry } from '@/router/dockRegistry'
import { projectManager } from '@/projects/projectManager'
import { stateManager } from '@/projects/stateManager'
import { downloadRegistry } from '@/utility/downloadRegistry'
import { formulaToLcFile } from '@/utility/LogicCircuitsExport/FormulasToLC'
import {
  exportTruthTableTOVHDLboolExpr,
  exportTruthTableTOVHDLcaseWhen,
} from '@/utility/VHDL/export'
import { exportFsmToVHDLmealy } from '@/utility/VHDL/fsmExport'
import { stateMachineToLC } from '@/utility/LogicCircuitsExport/StateMachineToLC'
import { downloadFile } from '@/utility/downloadFile'
import { popupService } from '@/utility/popupService'
import { formatDate } from '@/utility/dateFormatter'
import AboutPopup from '../popups/AboutPopup.vue'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { FsmProject } from '@/projects/state-machine/FsmProject'

const hasCurrentProject = computed(() => projectManager.currentProjectInfo !== null)
const isFsm = computed(() => projectManager.currentProjectInfo?.projectType === 'state-machine')

const {
  state: truthTable,
  formulas,
  inputVars,
  outputVars,
  functionType,
} = TruthTableProject.useState()

const { state: fsmState } = FsmProject.useState()

export function useHeaderMenus(openFileAction: () => Promise<void>) {
  const recentProjectEntries = computed<MenuEntry[]>(() => {
    const projects = projectManager.listProjects()

    // Group projects by name to identify duplicates
    const projectsByName = new Map<string, typeof projects>()
    projects.forEach((project) => {
      const existing = projectsByName.get(project.name) || []
      existing.push(project)
      projectsByName.set(project.name, existing)
    })

    // For each group with duplicates, sort by ID and assign numbers
    const nameNumbers = new Map<number, number>()
    projectsByName.forEach((group) => {
      if (group.length > 1) {
        // Sort by ID to get consistent numbering
        const sorted = [...group].sort((a, b) => a.id - b.id)
        sorted.forEach((project, index) => {
          nameNumbers.set(project.id, index + 1)
        })
      }
    })

    return projects.map((project) => {
      const number = nameNumbers.get(project.id)
      const displayName = number ? `${project.name} (${number})` : project.name

      return {
        label: displayName,
        tooltip: formatDate(project.lastModified),
        action: () => {
          projectManager.openProject(project.id)
        },
      }
    })
  })

  const menus = computed<Record<string, MenuEntry[]>>(() => ({
    Project: [
      {
        label: 'New',
        children: newMenu.value,
      },
      ...(recentProjectEntries.value.length > 0
        ? [
            {
              label: 'Recents',
              children: recentProjectEntries.value,
            },
          ]
        : []),
      {
        label: 'Open',
        tooltip: 'Ctrl+O',
        action: openFileAction,
      },
      {
        label: 'Save',
        tooltip: 'Ctrl+S',
        action: projectManager.downloadProject,
        disabled: !hasCurrentProject.value,
      },
      {
        label: 'Close',
        action: projectManager.closeCurrentProject,
        disabled: !hasCurrentProject.value || stateManager.isSaving.value,
      },
    ],
    View: filteredViewMenu.value,
    Export: [
      {
        label: 'LogicCircuits',
        tooltip: '.lc',
        disabled: !hasCurrentProject.value || stateManager.isSaving.value,
        children: isFsm.value
          ? [
              {
                label: 'State machine',
                action: () => {
                  const name = projectManager.getCurrentProject()?.name ?? 'no name'
                  downloadFile(
                    stateMachineToLC().toString(),
                    name.replace(/\s+/g, '_') + '.lc',
                    'text/lc',
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
            ]
          : [
              {
                label: 'AND/OR',
                action: () => {
                  formulaToLcFile(
                    projectManager.getCurrentProject()?.name ?? 'no name provided',
                    formulas.value,
                    inputVars.value,
                    outputVars.value,
                    functionType.value,
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
              {
                label: 'NAND',
                action: () => {
                  formulaToLcFile(
                    projectManager.getCurrentProject()?.name ?? 'no name provided',
                    formulas.value,
                    inputVars.value,
                    outputVars.value,
                    functionType.value,
                    'nand',
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
              {
                label: 'NOR',
                action: () => {
                  formulaToLcFile(
                    projectManager.getCurrentProject()?.name ?? 'no name provided',
                    formulas.value,
                    inputVars.value,
                    outputVars.value,
                    functionType.value,
                    'nor',
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
            ],
      },
      {
        label: 'VHDL',
        tooltip: '.vhdl',
        disabled: !hasCurrentProject.value || stateManager.isSaving.value,
        children: isFsm.value
          ? [
              {
                label: 'State machine',
                action: () => {
                  exportFsmToVHDLmealy(
                    fsmState.value,
                    projectManager.getCurrentProject()?.name ?? 'no name',
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
            ]
          : [
              {
                label: 'Case-When',
                action: () => {
                  exportTruthTableTOVHDLcaseWhen(
                    truthTable.value,
                    projectManager.getCurrentProject()?.name ?? 'no name provided',
                  )
                },
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
              },
              {
                label: 'Boolean expressions',
                disabled: !hasCurrentProject.value || stateManager.isSaving.value,
                children: [
                  {
                    label: 'Disjunctive',
                    action: () => {
                      exportTruthTableTOVHDLboolExpr(
                        truthTable.value,
                        projectManager.getCurrentProject()?.name ?? 'no name provided',
                      )
                    },
                    disabled: !hasCurrentProject.value || stateManager.isSaving.value,
                  },
                  {
                    label: 'Conjunctive',
                    action: () => {
                      exportTruthTableTOVHDLboolExpr(
                        truthTable.value,
                        projectManager.getCurrentProject()?.name ?? 'no name provided',
                        'cnf',
                      )
                    },
                    disabled: !hasCurrentProject.value || stateManager.isSaving.value,
                  },
                ],
              },
            ],
      },
      {
        label: 'Screenshots',
        tooltip: '.zip',
        action: () => downloadRegistry.exportAllScreenshots(),
        disabled: !hasCurrentProject.value || stateManager.isSaving.value,
      },
      {
        label: 'LaTeX',
        tooltip: '.tex',
        action: () => downloadRegistry.exportAllLatex(),
        disabled: !hasCurrentProject.value || stateManager.isSaving.value,
      },
    ],
    Help: [
      {
        label: 'Manual',
        action: () => window.open('/logic-easy/docs/', '_blank', 'noopener,noreferrer'),
      },
      { label: 'About', action: () => popupService.open({ component: AboutPopup }) },
    ],
  }))

  return { menus }
}

/**
 * Check if all items in an array are disabled (recursively checks children)
 */
export function areAllItemsDisabled(items: MenuEntry[]): boolean {
  if (items.length === 0) return true

  return items.every((item) => {
    if (item.disabled) return true
    if (item.children) {
      return areAllItemsDisabled(item.children)
    }
    return false
  })
}

/**
 * Check if a menu should be disabled based on its items.
 */
export function shouldMenuBeDisabled(menuName: string, items: MenuEntry[]): boolean {
  // If menu has no items at all, disable it
  if (items.length === 0) return true

  // For Export menu: disable only when there's no current project
  if (menuName === 'Export') {
    return !hasCurrentProject.value
  }

  // For other menus: check if all items are disabled
  return areAllItemsDisabled(items)
}

/**
 * Filter out disabled entries from menu items (recursively)
 */
export function filterDisabledEntries(items: MenuEntry[]): MenuEntry[] {
  return items
    .filter((item) => !item.disabled)
    .map((item) => ({
      ...item,
      children: item.children ? filterDisabledEntries(item.children) : undefined,
    }))
}

/**
 * Filtered view menu with disabled entries removed
 */
const filteredViewMenu = computed(() => filterDisabledEntries(viewMenu.value))
