<template>
  <div class="relative shrink-0" ref="dropdownContainer">
    <div
      class="group bg-surface-2 rounded border border-surface-3 hover:border-primary transition-colors p-0.5"
    >
      <button
        type="button"
        @click.stop="toggleDropdown"
        :disabled="!hasMultipleFormulas"
        :aria-expanded="showDropdown"
        :aria-label="label"
        class="px-2 py-1.5 rounded-xs text-white group-hover:bg-primary transition-colors text-sm items-center gap-2 flex disabled:cursor-default disabled:opacity-70 disabled:group-hover:bg-transparent"
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
        dropdownPositionClass + ' bg-surface-2 rounded shadow-lg border border-surface-3 z-50'
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
  }>(),
  { selectedIndex: 0, label: 'Select formula', placement: 'top' },
)

const emit = defineEmits<{
  (e: 'update:selectedIndex', value: number): void
}>()

const dropdownContainer = ref<HTMLElement | null>(null)
const showDropdown = ref(false)
const localSelectedIndex = ref(props.selectedIndex ?? 0)

watch(
  () => props.selectedIndex,
  (v) => (localSelectedIndex.value = v ?? 0),
)

watch(localSelectedIndex, (v) => emit('update:selectedIndex', v))

const hasMultipleFormulas = computed(() => props.formulas.length > 1)

const dropdownPositionClass = computed(() =>
  props.placement === 'bottom'
    ? 'absolute left-0 top-full mt-2'
    : 'absolute left-0 bottom-full mb-2',
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

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped></style>
