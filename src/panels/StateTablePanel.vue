<script setup lang="ts">
/*
 * panel wrapper for rendering the automaton state table component
 */

import StateTable from '@/components/StateTable.vue'
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="flex-1 overflow-auto mb-4">
      <StateTable />
    </div>
  </div>
</template>
