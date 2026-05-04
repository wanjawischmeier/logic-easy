<template>
    <div class="relative" ref="dropdownContainer">
        <div class="group bg-surface-2 rounded border border-surface-3 hover:border-primary transition-colors p-0.5">
            <button @click.stop="handleButtonClick"
                class="px-2.5 py-1.5 rounded-xs text-white group-hover:bg-primary transition-colors text-sm items-center gap-2"
                :class="showDropdown ? 'bg-primary' : ''" :title="title" :disabled="disabled">
                <slot name="icon" />
            </button>
        </div>

        <div v-if="showDropdown" @click.stop
            class="absolute right-0 mt-2 p-2 bg-surface-2 rounded shadow-lg border border-surface-3 z-50">
            <slot name="content" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { dropdownService } from '@/utility/dropdownService'

interface Props {
    title: string
    disabled?: boolean
}

const props = defineProps<Props>()

const showDropdown = ref(false)
const dropdownContainer = ref<HTMLElement | null>(null)
let blurCheckTimeout: number | null = null

const toggleDropdown = () => {
    if (showDropdown.value) {
        // Closing
        dropdownService.close()
    } else {
        // Opening
        showDropdown.value = true
        dropdownService.open(() => {
            showDropdown.value = false
        })
    }
}

const handleButtonClick = () => {
    toggleDropdown()
}

const closeDropdown = () => {
    showDropdown.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
    if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
        dropdownService.close()
    }
}

const handleWindowBlur = () => {
    if (!showDropdown.value) return

    if (blurCheckTimeout !== null) {
        window.clearTimeout(blurCheckTimeout)
    }

    // Defer until focus state updates so activeElement can reflect iframe focus.
    blurCheckTimeout = window.setTimeout(() => {
        blurCheckTimeout = null
        if (document.activeElement instanceof HTMLIFrameElement) {
            dropdownService.close()
        }
    }, 0)
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('blur', handleWindowBlur)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    window.removeEventListener('blur', handleWindowBlur)
    if (blurCheckTimeout !== null) {
        window.clearTimeout(blurCheckTimeout)
        blurCheckTimeout = null
    }
})

// Expose for use by child components if needed
defineExpose({
    toggleDropdown,
    closeDropdown,
    showDropdown,
    dropdownContainer,
})
</script>

<style scoped></style>
