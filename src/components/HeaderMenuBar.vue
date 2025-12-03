<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div v-for="(items, menu) in menus" :key="menu" class="relative" @mouseenter="maybeSwitch(menu)">
      <button class="hover:bg-surface-2" @click.stop="toggleMenu(menu)" :aria-expanded="activeMenu === menu"
        :aria-haspopup="true" type="button">
        {{ menu }}
      </button>

      <div v-if="activeMenu === menu"
        class="absolute left-0 mt-1 w-48 bg-surface-2 border border-surface-3 rounded z-20">
        <ul class="pr-1">
          <li v-for="(entry, idx) in items" :key="idx" class="relative">
            <button
              class="w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm"
              :disabled="!entry.action && !entry.panelKey && !entry.children"
              @click="entry.children ? null : runAction(entry)"
              @mouseenter="entry.children ? showSubmenu(idx) : hideSubmenu()" type="button">
              <span>{{ entry.label }}</span>
              <span v-if="entry.shortcut" class="opacity-70">{{ entry.shortcut }}</span>
              <span v-if="entry.children" class="opacity-70">›</span>
            </button>

            <!-- Submenu -->
            <div v-if="entry.children && activeSubmenu === idx"
              class="absolute left-full top-0 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20">
              <ul class="pr-1">
                <li v-for="(child, childIdx) in entry.children" :key="childIdx">
                  <button
                    class="w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm"
                    :disabled="!child.action && !child.panelKey" @click="runAction(child)" type="button">
                    <span>{{ child.label }}</span>
                    <span v-if="child.shortcut" class="opacity-70">{{ child.shortcut }}</span>
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
import { dockRegistry } from '@/components/dockRegistry';
import { addPanel } from '@/utility/dockviewIntegration';

type MenuEntry = {
  label: string;
  action?: () => void;
  shortcut?: string;
  panelKey?: string;
  children?: MenuEntry[];
};

const viewMenu = computed<MenuEntry[]>(() =>
  dockRegistry.map((e) => ({ label: e.label, panelKey: e.id }))
);

const newMenu = computed<MenuEntry[]>(() =>
  dockRegistry.map((e) => ({ label: e.label, panelKey: e.id }))
);

const menus: Record<string, MenuEntry[]> = {
  File: [
    {
      label: 'New',
      children: newMenu.value
    },
    { label: 'Open File...', shortcut: 'Ctrl+O' },
    { label: 'Save', shortcut: 'Ctrl+S' },
  ],
  Edit: [
    { label: 'Undo', shortcut: 'Ctrl+Z' },
    { label: 'Redo', shortcut: 'Ctrl+Y' },
    { label: 'Cut', shortcut: 'Ctrl+X' },
    { label: 'Copy', shortcut: 'Ctrl+C' },
    { label: 'Paste', shortcut: 'Ctrl+V' },
  ],
  View: viewMenu.value,
  Help: [
    { label: 'GitHub', action: () => window.open('https://github.com/wanjawischmeier/logic-easy', '_blank') },
    { label: 'About' },
  ],
};

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

  if (entry.panelKey) {
    addPanel(entry.panelKey, entry.label);
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

onMounted(() => {
  document.addEventListener('click', handleDocClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick);
});
</script>
