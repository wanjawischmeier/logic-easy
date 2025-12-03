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
          <li v-for="entry in items" :key="entry.label">
            <button
              class="w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm"
              :disabled="!entry.action && !entry.panelKey" @click="runAction(entry)" type="button">
              <span>{{ entry.label }}</span>
              <span v-if="entry.shortcut" class="opacity-70">{{ entry.shortcut }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { dockRegistry } from '@/components/dockRegistry';

type MenuEntry = {
  label: string;
  action?: () => void;
  shortcut?: string;
  panelKey?: string;
};


const viewMenu = computed<MenuEntry[]>(() =>
  dockRegistry.map((e) => ({ label: e.label, panelKey: e.id }))
);

/* Base menus */
const menus: Record<string, MenuEntry[]> = {
  File: [
    { label: 'New File', shortcut: 'Ctrl+N' },
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
const rootRef = ref<HTMLElement | null>(null);

function toggleMenu(name: string): void {
  activeMenu.value = activeMenu.value === name ? '' : name;
}

function maybeSwitch(name: string): void {
  if (activeMenu.value && activeMenu.value !== name) {
    activeMenu.value = name;
  }
}

/* Minimal typed shape for the dockview API exposed on window */
type DockviewApiMinimal = {
  addPanel: (opts: {
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: unknown;
  }) => void;
};

function runAction(entry: MenuEntry): void {
  if (entry.action) {
    entry.action();
    activeMenu.value = '';
    return;
  }

  if (entry.panelKey) {
    const api = (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api;
    const sharedParams = (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams;
    if (!api) {
      console.warn('Dockview API not ready yet');
      activeMenu.value = '';
      return;
    }

    const id = `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      api.addPanel({
        id,
        component: entry.panelKey,
        title: entry.label,
        params: sharedParams ?? undefined,
      });
    } catch (err) {
      console.error('Failed to add panel', err);
    }
    activeMenu.value = '';
    return;
  }

  activeMenu.value = '';
}

function handleDocClick(e: MouseEvent): void {
  const root = rootRef.value;
  if (!root) return;
  const target = e.target as Node | null;
  if (!target || !root.contains(target)) {
    activeMenu.value = '';
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick);
});
</script>
