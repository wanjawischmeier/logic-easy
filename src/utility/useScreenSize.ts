import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

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
    const forceShowApp = ref(false)

    const handleResize = () => {
        width.value = window.innerWidth
        height.value = window.innerHeight
    }

    const isBelowMinimum = computed(() => {
        return width.value < config.minWidth || height.value < config.minHeight
    })

    // Check localStorage for stored bypass resolution on mount
    const checkStoredBypass = () => {
        const storedBypass = localStorage.getItem('screenCheckBypass')
        if (storedBypass) {
            try {
                const { width: storedWidth, height: storedHeight } = JSON.parse(storedBypass)
                // If current resolution matches stored bypass, auto-continue
                if (width.value === storedWidth && height.value === storedHeight) {
                    forceShowApp.value = true
                }
            } catch (e) {
                console.error('Failed to parse stored screen check bypass:', e)
            }
        }
    }

    // Clear bypass cache if resolution changes
    watch([width, height], () => {
        const storedBypass = localStorage.getItem('screenCheckBypass')
        if (storedBypass) {
            try {
                const { width: storedWidth, height: storedHeight } = JSON.parse(storedBypass)
                // If resolution has changed, clear the bypass
                if (width.value !== storedWidth || height.value !== storedHeight) {
                    localStorage.removeItem('screenCheckBypass')
                    forceShowApp.value = false
                }
            } catch (e) {
                console.error('Failed to parse stored screen check bypass:', e)
            }
        }
    })

    onMounted(() => {
        window.addEventListener('resize', handleResize)
        // Trigger initial check
        handleResize()
        checkStoredBypass()
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
        forceShowApp,
    }
}
