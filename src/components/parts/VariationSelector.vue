<template>
  <div class="relative shrink-0" ref="dropdownContainer">
    <div
      class="flex group bg-surface-2 rounded border border-surface-3 hover:border-primary transition-colors p-0.5"
    >
      <span
        v-if="variableName"
        class="px-2.5 h-8 whitespace-nowrap leading-none text-secondary-variant inline-flex items-center justify-center"
      >
        <vue-latex :expression="variableName" :fontsize="14" display-mode />
      </span>
      <button
        type="button"
        @click.stop="toggleDropdown"
        :disabled="!hasMultipleFormulas"
        :aria-expanded="showDropdown"
        :aria-label="label"
        class="px-2 py-1.5 rounded-xs text-white group-hover:bg-primary transition-colors items-center gap-2 flex disabled:cursor-default disabled:opacity-70 disabled:group-hover:bg-transparent"
      >
        <span class="min-w-4 text-center">{{ selectedIndex + 1 }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-100"
          :class="showDropdown ? 'rotate-180' : ''"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>

    <div
      v-if="showDropdown"
      :class="
        dropdownPositionClass +
        ' bg-surface-2 rounded shadow-lg border border-surface-3 z-50 max-h-64 overflow-y-auto'
      "
    >
      <button
        v-for="(_, index) in formulas"
        :key="index"
        type="button"
        @click.stop="selectIndex(index)"
        class="px-4 py-2 m-0.5 text-left text-sm rounded-xs hover:bg-surface-3 flex"
        :class="index === selectedIndex ? 'bg-surface-3' : ''"
      >
        <span>{{ index + 1 }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { dropdownService } from '@/utility/dropdownService'

const props = withDefaults(
  defineProps<{
    formulas: string[]
    selectedIndex?: number
    label?: string
    placement?: 'top' | 'bottom'
    variableName?: string
  }>(),
  { selectedIndex: 0, label: 'Select formula', placement: 'top' },
)

const emit = defineEmits<{
  (e: 'update:selectedIndex', value: number): void
}>()

const dropdownContainer = ref<HTMLElement | null>(null)
const showDropdown = ref(false)
const localSelectedIndex = ref(props.selectedIndex ?? 0)
let blurCheckTimeout: number | null = null

watch(
  () => props.selectedIndex,
  (v) => (localSelectedIndex.value = v ?? 0),
)

watch(localSelectedIndex, (v) => emit('update:selectedIndex', v))

const hasMultipleFormulas = computed(() => props.formulas.length > 1)

const dropdownPositionClass = computed(() =>
  props.placement === 'bottom'
    ? 'absolute right-0 top-full mt-2'
    : 'absolute right-0 bottom-full mb-2',
)

const toggleDropdown = () => {
  if (showDropdown.value) {
    dropdownService.close()
    return
  }

  showDropdown.value = true
  dropdownService.open(() => {
    showDropdown.value = false
  })
}

const selectIndex = (index: number) => {
  localSelectedIndex.value = index
  dropdownService.close()
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
    dropdownService.close()
  }
}

// Blur listener to close on click over iframe
const handleWindowBlur = () => {
  if (!showDropdown.value) return
  if (blurCheckTimeout !== null) window.clearTimeout(blurCheckTimeout)
  blurCheckTimeout = window.setTimeout(() => {
    blurCheckTimeout = null
    if (document.activeElement instanceof HTMLIFrameElement) dropdownService.close()
  }, 0)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('blur', handleWindowBlur)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('blur', handleWindowBlur)
  if (blurCheckTimeout !== null) window.clearTimeout(blurCheckTimeout)
})
</script>

<style scoped></style>
