<template>
  <div class="flex items-center relative h-[calc(100vh-52px)] m-4 ml-12 text-on-surface">
    <!-- GitHub Logo-->
    <div class="absolute flex justify-end items-end w-full h-full">
      <a class="bg-surface-2 hover:bg-surface-3 p-0! mb-4 rounded-full shadow-2xl"
        href="https://github.com/wanjawischmeier/logic-easy">
        <img src="/GithubLogo.png" alt="GitHub Logo" class="w-12 aspect-auto invert">
      </a>
    </div>

    <div class="absolute rounded-xs bg-elevated p-10 pr-[15%] shadow-2xl">
      <p class="text-4xl mb-4 select-none text-primary-variant">Getting started</p>

      <div class="flex gap-20">
        <DirectoryStyleList :title="'New Project'" :entries="newProjectEntries" />
        <DirectoryStyleList :title="'Recently opened'" :entries="recentProjectEntries" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { addPanelWithPopup } from '@/utility/dockviewIntegration';
import { newMenu, type MenuEntry } from '@/components/dockRegistry';
import DirectoryStyleList from '@/components/parts/DirectoryStyleList.vue';
import type { ComputedRef } from 'vue';
import type { ListEntries, ListEntry } from '@/utility/types';

export default defineComponent({
  name: 'GettingStartedView',
  components: { DirectoryStyleList },
  setup() {
    function runAction(menuEntry: MenuEntry): void {
      if (!menuEntry.panelKey) return;
      addPanelWithPopup(menuEntry.panelKey, menuEntry.label);
    }

    const newProjectEntries: ComputedRef<ListEntry[]> = computed(() =>
      newMenu.value.map((m: MenuEntry) => ({
        label: m.label,
        disabled: !!m.disabled,
        action: () => {
          if (!m.panelKey) return;
          addPanelWithPopup(m.panelKey, m.label);
        },
      }))
    );

    const recentProjectEntries: ListEntries = [
      { label: 'My awesome project', action: () => alert('Just a dummy!') },
      { label: 'Another cool project', action: () => alert('Just a dummy!') },
      { label: 'This one sucked', action: () => alert('Just a dummy!') },
    ];

    return { newMenu, runAction, newProjectEntries, recentProjectEntries };
  },
});
</script>
