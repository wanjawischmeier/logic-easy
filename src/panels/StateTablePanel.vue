<script setup lang="ts">
import { ref } from 'vue'
import StateTable from '@/components/StateTable.vue'

const stateTableData = ref([])

console.log('StateTablePanel mounted')
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold">State Table</div>
    <div class="flex-1 overflow-auto">
      <StateTable :data="stateTableData" />
    </div>
  </div>
</template>
