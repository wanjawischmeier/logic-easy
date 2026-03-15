<template>
    <div class="flex flex-col h-screen bg-surface-1 text-on-surface">
        <!-- Header -->
        <div class="h-[39px]">
            <header class="h-full flex items-center px-1">
                <a href="/logic-easy/" class="mx-2">
                    <div class="flex gap-2 items-center">
                        <img src="/logo/le_128.png" alt="logo" class="h-6">
                        <p class="font-medium">LogicEasy</p>
                    </div>
                </a>
            </header>
        </div>

        <div class="h-px bg-surface-2"></div>

        <!-- Content -->
        <div class="flex flex-col flex-1 items-center justify-start px-6 py-8 overflow-y-auto gap-4">
            <div class="max-w-md text-center mt-4">
                <!-- Icon -->
                <div class="mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                        class="w-16 h-16 mx-auto fill-primary-variant opacity-75">
                        <path
                            d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14l4 4V5c0-1.1-.9-2-2-2zm-2 12h-8v2h8v-2zm0-3h-8v2h8V12zm0-3H4V9h14v-2z" />
                    </svg>
                </div>

                <!-- Title -->
                <h1 class="text-2xl font-bold mb-4">Screen Too Small</h1>

                <!-- Message -->
                <p class="text-lg mb-4">
                    LogicEasy is designed for larger screens. Your current screen resolution is not
                    supported. Large parts of the user interface will likely not be usable.
                </p>

                <!-- Suggestion -->
                <div class="bg-surface-2 bg-opacity-10 rounded-lg p-4 mb-4">
                    <p class="text-sm">
                        You can try <strong>zooming</strong> out your browser to fit the content on your screen. You can
                        use
                        <code>Ctrl + Minus</code> (<code>Cmd + Minus</code> on Mac)
                        to zoom out.
                    </p>
                </div>

                <!-- Requirements -->
                <div class="bg-surface-2 rounded-lg p-4 mb-6">
                    <p class="text-sm mb-2">
                        <strong>Recommended Resolution:</strong>
                    </p>
                    <p class="text-lg font-semibold text-primary">
                        {{ minWidth }} × {{ minHeight }} pixels
                    </p>
                    <p class="text-sm mt-2">
                        <strong>Current Resolution:</strong>
                    </p>
                    <p class="text-base">
                        {{ currentWidth }} × {{ currentHeight }} pixels
                    </p>
                </div>
            </div>
        </div>

        <!-- Continue Anyway Button -->
        <div class="shrink-0 flex justify-center px-6 py-8 border-t border-surface-2">
            <button @click="continueAnyway"
                class="px-3 py-1.5 text-sm rounded bg-elevated text-on-surface-disabled hover:bg-surface-2 transition-colors border-2 border-transparent hover:text-white hover:border-surface-3"
                title="Not recommended - the UI will likely be unusable">
                Continue Anyway
            </button>
            <p class="text-xs text-gray-500 ml-4 flex items-center">
                ⚠️ Not recommended
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { DEFAULT_SCREEN_CONFIG } from '@/utility/useScreenSize'

const minWidth = DEFAULT_SCREEN_CONFIG.minWidth
const minHeight = DEFAULT_SCREEN_CONFIG.minHeight

const currentWidth = ref(window.innerWidth)
const currentHeight = ref(window.innerHeight)

const emit = defineEmits<{
    continue: []
}>()

const handleResize = () => {
    currentWidth.value = window.innerWidth
    currentHeight.value = window.innerHeight
}

const continueAnyway = () => {
    // Store the current resolution to localStorage to bypass warning on reload
    localStorage.setItem('screenCheckBypass', JSON.stringify({
        width: window.innerWidth,
        height: window.innerHeight,
    }))
    emit('continue')
}

onMounted(() => {
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
})
</script>
