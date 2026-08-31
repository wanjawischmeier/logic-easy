<template>
  <button
    type="button"
    class="flex h-8 w-8 items-center justify-center rounded border border-transparent text-sm text-on-surface transition-colors hover:border-primary hover:bg-surface-3"
    :title="themeLabel"
    @click="toggleTheme"
    aria-label="Toggle light and dark theme"
  >
    <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { applyTheme, getStoredTheme, type ThemeMode } from '@/utility/theme'

const theme = ref<ThemeMode>(getStoredTheme())
const isDark = computed(() => theme.value === 'dark')
const themeLabel = computed(() => (isDark.value ? 'Switch to light mode' : 'Switch to dark mode'))

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(theme.value)
}

onMounted(() => {
  theme.value = getStoredTheme()
  applyTheme(theme.value)
})
</script>
