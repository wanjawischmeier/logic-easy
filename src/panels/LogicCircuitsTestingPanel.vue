<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { logicCircuits } from '@/utility/logicCircuitsWrapper'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
const containerRef = ref<HTMLDivElement | null>(null)
let disposable: { dispose?: () => void } | null = null

// Always use the single preloaded iframe
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preloadedIframe = (window as any).__lc_preloaded_iframe as HTMLIFrameElement | undefined

let resizeObserver: ResizeObserver | null = null
let pollInterval: number | null = null

function updateIframePosition() {
  if (!preloadedIframe || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  preloadedIframe.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: none;
    z-index: 1;
    pointer-events: auto;
  `
}

function setupIframe() {
  if (!preloadedIframe) return false

  // Show and position the iframe
  preloadedIframe.style.display = 'block'
  updateIframePosition()

  // Watch for container size/position changes
  resizeObserver = new ResizeObserver(() => updateIframePosition())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  // Also update on scroll (in case dockview moves)
  window.addEventListener('scroll', updateIframePosition, true)
  window.addEventListener('resize', updateIframePosition)

  return true
}

onMounted(() => {
  console.log('LogicCircuitsTestingPanel mounted')

  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preloadedIframe = (window as any).__lc_preloaded_iframe as HTMLIFrameElement | undefined

  if (!preloadedIframe) {
    console.log('Preloaded iframe not yet available, waiting...')
    // Poll for iframe availability
    pollInterval = window.setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preloadedIframe = (window as any).__lc_preloaded_iframe as HTMLIFrameElement | undefined
      if (preloadedIframe) {
        console.log('Preloaded iframe now available')
        if (pollInterval !== null) {
          clearInterval(pollInterval)
          pollInterval = null
        }
        setupIframe()
      }
    }, 100)
  } else {
    setupIframe()
  }
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')

  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  // Hide iframe when panel closes
  if (preloadedIframe) {
    preloadedIframe.style.display = 'none'
  }

  resizeObserver?.disconnect()
  window.removeEventListener('scroll', updateIframePosition, true)
  window.removeEventListener('resize', updateIframePosition)

  disposable?.dispose?.()
})

// Watch for panel visibility changes
watch(() => props.params.api.isVisible, (visible) => {
  if (preloadedIframe) {
    preloadedIframe.style.display = visible ? 'block' : 'none'
  }
  if (visible) {
    updateIframePosition()
  }
})

async function loadFile() {
  const success = await logicCircuits.loadFile({
    url: 'http://localhost:5173/logic-easy/Gesamtsystem.lc'
  })

  if (!success) {
    console.error('Failed to load file')
  }
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <button @click="loadFile" class="w-50 bg-surface-2 hover:bg-surface-3">Import
      Gesamtsystem.lc</button>
    <div ref="containerRef" class="flex-1" style="position: relative;"></div>
  </div>
</template>

<style scoped></style>
