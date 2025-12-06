<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { logicCircuits } from '@/utility/logicCircuitsWrapper'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
const containerRef = ref<HTMLDivElement | null>(null)
let disposable: { dispose?: () => void } | null = null

// Keep a reference to the current iframe; update it when the wrapper swaps frames.
let preloadedIframe: HTMLIFrameElement | undefined

let iframeReadyHandler: EventListener | null = null

let resizeObserver: ResizeObserver | null = null
let pollInterval: number | null = null

function getGlobalIframe(): HTMLIFrameElement | undefined {
  return (window as Window & { __lc_preloaded_iframe?: HTMLIFrameElement }).__lc_preloaded_iframe
}

function updateIframePosition() {
  // always read current reference
  preloadedIframe = preloadedIframe || getGlobalIframe()
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
  preloadedIframe = preloadedIframe || getGlobalIframe()
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

  // Try to pick up the current global iframe, otherwise poll.
  preloadedIframe = getGlobalIframe()
  if (!preloadedIframe) {
    console.log('Preloaded iframe not yet available, waiting...')
    // Poll for iframe availability
    pollInterval = window.setInterval(() => {
      preloadedIframe = getGlobalIframe()
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

  // React to wrapper swaps (resetIFrame will dispatch 'lc-iframe-ready')
  const onIframeReady = (ev: Event) => {
    const ce = ev as CustomEvent<{ iframe?: HTMLIFrameElement }>
    // update local ref and re-run setup to ensure the new iframe is shown & positioned
    preloadedIframe = ce?.detail?.iframe ?? getGlobalIframe()
    console.log('LogicCircuitsTestingPanel: detected iframe swap')
    // tear down previous observers/listeners before re-setup
    resizeObserver?.disconnect()
    window.removeEventListener('scroll', updateIframePosition, true)
    window.removeEventListener('resize', updateIframePosition)
    setupIframe()
  }
  iframeReadyHandler = onIframeReady
  window.addEventListener('lc-iframe-ready', onIframeReady as EventListener)
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')

  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  // Hide iframe when panel closes
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.display = 'none'
  }

  resizeObserver?.disconnect()
  window.removeEventListener('scroll', updateIframePosition, true)
  window.removeEventListener('resize', updateIframePosition)
  // remove the lc-iframe-ready listener
  if (iframeReadyHandler) {
    window.removeEventListener('lc-iframe-ready', iframeReadyHandler)
    iframeReadyHandler = null
  }

  disposable?.dispose?.()
})

// Watch for panel visibility changes
watch(() => props.params.api.isVisible, (visible) => {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.display = visible ? 'block' : 'none'
  }
  if (visible) {
    updateIframePosition()
  }
})

async function loadFile() {
  const success = await logicCircuits.loadFile({
    content: '[0.8.12-patch1,0,0,1,1]\r\n[{2,115,194,0,,1n};\r\n{8,233,188,0,n,}]\r\n[{0o0};\r\n{1i0}]\r\n[{0,1}]\r\n[{68,-54,12,0,yay,0}]\r\n[]'
  })

  if (!success) {
    console.error('Failed to load file')
  }
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <button @click="loadFile" class="w-50 bg-surface-2 hover:bg-surface-3">Import
      BasicTest.lc</button>
    <div ref="containerRef" class="flex-1 z-0" style="position: relative;"></div>
  </div>
</template>

<style scoped></style>
