<template>
  <div ref="containerRef" class="w-full h-full" style="position: relative">
    <slot />
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps<{
  iframeKey: string
  src: string
  visible?: boolean
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let preloadedIframe: HTMLIFrameElement | undefined
let iframeReadyHandler: EventListener | null = null
let resizeObserver: ResizeObserver | null = null
let pollInterval: number | null = null

function getGlobalIframe(): HTMLIFrameElement | undefined {
  return (window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined })[
    props.iframeKey
  ]
}

function updateIframePosition() {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (!preloadedIframe || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const style = preloadedIframe.style

  style.position = 'fixed'
  style.left = `${rect.left}px`
  style.top = `${rect.top}px`
  style.width = `${rect.width}px`
  style.height = `${rect.height}px`
  style.border = 'none'
  style.zIndex = '1'
}

function setIframePointerEvents(value: 'auto' | 'none') {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.pointerEvents = value
  }
}

function onMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.dockview-splitter')) {
    setIframePointerEvents('none')
  }
}

function onMouseUp() {
  setIframePointerEvents('auto')
}

function setupIframe() {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (!preloadedIframe) return false

  preloadedIframe.style.display = 'block'
  updateIframePosition()

  resizeObserver = new ResizeObserver(() => updateIframePosition())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  window.addEventListener('scroll', updateIframePosition, true)
  window.addEventListener('resize', updateIframePosition)

  return true
}

function createIframe() {
  const w = window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined }

  if (w[props.iframeKey]) {
    console.log(`Iframe ${props.iframeKey} already exists`)
    return
  }

  const iframe = document.createElement('iframe')
  iframe.src = props.src
  iframe.style.cssText =
    'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none; display: none;'
  document.body.appendChild(iframe)

  w[props.iframeKey] = iframe

  iframe.addEventListener('load', () => {
    console.log(`Iframe ${props.iframeKey} loaded`)
    const evt = new CustomEvent(`${props.iframeKey}-ready`, { detail: { iframe } })
    window.dispatchEvent(evt)
  })
}

onMounted(() => {
  console.log(`IframePanel mounted for ${props.iframeKey}`)

  preloadedIframe = getGlobalIframe()

  if (!preloadedIframe) {
    console.log(`Creating iframe for ${props.iframeKey}`)
    createIframe()

    pollInterval = window.setInterval(() => {
      preloadedIframe = getGlobalIframe()
      if (preloadedIframe) {
        console.log(`Iframe ${props.iframeKey} now available`)
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

  const onIframeReady = (ev: Event) => {
    const ce = ev as CustomEvent<{ iframe?: HTMLIFrameElement }>
    preloadedIframe = ce?.detail?.iframe ?? getGlobalIframe()
    console.log(`IframePanel: detected iframe swap for ${props.iframeKey}`)

    resizeObserver?.disconnect()
    window.removeEventListener('scroll', updateIframePosition, true)
    window.removeEventListener('resize', updateIframePosition)
    setupIframe()
  }

  document.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)

  iframeReadyHandler = onIframeReady
  window.addEventListener(`${props.iframeKey}-ready`, onIframeReady as EventListener)
})

onBeforeUnmount(() => {
  console.log(`IframePanel unmounted for ${props.iframeKey}`)

  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.display = 'none'
  }

  resizeObserver?.disconnect()
  window.removeEventListener('scroll', updateIframePosition, true)
  window.removeEventListener('resize', updateIframePosition)

  document.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)

  if (iframeReadyHandler) {
    window.removeEventListener(`${props.iframeKey}-ready`, iframeReadyHandler)
    iframeReadyHandler = null
  }
})

watch(
  () => props.visible,
  (visible) => {
    preloadedIframe = preloadedIframe || getGlobalIframe()
    if (preloadedIframe) {
      preloadedIframe.style.display = visible ? 'block' : 'none'
    }
    if (visible) {
      updateIframePosition()
    }
  },
)

defineExpose({
  getIframe: () => getGlobalIframe(),
  updatePosition: updateIframePosition,
})
</script>
