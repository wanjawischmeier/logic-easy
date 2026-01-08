<template>
    <button @click="captureScreenshot" :disabled="isCapturing"
        class="px-3 py-1 bg-surface-3 hover:bg-primary disabled:bg-surface-2 disabled:cursor-not-allowed text-white rounded transition-colors text-sm flex items-center gap-2"
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

<script setup lang="ts">
import { onUnmounted, ref, toRef, watch } from 'vue'
import { screenshotRegistry } from '@/utility/screenshotRegistry'

const SCREENSHOT_COLOR_BG = 'transparent'
const SCEENSHOT_PADDING = '1rem'

interface Props {
    targetRef: HTMLElement | null
    filename?: string
}

const props = withDefaults(defineProps<Props>(), {
    filename: 'screenshot',
    targetRef: null,
    registerForBulkExport: false
})

const targetElement = toRef(props, 'targetRef')
const isCapturing = ref(false)

// Generate unique ID for registration
const registrationId = `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Watch for targetElement to become available and register
watch(targetElement, (newVal) => {
    if (newVal) {
        screenshotRegistry.register(registrationId, targetElement, props.filename)
    }
}, { immediate: true })

onUnmounted(() => {
    screenshotRegistry.unregister(registrationId)
})

const captureScreenshot = async () => {
    if (!targetElement.value || isCapturing.value) {
        console.error('Screenshot element not found')
        return
    }

    isCapturing.value = true

    try {
        const blob = await screenshotRegistry.captureScreenshot(
            targetElement.value,
            SCREENSHOT_COLOR_BG,
            SCEENSHOT_PADDING
        )

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
    } catch (error) {
        console.error('Screenshot failed:', error)
    } finally {
        isCapturing.value = false
    }
}
</script>
