<!-- Das ist mein tatsächlicher Versuch, das FSM Submodule einzubinden.
 Per URL & iFrame hatte es bereits funktioniert, so wie hier nicht.
 Wanja meinte, wir wollen keinen iFrame dafür, ich krieg nur gerade ohne
 das React-JS-Submodule nicht mit unserem Vue Project zusammen.
 Ich glaub, ich werde aber gerade auch nur betriebsblind und sehe
 ganz offensichtliche Dinge nicht mehr, weil ich zu lange auf den Code gestarrt habe.
 Das Problem kann auch sehr wahrscheinlich im Submodule liegen,
 vermutlich schon in der AppRoot.jsx beispielsweise. Ich weiß auch nicht, ob
 so wie es ist nicht 2 einzelne package.json files ein Problem sind?
 -->
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
let reactRoot: Root | null = null

// handler for exports fsm -> state machine
const handleExport = (event: Event) => {
  const customEvent = event as CustomEvent<FsmExport>
  props.onExport(customEvent.detail)
}

// trying to import and render stuff
onMounted(async () => {
  if (!container.value) return
  await nextTick()

  const rootElement = container.value.querySelector('#root') as HTMLElement
  if (!rootElement) throw Error('Root element not found')

  const { createRoot } = await import('react-dom/client')

  // @ts-expect-error Dynamic React import
  const { AppRoot } = await import('@/fsm-engine/src/AppRoot.jsx')

  const key = '_reactRoot'
  const existingRoot = (rootElement as HTMLElement & Record<string, Root>)[key]

  // check if root already exists
  if (existingRoot) {
    reactRoot = existingRoot
  } else {
    const newRoot = createRoot(rootElement)
      ; (rootElement as HTMLElement & Record<string, Root>)[key] = newRoot
    reactRoot = newRoot
  }

  // rendering
  const { createElement } = await import('react')
  reactRoot!.render(createElement(AppRoot))

  window.addEventListener('fsm-export', handleExport)
  console.log('FSM Editor mounted!')
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
    <button @click="handleClear" class="absolute top-2 right-2 z-50 bg-red-500 text-white px-3 py-1 rounded">
      Clear FSM
    </button>
  </div>
</template>
