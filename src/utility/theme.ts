export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'logic-easy-theme'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return 'dark'
}

export function applyTheme(theme: ThemeMode): ThemeMode {
  const normalizedTheme = theme === 'light' ? 'light' : 'dark'
  const root = document.documentElement

  root.classList.toggle('dark', normalizedTheme === 'dark')
  root.classList.toggle('light', normalizedTheme === 'light')
  root.dataset.theme = normalizedTheme
  root.style.colorScheme = normalizedTheme
  window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme)

  return normalizedTheme
}
