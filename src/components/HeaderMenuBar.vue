<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div v-for="(items, menu) in menus" :key="menu" class="relative" @mouseenter="maybeSwitch(menu)">
      <button class="border hover:border-surface-3 hover:bg-surface-2"
        :class="activeMenu === menu ? 'border-surface-3 bg-surface-2' : 'border-transparent'"
        @click.stop="toggleMenu(menu)" :aria-expanded="activeMenu === menu" :aria-haspopup="true" type="button">
        {{ menu }}
      </button>

      <div v-if="activeMenu === menu"
        class="absolute left-0 mt-1 w-48 bg-surface-2 border border-surface-3 rounded z-20">
        <MenuList :items="items" :level="0" />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, defineComponent, h, type PropType } from 'vue'
import { newMenu, viewMenu, type MenuEntry } from '@/router/dockRegistry'
import { createPanel } from '@/utility/dockview/integration'
import { popupService, showProjectCreationPopup } from '@/utility/popupService'
import { dropdownService } from '@/utility/dropdownService'
import CreditPopup from './popups/CreditPopup.vue'
import { projectManager } from '@/projects/projectManager'
import { stateManager } from '@/projects/stateManager'
import { downloadRegistry } from '@/utility/downloadRegistry'
import { formulaToLcFile } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import {
  exportTruthTableTOVHDLboolExpr,
  exportTruthTableTOVHDLcaseWhen,
} from '@/utility/VHDL/export.ts'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'

const hasCurrentProject = computed(() => projectManager.currentProjectInfo !== null)

const { state: truthTable, formulas, inputVars, outputVars } = TruthTableProject.useState()

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
      action: openFile,
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
  View: viewMenu.value,
  Export: [
    {
      label: 'LogicCircuits',
      tooltip: '.lc',
      disabled: !hasCurrentProject.value || stateManager.isSaving.value,
      children: [
        {
          label: 'AND/OR',
          action: () => {
            formulaToLcFile(
              projectManager.getCurrentProject()?.name ?? 'no name provided',
              formulas.value,
              inputVars.value,
              outputVars.value,
              'dnf',
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
              'dnf',
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
              'dnf',
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
      children: [
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
      disabled: !hasCurrentProject.value || stateManager.isSaving.value
    },
  ],
  Help: [
    {
      label: 'Manual',
      action: () => window.open('/logic-easy/docs/', '_blank', 'noopener,noreferrer'),
    },
    { label: 'About', action: () => popupService.open({ component: CreditPopup }) },
  ],
}))

const activeMenu = ref<string>('')
const openPath = ref<number[]>([])
const rootRef = ref<HTMLElement | null>(null)

type MenuListProps = {
  items: MenuEntry[]
  level?: number
}

const MenuList = defineComponent<MenuListProps>({
  name: 'MenuList',
  props: {
    items: { type: Array as PropType<MenuEntry[]>, required: true },
    level: { type: Number, default: 0 },
  },
  setup(props: MenuListProps) {
    const level = computed(() => props.level ?? 0)
    return () =>
      h(
        'ul',
        { class: 'pr-1' },
        props.items.map((entry, idx) => {
          const submenuOpen = isOpen(level.value, idx)
          return h(
            'li',
            { class: 'relative', key: idx },
            [
              h(
                'button',
                {
                  class: [
                    'w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm',
                    { 'bg-surface-3': submenuOpen }
                  ],
                  disabled: (!entry.action && !entry.panelId && !entry.children) || entry.disabled,
                  onClick: entry.children ? undefined : () => runAction(entry),
                  onMouseenter: entry.children && !entry.disabled
                    ? () => showSubmenu(level.value, idx)
                    : () => hideSubmenu(level.value),
                  type: 'button',
                },
                [
                  h('span', entry.label),
                  (entry.tooltip || entry.children) ? h('span', { class: 'flex items-center gap-2' }, [
                    entry.tooltip ? h('span', { class: 'opacity-70' }, entry.tooltip) : null,
                    entry.children ? h('span', { class: 'opacity-70' }, '›') : null,
                  ]) : null,
                ],
              ),
              submenuOpen && entry.children && !entry.disabled
                ? h(
                  'div',
                  {
                    class:
                      'absolute left-full top-0 -mt-0.5 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20',
                  },
                  [h(MenuList, { items: entry.children, level: level.value + 1 })],
                )
                : null,
            ],
          )
        }),
      )
  },
})

function toggleMenu(name: string): void {
  const isOpening = activeMenu.value !== name

  if (isOpening) {
    // When opening, notify the dropdown service to close others
    dropdownService.open(closeMenu)
    activeMenu.value = name
  } else {
    // When closing, notify the service
    dropdownService.close()
    activeMenu.value = ''
  }

  openPath.value = []
}

function maybeSwitch(name: string): void {
  if (activeMenu.value && activeMenu.value !== name) {
    activeMenu.value = name
    openPath.value = []
  }
}

function showSubmenu(level: number, idx: number): void {
  openPath.value = [...openPath.value.slice(0, level), idx]
}

function hideSubmenu(level: number): void {
  openPath.value = openPath.value.slice(0, level)
}

function isOpen(level: number, idx: number): boolean {
  return openPath.value[level] === idx
}

function runAction(entry: MenuEntry): void {
  if (entry.action) {
    entry.action()
    activeMenu.value = ''
    openPath.value = []
    dropdownService.close()
    return
  }

  if (entry.panelId) {
    if (entry.createProject ?? false) {
      showProjectCreationPopup(entry)
    } else {
      createPanel(entry.panelId, entry.label)
    }

    activeMenu.value = ''
    openPath.value = []
    dropdownService.close()
    return
  }

  activeMenu.value = ''
  openPath.value = []
  dropdownService.close()
}

function closeMenu(): void {
  activeMenu.value = ''
  openPath.value = []
}

function handleDocClick(e: MouseEvent): void {
  const root = rootRef.value
  if (!root) return
  const target = e.target as Node | null
  if (!target || !root.contains(target)) {
    closeMenu()
  }
}

async function openFile() {
  await stateManager.openFile()

  closeMenu()
}

onMounted(() => {
  document.addEventListener('click', handleDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  dropdownService.close()
})
</script>
