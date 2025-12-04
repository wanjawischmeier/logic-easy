<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
const containerRef = ref<HTMLDivElement | null>(null)
let disposable: { dispose?: () => void } | null = null
const panelId = computed(() => props.params.api.id)

// Global registry for persistent iframes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalIframes = (window as any).__lc_iframes || ((window as any).__lc_iframes = new Map<string, HTMLIFrameElement>())

let myIframe: HTMLIFrameElement | null = null
let resizeObserver: ResizeObserver | null = null

function updateIframePosition() {
  if (!myIframe || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  myIframe.style.cssText = `
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

onMounted(() => {
  console.log('LogicCircuitsTestingPanel mounted', panelId.value)

  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  // Get or create iframe
  if (globalIframes.has(panelId.value)) {
    myIframe = globalIframes.get(panelId.value)!
    if (myIframe) {
      myIframe.style.display = 'block'
      console.log('Reusing iframe for', panelId.value)
    }
  } else {
    myIframe = document.createElement('iframe')
    myIframe.src = '/logic-easy/logic-circuits/index.html'
    document.body.appendChild(myIframe)
    globalIframes.set(panelId.value, myIframe)
    console.log('Created new iframe for', panelId.value)
  }

  // Position iframe over container
  updateIframePosition()

  // Watch for container size/position changes
  resizeObserver = new ResizeObserver(() => updateIframePosition())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  // Also update on scroll (in case dockview moves)
  window.addEventListener('scroll', updateIframePosition, true)
  window.addEventListener('resize', updateIframePosition)
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted', panelId.value)

  // Hide iframe instead of removing it
  if (myIframe) {
    myIframe.style.display = 'none'
  }

  resizeObserver?.disconnect()
  window.removeEventListener('scroll', updateIframePosition, true)
  window.removeEventListener('resize', updateIframePosition)

  disposable?.dispose?.()
})

// Watch for panel visibility changes
watch(() => props.params.api.isVisible, (visible) => {
  if (myIframe) {
    myIframe.style.display = visible ? 'block' : 'none'
  }
  if (visible) {
    updateIframePosition()
  }
})

async function loadFile() {
  const url = 'http://localhost:5173/logic-easy/Gesamtsystem.lc'
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status)
    const text = await resp.text()
      // make available in console
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (window as any).lcText = text
    console.log('Loaded file into window.lcText (length:', text.length, ')')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iframeWin = myIframe?.contentWindow as (Window & { LogicCircuits?: any }) | undefined
    if (iframeWin && iframeWin.LogicCircuits && typeof iframeWin.LogicCircuits.loadFile === 'function') {
      iframeWin.LogicCircuits.loadFile(text)
      console.log('Delivered file via direct iframe.LogicCircuits.loadFile')
      return
    }

    console.warn('Could not deliver file to iframe; file stored in window.lcText')
  } catch (err) {
    console.error('Error loading file:', err)
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
