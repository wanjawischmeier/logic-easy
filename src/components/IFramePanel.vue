<template>
    <div ref="containerRef" class="w-full h-full" style="position: relative;">
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
    return (window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined })[props.iframeKey]
}

function updateIframePosition() {
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
    iframe.style.cssText = 'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none; display: none;'
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

    if (iframeReadyHandler) {
        window.removeEventListener(`${props.iframeKey}-ready`, iframeReadyHandler)
        iframeReadyHandler = null
    }
})

watch(() => props.visible, (visible) => {
    preloadedIframe = preloadedIframe || getGlobalIframe()
    if (preloadedIframe) {
        preloadedIframe.style.display = visible ? 'block' : 'none'
    }
    if (visible) {
        updateIframePosition()
    }
})

defineExpose({
    getIframe: () => getGlobalIframe(),
    updatePosition: updateIframePosition
})
</script>
