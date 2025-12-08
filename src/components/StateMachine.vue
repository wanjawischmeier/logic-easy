<script setup lang="ts">
import FsmSubmoduleWrapper from '@/utility/FsmSubmoduleWrapper.vue'
import type { FsmExport } from '@/utility/types'
import { ref } from 'vue'

// define elements for html
const fsmData = ref<FsmExport>({
  states: [],
  transitions: [],
})

// handle data import from fsm to statemachine
const handleFsmExport = (data: FsmExport) => {
  fsmData.value = data
  console.log('FSM Data imported:', fsmData.value)
}

// handle data clearing
const handleClear = () => {
  fsmData.value = { states: [], transitions: [] }
  console.log('FSM Data cleared')
}
</script>

<template>
  <div class="state-machine h-full w-full flex flex-col overflow-hidden">
    <FsmSubmoduleWrapper
    :on-export="handleFsmExport"
    :on-clear="handleClear"
    />
  </div>
</template>
