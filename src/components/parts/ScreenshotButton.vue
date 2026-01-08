<script setup lang="ts">
import { computed, nextTick, ref, toRef, type Ref } from 'vue'
import html2canvas from 'html2canvas-pro'

const SCREENSHOT_COLOR_BG = 'transparent'
const SCEENSHOT_PADDING = '1rem'

interface Props {
    targetRef: HTMLElement | null
    filename?: string
}

const props = withDefaults(defineProps<Props>(), {
    filename: 'screenshot',
    targetRef: null
})

const targetElement = toRef(props, 'targetRef')
const isCapturing = ref(false)

const captureScreenshot = async () => {
    if (!targetElement.value || isCapturing.value) {
        console.error('Screenshot element not found')
        return
    }

    isCapturing.value = true

    const element = targetElement.value as HTMLElement
    const computedStyle = window.getComputedStyle(element)

    // Save computed styles safely
    const originalOverflow = computedStyle.overflow
    const originalHeight = computedStyle.height
    const originalPadding = computedStyle.padding

    try {
        await nextTick() // Ensure DOM is fully rendered

        // Temporarily modify styles
        element.style.overflow = 'visible'
        element.style.height = 'auto'
        element.style.position = 'relative' // Ensure proper positioning
        element.style.padding = SCEENSHOT_PADDING // Add padding on all sides

        const canvas = await html2canvas(element, {
            backgroundColor: SCREENSHOT_COLOR_BG, // Dark theme background
            scale: window.devicePixelRatio || 2,
            useCORS: true,
            allowTaint: true,
            logging: false // Reduce console noise
        })

        // Download
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${props.filename}-${new Date().toISOString().slice(0, 10)}.png`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            }
        })

    } catch (error) {
        console.error('Screenshot failed:', error)
    } finally {
        // Always restore styles
        element.style.overflow = originalOverflow
        element.style.height = originalHeight
        element.style.padding = originalPadding
        element.style.position = ''
        isCapturing.value = false
    }
}
</script>

<template>
    <button @click="captureScreenshot" :disabled="isCapturing"
        class="px-3 py-1 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors text-sm flex items-center gap-2"
        title="Take screenshot">
        <svg v-if="!isCapturing" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    </button>
</template>

<style scoped></style>
