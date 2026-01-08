<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div v-for="(items, menu) in menus" :key="menu" class="relative" @mouseenter="maybeSwitch(menu)">
      <button class="border border-transparent  hover:border-surface-3 hover:bg-surface-2"
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
import { ref, computed, defineComponent, h, type PropType } from 'vue';
import { newMenu, viewMenu, type MenuEntry } from '@/router/dockRegistry';
import { addPanel, addPanelWithPopup } from '@/utility/dockviewIntegration';
import { popupService } from '@/utility/popupService';
import CreditPopup from './popups/CreditPopup.vue';
import ManualPopup from './popups/ManualPopup.vue';
import { projectManager } from '@/projects/projectManager';
import { stateManager } from '@/states/stateManager';
import { exportTruthTableTOVHDLboolExpr, exportTruthTableTOVHDLcaseWhen } from '@/utility/VHDL/export.ts'

const hasCurrentProject = computed(() => projectManager.currentProjectInfo !== null);

const menus = computed<Record<string, MenuEntry[]>>(() => ({
  File: [
    {
      label: 'New',
      children: newMenu.value
    },
    {
      label: 'Open File',
      tooltip: 'Ctrl+O',
      action: openFile
    },
    {
      label: 'Save Project',
      tooltip: 'Ctrl+S',
      action: projectManager.downloadProject,
      disabled: !hasCurrentProject.value,
    },
    {
      label: 'Close Project',
      action: stateManager.closeCurrentProject,
      disabled: !hasCurrentProject.value,
    },
  ],
  View: viewMenu.value,
  Export: [
    { label: 'LogicCircuits', tooltip: '.lc' },
    { label: 'VHDL', tooltip: '.vhdl', children: [
        {label: 'Case-When', action: () => {  exportTruthTableTOVHDLcaseWhen(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided') }},
        {label: 'Boolean expressions', children : [
            {label: "DNF", action: () => { exportTruthTableTOVHDLboolExpr(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided') }},
            {label: "CNF", action: () => { exportTruthTableTOVHDLboolExpr(stateManager.state.truthTable, projectManager.getCurrentProject()?.name ?? 'no name provided', 'cnf' )}},
          ]},
      ]},
  ],
  Help: [
    { label: 'Manual', action: () => popupService.open({ component: ManualPopup }) },
    { label: 'About', action: () => popupService.open({ component: CreditPopup }) },
  ],
}));

const activeMenu = ref<string>('');
const activePath = ref<number[]>([]);
const rootRef = ref<HTMLElement | null>(null);

function toggleMenu(name: string): void {
  activeMenu.value = activeMenu.value === name ? '' : name;
  activePath.value = [];
}

function maybeSwitch(name: string): void {
  if (activeMenu.value && activeMenu.value !== name) {
    activeMenu.value = name;
    activePath.value = [];
  }
}

function showSubmenu(level: number, idx: number): void {
  const path = activePath.value.slice(0, level);
  path[level] = idx;
  activePath.value = path;
}

function hideSubmenu(level: number): void {
  activePath.value = activePath.value.slice(0, level);
}

function isOpen(level: number, idx: number): boolean {
  return activePath.value[level] === idx;
}

function runAction(entry: MenuEntry): void {
  if (entry.action) {
    entry.action();
    activeMenu.value = '';
    activePath.value = [];
    return;
  }

  if (entry.panelKey) {
    if (entry.withPopup ?? false) {
      addPanelWithPopup(entry.panelKey, entry.label);
    } else {
      addPanel(entry.panelKey, entry.label);
    }

    activeMenu.value = '';
    activePath.value = [];
    return;
  }

  activeMenu.value = '';
  activePath.value = [];
}

async function openFile() {
  await stateManager.openFile();

  activeMenu.value = '';
  activePath.value = [];
}

type MenuListProps = {
  items: MenuEntry[];
  level?: number;
};

const MenuList = defineComponent<MenuListProps>({
   name: 'MenuList',
   props: {
     items: { type: Array as PropType<MenuEntry[]>, required: true },
     level: { type: Number, default: 0 },
   },
   setup(props: MenuListProps) {
     const level = computed(() => props.level ?? 0);

     return () =>
       h('ul', { class: 'pr-1' }, props.items.map((entry, idx) =>
         h('li', { class: 'relative', key: idx }, [
           h('button', {
             class: 'w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm',
             disabled: (!entry.action && !entry.panelKey && !entry.children) || entry.disabled,
             onClick: entry.children ? undefined : () => runAction(entry),
             onMouseenter: entry.children ? () => showSubmenu(level.value, idx) : () => hideSubmenu(level.value),
             type: 'button',
           }, [
             h('span', entry.label),
             entry.tooltip ? h('span', { class: 'opacity-70' }, entry.tooltip) : null,
             entry.children ? h('span', { class: 'opacity-70' }, '›') : null,
           ]),
           entry.children && isOpen(level.value, idx)
             ? h('div', { class: 'absolute left-full top-0 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20' }, [
               h(MenuList, { items: entry.children, level: level.value + 1 })
             ])
             : null,
         ])
       ));
   }
 });
</script>
