<template>
    <div class="relative" ref="dropdownContainer">
        <div class="group bg-surface-2 rounded border border-surface-3 hover:border-primary transition-colors p-0.5">
            <button @click="toggleDropdown"
                class="px-2.5 py-1.5 rounded-xs text-white group-hover:bg-primary transition-colors text-sm items-center gap-2"
                :class="showDropdown ? 'bg-primary' : ''" title="Legend">
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 24 24"
                    fill="white">
                    <path
                        d="M 12 2 C 6.4889971 2 2 6.4889971 2 12 C 2 17.511003 6.4889971 22 12 22 C 17.511003 22 22 17.511003 22 12 C 22 6.4889971 17.511003 2 12 2 z M 12 4 C 16.430123 4 20 7.5698774 20 12 C 20 16.430123 16.430123 20 12 20 C 7.5698774 20 4 16.430123 4 12 C 4 7.5698774 7.5698774 4 12 4 z M 11 7 L 11 9 L 13 9 L 13 7 L 11 7 z M 11 11 L 11 17 L 13 17 L 13 11 L 11 11 z">
                    </path>
                </svg>
            </button>
        </div>

        <div v-if="showDropdown"
            class="absolute right-0 mt-2 px-2 py-4 bg-surface-2 rounded shadow-lg border border-surface-3 z-50 min-w-80">
            <div class="flex flex-col gap-4">
                <div v-for="item in legend" :key="item.symbol" class="flex items-center gap-3">
                    <div class="text-center text-2xl font-semibold min-w-8 flex items-center justify-center">
                        <vue-latex v-if="item.symbolType === 'latex'" :fontsize="16" :expression="item.symbol"
                            display-mode />
                        <div v-else-if="item.symbolType === 'bg-color'" class="w-6 h-6 rounded border border-surface-3"
                            :class="item.symbol"></div>
                        <div v-else-if="item.symbolType === 'tailwind'" class="w-6 h-6" :class="item.symbol"></div>
                        <component v-else-if="item.component" :is="item.component" class="w-6 h-6" />
                        <span v-else>{{ item.symbol }}</span>
                    </div>
                    <div class="flex-1 flex flex-col gap-0.5">
                        <div class="text-sm font-medium">{{ item.label }}</div>
                        <div v-if="item.description" class="text-xs opacity-70">{{ item.description }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

export type SymbolType = 'text' | 'latex' | 'bg-color' | 'tailwind'

export interface LegendItem {
    symbol?: string
    label: string
    description?: string
    symbolType?: SymbolType
    component?: any
}

interface Props {
    legend?: LegendItem[]
}

const props = defineProps<Props>()

const showDropdown = ref(false)
const dropdownContainer = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
    showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
    showDropdown.value = false
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
})
</script>

<style scoped></style>
