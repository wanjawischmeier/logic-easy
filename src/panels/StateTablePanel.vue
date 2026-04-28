<script setup lang="ts">
import { ref } from 'vue'
import StatesTable from '@/components/StatesTable.vue'
import TransitionsTable from '@/components/TransitionsTable.vue'
import LegendButton from '@/components/parts/buttons/LegendButton.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import type { IDockviewPanelProps } from 'dockview-vue'

const props = defineProps<Partial<IDockviewPanelProps>>()
const screenshotRef = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-auto bg-gray-900">
    <div class="flex justify-end items-center h-10 mb-2 gap-2">
      <LegendButton />
      <DownloadButton :target-ref="screenshotRef" :panel-id="props.params?.api?.id" filename="fsm-table" />
    </div>

    <div ref="screenshotRef" class="flex-1 overflow-auto space-y-8 px-1 pb-10">
      <StatesTable />
      <div class="h-px bg-gray-800 w-full" />
      <TransitionsTable />
    </div>
  </div>
</template>

<style scoped>
table { border-collapse: collapse; }
td { min-width: 20px; }
</style>
