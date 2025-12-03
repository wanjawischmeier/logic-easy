<template>
  <div class="flex items-center relative h-[calc(100vh-52px)] m-4 ml-12 text-on-surface">
    <div class="absolute rounded-xs bg-elevated p-10 pr-[20%]">
      <p class="text-4xl mb-12 select-none text-primary-variant">Getting started</p>

      <!-- items row -->
      <div class="flex flex-col gap-4 mt-6">
        <button v-for="(item, idx) in items" :key="idx" @click="runAction(item)" :disabled="!item.panelKey"
          class="flex gap-2 p-2 hover:text-secondary-variant hover:underline disabled:bg-transparent disabled:no-underline disabled:text-on-surface-disabled rounded-xs cursor-pointer disabled:cursor-default"
          :title="item.label">
          <img :src="item.icon" alt="" class="w-6 aspect-square object-contain" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { addPanelWithPopup } from '@/utility/dockviewIntegration';

type PanelItem = {
  icon: string;
  label: string;
  panelKey?: string;
};

const items: PanelItem[] = [
  {
    icon: '/logic-easy/icons/table.png',
    label: 'Truth Table',
    panelKey: 'truth-table',
  },
  {
    icon: '/logic-easy/icons/table.png',
    label: 'KV Diagram',
    panelKey: 'kv-diagram',
  },
  {
    icon: '/logic-easy/icons/table.png',
    label: 'State Table',
  },
  {
    icon: '/logic-easy/icons/table.png',
    label: 'Transition Table',
  },
  {
    icon: '/logic-easy/icons/table.png',
    label: 'State Table',
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
