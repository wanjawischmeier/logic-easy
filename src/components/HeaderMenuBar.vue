<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div v-for="(items, menu) in menus" :key="menu" class="relative" @mouseenter="maybeSwitch(menu)">
      <button class="border border-transparent hover:border-surface-3 hover:bg-surface-2" @click.stop="toggleMenu(menu)"
        :aria-expanded="activeMenu === menu" :aria-haspopup="true" type="button">
        {{ menu }}
      </button>

      <div v-if="activeMenu === menu"
        class="absolute left-0 mt-1 w-48 bg-surface-2 border border-surface-3 rounded z-20">
        <ul class="pr-1">
          <li v-for="(entry, idx) in items" :key="idx" class="relative">
            <button
              class="w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm"
              :disabled="(!entry.action && !entry.panelId && !entry.children) || entry.disabled"
              @click="entry.children ? null : runAction(entry)"
              @mouseenter="entry.children && !entry.disabled ? showSubmenu(idx) : hideSubmenu()" type="button">
              <span>{{ entry.label }}</span>
              <span v-if="entry.tooltip" class="opacity-70">{{ entry.tooltip }}</span>
              <span v-if="entry.children" class="opacity-70">›</span>
            </button>

            <!-- Submenu -->
            <div v-if="entry.children && activeSubmenu === idx"
              class="absolute left-full top-0 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20">
              <ul class="pr-1">
                <li v-for="(child, childIdx) in entry.children" :key="childIdx">
                  <button
                    class="w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm"
                    :disabled="(!child.action && !child.panelId) || child.disabled" @click="runAction(child)"
                    type="button">
                    <span>{{ child.label }}</span>
                    <span v-if="child.tooltip" class="opacity-70">{{ child.tooltip }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { newMenu, viewMenu, type MenuEntry } from '@/router/dockRegistry';
import { createPanel } from '@/utility/dockview/integration';
import { popupService, showProjectCreationPopup } from '@/utility/popupService';
import CreditPopup from './popups/CreditPopup.vue';
import { projectManager } from '@/projects/projectManager';
import { stateManager } from '@/projects/stateManager';
import { downloadRegistry } from '@/utility/downloadRegistry';
import { formulaToLcFile } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import { exportTruthTableTOVHDLboolExpr, exportTruthTableTOVHDLcaseWhen } from '@/utility/VHDL/export.ts'

const hasCurrentProject = computed(() => projectManager.currentProjectInfo !== null);

const menus = computed<Record<string, MenuEntry[]>>(() => ({
  Project: [
    {
      label: 'New',
      children: newMenu.value
    },
    {
      label: 'Open',
      tooltip: 'Ctrl+O',
      action: openFile
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
      label: 'LogicCircuits', tooltip: '.lc', children: [
        {
          label: 'AND/OR', action: () => {
            formulaToLcFile(projectManager.getCurrentProject()?.name ?? 'no name provided', stateManager.state.truthTable!.formulas, stateManager.state.truthTable!.inputVars, stateManager.state.truthTable!.outputVars, 'dnf')
          }
        },
        { label: 'NAND', action: () => { formulaToLcFile(projectManager.getCurrentProject()?.name ?? 'no name provided', stateManager.state.truthTable!.formulas, stateManager.state.truthTable!.inputVars, stateManager.state.truthTable!.outputVars, 'dnf', 'nand') } },
        { label: 'NOR', action: () => { formulaToLcFile(projectManager.getCurrentProject()?.name ?? 'no name provided', stateManager.state.truthTable!.formulas, stateManager.state.truthTable!.inputVars, stateManager.state.truthTable!.outputVars, 'dnf', 'nor') } },
      ]
    },
    {
      label: 'VHDL', tooltip: '.vhdl', children: [
        { label: 'Case-When', action: () => { exportTruthTableTOVHDLcaseWhen(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided') } },
        {
          label: 'Boolean expressions', children: [
            { label: "DNF", action: () => { exportTruthTableTOVHDLboolExpr(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided') } },
            { label: "CNF", action: () => { exportTruthTableTOVHDLboolExpr(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided', 'cnf') } },
          ]
        },
      ]
    },
    { label: 'Screenshots', tooltip: '.zip', action: () => downloadRegistry.exportAllScreenshots() },
    { label: 'LaTeX', tooltip: '.tex', action: () => downloadRegistry.exportAllLatex() },
  ],
  Help: [
    { label: 'Manual', action: () => window.open('/logic-easy/docs/', '_blank', 'noopener,noreferrer') },
    { label: 'About', action: () => popupService.open({ component: CreditPopup }) },
  ],
}));

const activeMenu = ref<string>('');
const activeSubmenu = ref<number | null>(null);
const rootRef = ref<HTMLElement | null>(null);

function toggleMenu(name: string): void {
  activeMenu.value = activeMenu.value === name ? '' : name;
  activeSubmenu.value = null;
}

function maybeSwitch(name: string): void {
  if (activeMenu.value && activeMenu.value !== name) {
    activeMenu.value = name;
    activeSubmenu.value = null;
  }
}

function showSubmenu(idx: number): void {
  activeSubmenu.value = idx;
}

function hideSubmenu(): void {
  activeSubmenu.value = null;
}

function runAction(entry: MenuEntry): void {
  if (entry.action) {
    entry.action();
    activeMenu.value = '';
    activeSubmenu.value = null;
    return;
  }

  if (entry.panelId) {
    if (entry.createProject ?? false) {
      showProjectCreationPopup(entry);
    } else {
      createPanel(entry.panelId, entry.label);
    }

    activeMenu.value = '';
    activeSubmenu.value = null;
    return;
  }

  activeMenu.value = '';
  activeSubmenu.value = null;
}

function handleDocClick(e: MouseEvent): void {
  const root = rootRef.value;
  if (!root) return;
  const target = e.target as Node | null;
  if (!target || !root.contains(target)) {
    activeMenu.value = '';
    activeSubmenu.value = null;
  }
}

async function openFile() {
  await stateManager.openFile();

  activeMenu.value = '';
  activeSubmenu.value = null;
}

onMounted(() => {
  document.addEventListener('click', handleDocClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick);
});
</script>
