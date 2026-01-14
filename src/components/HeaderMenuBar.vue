<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div
      v-for="(items, menu) in menus"
      :key="menu"
      class="relative"
      @mouseenter="maybeSwitch(menu)"
    >
      <button
        class="border border-transparent hover:border-surface-3 hover:bg-surface-2"
        @click.stop="toggleMenu(menu)"
        :aria-expanded="activeMenu === menu"
        :aria-haspopup="true"
        type="button"
      >
        {{ menu }}
      </button>

      <div
        v-if="activeMenu === menu"
        class="absolute left-0 mt-1 w-48 bg-surface-2 border border-surface-3 rounded z-20"
      >
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
import CreditPopup from './popups/CreditPopup.vue'
import { projectManager } from '@/projects/projectManager'
import { stateManager } from '@/projects/stateManager'
import { downloadRegistry } from '@/utility/downloadRegistry'
import { formulaToLcFile } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import {
  exportTruthTableTOVHDLboolExpr,
  exportTruthTableTOVHDLcaseWhen,
} from '@/utility/VHDL/export.ts'

const hasCurrentProject = computed(() => projectManager.currentProjectInfo !== null)

const menus = computed<Record<string, MenuEntry[]>>(() => ({
  Project: [
    {
      label: 'New',
      children: newMenu.value,
    },
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
      disabled: !hasCurrentProject.value,
    },
  ],
  View: viewMenu.value,
  Export: [
    {
      label: 'LogicCircuits',
      tooltip: '.lc',
      children: [
        {
          label: 'AND/OR',
          action: () => {
            formulaToLcFile(
              projectManager.getCurrentProject()?.name ?? 'no name provided',
              stateManager.state.truthTable!.formulas,
              stateManager.state.truthTable!.inputVars,
              stateManager.state.truthTable!.outputVars,
              'dnf',
            )
          },
        },
        {
          label: 'NAND',
          action: () => {
            formulaToLcFile(
              projectManager.getCurrentProject()?.name ?? 'no name provided',
              stateManager.state.truthTable!.formulas,
              stateManager.state.truthTable!.inputVars,
              stateManager.state.truthTable!.outputVars,
              'dnf',
              'nand',
            )
          },
        },
        {
          label: 'NOR',
          action: () => {
            formulaToLcFile(
              projectManager.getCurrentProject()?.name ?? 'no name provided',
              stateManager.state.truthTable!.formulas,
              stateManager.state.truthTable!.inputVars,
              stateManager.state.truthTable!.outputVars,
              'dnf',
              'nor',
            )
          },
        },
      ],
    },
    {
      label: 'VHDL',
      tooltip: '.vhdl',
      children: [
        {
          label: 'Case-When',
          action: () => {
            exportTruthTableTOVHDLcaseWhen(
              stateManager.state.truthTable,
              projectManager.getCurrentProject()?.name ?? 'no name provided',
            )
          },
        },
        {
          label: 'Boolean expressions',
          children: [
            {
              label: 'DNF',
              action: () => {
                exportTruthTableTOVHDLboolExpr(
                  stateManager.state.truthTable,
                  projectManager.getCurrentProject()?.name ?? 'no name provided',
                )
              },
            },
            {
              label: 'CNF',
              action: () => {
                exportTruthTableTOVHDLboolExpr(
                  stateManager.state.truthTable,
                  projectManager.getCurrentProject()?.name ?? 'no name provided',
                  'cnf',
                )
              },
            },
          ],
        },
      ],
    },
    {
      label: 'Screenshots',
      tooltip: '.zip',
      action: () => downloadRegistry.exportAllScreenshots(),
    },
    { label: 'LaTeX', tooltip: '.tex', action: () => downloadRegistry.exportAllLatex() },
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
        props.items.map((entry, idx) =>
          h(
            'li',
            { class: 'relative', key: idx },
            [
              h(
                'button',
                {
                  class:
                    'w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm',
                  disabled: (!entry.action && !entry.panelId && !entry.children) || entry.disabled,
                  onClick: entry.children ? undefined : () => runAction(entry),
                  onMouseenter: entry.children
                    ? () => showSubmenu(level.value, idx)
                    : () => hideSubmenu(level.value),
                  type: 'button',
                },
                [
                  h('span', entry.label),
                  entry.tooltip ? h('span', { class: 'opacity-70' }, entry.tooltip) : null,
                  entry.children ? h('span', { class: 'opacity-70' }, '›') : null,
                ],
              ),
              entry.children && isOpen(level.value, idx)
                ? h(
                    'div',
                    {
                      class:
                        'absolute left-full top-0 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20',
                    },
                    [h(MenuList, { items: entry.children, level: level.value + 1 })],
                  )
                : null,
            ],
          ),
        ),
      )
  },
})

function toggleMenu(name: string): void {
  activeMenu.value = activeMenu.value === name ? '' : name
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
    return
  }

  activeMenu.value = ''
  openPath.value = []
}

function handleDocClick(e: MouseEvent): void {
  const root = rootRef.value
  if (!root) return
  const target = e.target as Node | null
  if (!target || !root.contains(target)) {
    activeMenu.value = ''
    openPath.value = []
  }
}

async function openFile() {
  await stateManager.openFile()

  activeMenu.value = ''
  openPath.value = []
}

onMounted(() => {
  document.addEventListener('click', handleDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
})
</script>
