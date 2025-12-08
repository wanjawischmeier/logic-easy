<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { FsmExport } from '@/utility/types'
import type { Root } from 'react-dom/client'

// define props, root and html element
const props = defineProps<{
  onExport: (data: FsmExport) => void
  onClear?: () => void
}>()
const container = ref<HTMLDivElement>()
let reactRoot: Root | null = null;

// handler for exports fsm -> state machine
const handleExport = (event: Event) => {
  const customEvent = event as CustomEvent<FsmExport>
  props.onExport(customEvent.detail)
}

// trying to import and render stuff
onMounted(async () => {
  if (!container.value) return
  await nextTick()

  const { createRoot } = await import('react-dom/client')
  const { default: Main } = await import('../../fsm-submodule/src/main.jsx')

  const rootElement = container.value.querySelector('#root') as HTMLElement
  if (!rootElement) throw new Error('Root element not found')

  const key = '_reactRoot'
  const existingRoot = (rootElement as HTMLElement & { [key]?: Root })[key]

  // check if root already exists
  if (existingRoot) {
    reactRoot = existingRoot
  } else {
    const newRoot = createRoot(rootElement)
    ;(rootElement as HTMLElement & { [key]?: Root })[key] = newRoot
    reactRoot = newRoot
  }
  // rendering
  reactRoot.render(Main as React.ReactNode)

  console.log('FSM Editor mounted')
  window.addEventListener('fsm-export', handleExport)
})

// unmounted -> stop
onUnmounted(() => {
  window.removeEventListener('fsm-export', handleExport)
  reactRoot?.unmount()
  reactRoot = null
  console.log('FSM Editor unmounted')
})

const handleClear = () => {
  props.onClear?.()
  window.dispatchEvent(new CustomEvent('fsm-clear'))
}
</script>

<template>
  <div class="h-full w-full relative overflow-hidden">
    <div ref="container" class="h-full w-full">
      <div id="root"></div>
    </div>
    <button
      @click="handleClear"
      class="absolute top-2 right-2 z-50 bg-red-500 text-white px-3 py-1 rounded"
    >
      Clear FSM
    </button>
  </div>
</template>
