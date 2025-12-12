<script setup lang="ts">
import StateTable from '@/components/StateTable.vue'
import { fsmListener, fsmData } from '@/utility/FsmExport.ts'

console.log('StateTablePanel mounted')
fsmListener()
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold"></div>
    <div class="text-sm text-gray-400 mb-2 p-2 bg-gray-900 rounded">
      {{ fsmData?.states?.length || 0 }} States |
      {{ fsmData?.transitions?.length || 0 }} Transitions
    </div>
    <div class="flex-1 overflow-auto mb-4">
      <StateTable :data="fsmData?.states ?? []" />
    </div>
    <div v-if="fsmData?.transitions?.length" class="text-xs text-gray-500">
      {{ fsmData.transitions.length }} Transitions (klick für Details)
    </div>
  </div>
</template>
