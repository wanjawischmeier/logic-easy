<!--

# State Table Panel
*Panel wrapper for the state table component.*
The goal of this panel is to host the state table inside dockview with minimal panel-level logic.

# Responsibilities
- Provide panel layout/container.
- Mount `StateTable.vue`.

# What belongs here
- Dockview-facing panel composition.
- Basic visual container behavior and rendering information.
- optional in the future: General settings and functionality for both tables.
-> Keep panel code lightweight and integration-focused.

-->

<script setup lang="ts">
import StateTable from '@/components/StateTable.vue'
import LegendButton, { type LegendItem } from '@/components/parts/buttons/LegendButton.vue'
import { defineComponent } from 'vue'

const ArrowKeysIcon = defineComponent({
  template: `
    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-mono leading-none place-items-center">
      <span class="min-w-6 h-6 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">↑</span>
      <span class="min-w-6 h-6 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">←</span>
      <span class="min-w-6 h-6 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">↓</span>
      <span class="min-w-6 h-6 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">→</span>
    </div>
  `,
})

const SpaceKeyIcon = defineComponent({
  template: `
    <div class="min-w-14 h-5 px-2 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white text-[10px] font-mono leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">
      Space
    </div>
  `,
})

const legend: LegendItem[] = [
  {
    component: ArrowKeysIcon,
    label: 'Arrow keys',
    description: 'Move between editable transition cells in the table.',
  },
  {
    component: SpaceKeyIcon,
    label: 'Toggle bit value',
    description: 'Toggles the currently focused editable cell value.',
  },
]
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-auto">
    <div class="flex justify-end items-center h-10 mb-2 gap-2">
      <LegendButton :legend="legend" />
    </div>
    <div class="flex-1 overflow-auto mb-4">
      <StateTable />
    </div>
  </div>
</template>