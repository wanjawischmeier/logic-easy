import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface ScreenSizeConfig {
    minWidth: number
    minHeight: number
}

export const DEFAULT_SCREEN_CONFIG: ScreenSizeConfig = {
    minWidth: 800,
    minHeight: 600,
}

/**
 * Composable to track screen size and check if it meets minimum requirements
 */
export function useScreenSize(config: ScreenSizeConfig = DEFAULT_SCREEN_CONFIG) {
    const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
    const height = ref(typeof window !== 'undefined' ? window.innerHeight : 0)

    const handleResize = () => {
        width.value = window.innerWidth
        height.value = window.innerHeight
    }

    const isBelowMinimum = computed(() => {
        return width.value < config.minWidth || height.value < config.minHeight
    })

    onMounted(() => {
        window.addEventListener('resize', handleResize)
        // Trigger initial check
        handleResize()
    })

    onUnmounted(() => {
        window.removeEventListener('resize', handleResize)
    })

    return {
        width,
        height,
        minWidth: config.minWidth,
        minHeight: config.minHeight,
        isBelowMinimum,
    }
}
