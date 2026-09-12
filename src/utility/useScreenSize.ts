import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export interface ScreenSizeConfig {
  minWidth: number
  minHeight: number
}

export const DEFAULT_SCREEN_CONFIG: ScreenSizeConfig = {
  minWidth: 800,
  minHeight: 600,
}

const SCREEN_CHECK_BYPASS_KEY = 'screenCheckBypass'
const SCREEN_CHECK_BYPASS_MS = 60 * 60 * 1000

interface ScreenCheckBypass {
  expiresAt: number
  width: number
  height: number
}

const parseBypass = (): ScreenCheckBypass | null => {
  const stored = localStorage.getItem(SCREEN_CHECK_BYPASS_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored) as Partial<ScreenCheckBypass>
    if (typeof parsed.expiresAt !== 'number') return null

    return {
      expiresAt: parsed.expiresAt,
      width: parsed.width ?? window.innerWidth,
      height: parsed.height ?? window.innerHeight,
    }
  } catch (error) {
    console.error('Failed to parse stored screen check bypass:', error)
    localStorage.removeItem(SCREEN_CHECK_BYPASS_KEY)
    return null
  }
}

const isBypassActive = () => {
  const storedBypass = parseBypass()
  if (!storedBypass) return false

  if (Date.now() > storedBypass.expiresAt) {
    localStorage.removeItem(SCREEN_CHECK_BYPASS_KEY)
    return false
  }

  return true
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

  const checkStoredBypass = () => {
    forceShowApp.value = isBypassActive()
  }

  watch([width, height], () => {
    if (isBelowMinimum.value) {
      checkStoredBypass()
      return
    }

    forceShowApp.value = false
  })

  onMounted(() => {
    window.addEventListener('resize', handleResize)
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
    bypassDurationMs: SCREEN_CHECK_BYPASS_MS,
  }
}
