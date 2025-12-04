<template>
  <div class="flex items-center relative h-[calc(100vh-52px)] m-4 ml-12 text-on-surface">
    <!-- GitHub Logo-->
    <div class="absolute flex justify-end items-end w-full h-full">
      <a class="bg-surface-2 hover:bg-surface-3 p-0! mb-4 rounded-full shadow-2xl"
        href="https://github.com/wanjawischmeier/logic-easy">
        <img src="/GithubLogo.png" alt="GitHub Logo" class="w-12 aspect-auto invert">
      </a>
    </div>

    <div class="absolute rounded-xs bg-elevated p-10 pr-[20%] shadow-2xl">
      <p class="text-4xl mb-8 select-none text-primary-variant">Getting started</p>

      <!-- grid-based terminal-style directory view -->
      <div class="relative mt-6">
        <!-- vertical stem spanning the whole list -->
        <div class="absolute left-5 top-0 bottom-5 w-px bg-primary-variant"></div>

        <!-- grid: narrow left column for branches, right column for items -->
        <div class="grid grid-cols-[38px_1fr] gap-x-2">
          <div v-for="(item, idx) in items" :key="idx" class="contents">
            <!-- left cell: branch marker aligned to row -->
            <div class="h-10 flex items-start">
              <div class="w-8 h-px bg-primary-variant ml-5 mt-5"></div>
            </div>

            <!-- right cell: actual item button aligned to same row height -->
            <div class="h-10 flex items-center">
              <button @click="runAction(item)" :disabled="!item.panelKey"
                class="flex items-center hover:text-secondary-variant underline-offset-4 hover:underline disabled:bg-transparent disabled:no-underline disabled:text-on-surface-disabled rounded-xs cursor-pointer disabled:cursor-default w-full text-left"
                :title="item.label">
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { addPanelWithPopup } from '@/utility/dockviewIntegration';

type PanelItem = {
  label: string;
  panelKey?: string;
};

const items: PanelItem[] = [
  {
    label: 'Truth Table',
    panelKey: 'truth-table',
  },
  {
    label: 'KV Diagram',
    panelKey: 'kv-diagram',
  },
  {
    label: 'State Table',
  },
  {
    label: 'Transition Table',
  },
  {
    label: 'State Machine',
  },
];

export default defineComponent({
  name: 'GettingStartedView',
  setup() {
    function runAction(item: PanelItem): void {
      if (!item.panelKey) return;
      addPanelWithPopup(item.panelKey, item.label);
    }

    return { items, runAction };
  },
});
</script>
