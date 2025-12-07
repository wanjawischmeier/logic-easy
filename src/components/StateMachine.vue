<script setup lang="ts">
import { App as FsmApp } from '../../fsm-submodule/src/app.jsx'
import type { FsmExport } from '@/utility/types'
import { ref, onMounted, onBeforeUnmount } from 'vue'

// define elements for html
const fsmData = ref<FsmExport>({
  states: [],
  transitions: [],
})
const fsmContainer = ref<HTMLDivElement>()

// communication bridge for export / import of data
const fsmBridge = {
  // fsm export trigger -> start data import
  sendToStateMachine: () => {
    // fsm engine -> state machine
    console.log('StateMachine: sendToStateMachine (TODO)')
  },
  sendToEngine: (data: FsmExport) => {
    // state machine -> fsm engine
    console.log('StateMachine: sendToEngine (TODO)', data)
  },
  sendClearFsmEngine: () => {
    // clear fsm engine
    console.log('StateMachine: sendClearFsmEngine (TODO)')
  },
}
// export handler
function handleFsmExport(event: Event) {
  const fsmExportEvent = event as CustomEvent<FsmExport>
    fsmData.value = fsmExportEvent.detail
    console.log('StateMachine imported data from FSM', fsmData.value)
}

onMounted(() => {
  window.addEventListener('fsm-export', handleFsmExport)
})

onBeforeUnmount(() => {
  window.removeEventListener('fsm-export', handleFsmExport)
})

</script>

<template>
  <div class="state-machine h-full w-full flex flex-col overflow-hidden">
    <div ref="fsmContainer" class="flex-1 min-h-0 w-full">
      <!-- fsm submodule (app.jsx) directly integrated -->
      <FsmApp />
    </div>
    <!-- small overview of data to help with debugging -->
    <div class="debug-panel p-3 bg-gray-800 border-t border-gray-600 text-sm">
      <div class="flex justify-between items-center">
        <span>
          Zustände: {{ fsmData.states.length}} | Übergänge:
          {{ fsmData.transitions.length}}</span
        >
        <div class="space-x-2">
          <button
            @click="fsmBridge.sendClearFsmEngine()"
            class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-blue-950"
          >
            Clear Data
          </button>
        </div>
      </div>
      <div v-if="!fsmData" class="text-gray-400 mt-1">Wait ...</div>
    </div>
  </div>
</template>
