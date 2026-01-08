<template>
    <div class="relative" ref="dropdownContainer">
        <div class="bg-surface-2 rounded border border-surface-3 p-0.5">
            <button @click="toggleDropdown" :disabled="isCapturing"
                class="px-3 py-2 rounded-xs text-white hover:bg-primary transition-colors text-sm items-center gap-2"
                title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
        </div>

        <div v-if="showDropdown"
            class="absolute right-0 mt-1 p-0.5 bg-surface-2 rounded shadow-lg border border-surface-3 z-50">
            <button @click="handleScreenshot"
                class="w-full p-2 text-left text-sm rounded-xs hover:bg-surface-3 flex justify-between gap-4">
                <span>Screenshot</span>
                <span class="opacity-70">.png</span>
            </button>
            <button v-if="latexContent" @click="handleLatexDownload"
                class="w-full p-2 text-left text-sm rounded-xs hover:bg-surface-3 flex justify-between gap-4">
                <span>LaTeX</span>
                <span class="opacity-70">.tex</span>
            </button>
        </div>
    </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { onUnmounted, ref, toRef, watch, onMounted } from 'vue'
import { downloadRegistry } from '@/utility/downloadRegistry'
import { loadingService } from '@/utility/loadingService'
import { Toast } from '@/utility/toastService'

const SCREENSHOT_COLOR_BG = 'transparent'
const SCEENSHOT_PADDING = '1rem'

interface Props {
    targetRef: HTMLElement | null
    filename?: string
    latexContent?: string
}

const props = withDefaults(defineProps<Props>(), {
    filename: 'screenshot',
    targetRef: null,
    latexContent: undefined,
})

const showDropdown = ref(false)
const dropdownContainer = ref<HTMLElement | null>(null)
const targetElement = toRef(props, 'targetRef')
const latexContentRef = toRef(props, 'latexContent')
const isCapturing = ref(false)

// Generate unique ID for registration
const registrationId = `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Watch for targetElement to become available and register
watch(targetElement, (newVal) => {
    if (newVal) {
        downloadRegistry.register(registrationId, targetElement, props.filename, latexContentRef)
    }
}, { immediate: true })

const toggleDropdown = () => {
    showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
    showDropdown.value = false
}

const handleScreenshot = async () => {
    closeDropdown()
    await captureScreenshot()
}

const handleLatexDownload = () => {
    closeDropdown()
    downloadLatex()
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
    if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
        closeDropdown()
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    downloadRegistry.unregister(registrationId)
})

const downloadLatex = () => {
    if (!props.latexContent) {
        Toast.error('No LaTeX content available')
        return
    }

    try {
        const blob = new Blob([props.latexContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${props.filename}-${new Date().toISOString().slice(0, 10)}.tex`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    } catch (error) {
        console.error('LaTeX download failed:', error)
        Toast.error('Failed to download LaTeX file')
    }
}

const captureScreenshot = async () => {
    loadingService.show('Taking screenshot')
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait 100ms to prevent flicker

    if (!targetElement.value || isCapturing.value) {
        console.error('Screenshot element not found')
        Toast.error('Failed to take screenshot')
        loadingService.hide()
        return
    }

    isCapturing.value = true

    try {
        const blob = await downloadRegistry.captureScreenshot(
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
        } else {
            console.log('Failed to capture screenshot: empty blob')
            Toast.error('Failed to take screenshot')
        }
    } catch (error) {
        console.error('Screenshot failed:', error)
        Toast.error('Failed to take screenshot')
    } finally {
        isCapturing.value = false
        loadingService.hide()
    }
}
</script>
