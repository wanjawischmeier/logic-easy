<template>
  <div class="inline-flex items-center gap-2 ">
    <span v-if="label" class="text-on-surface-variant select-none">{{ label }}</span>
    <div class="inline-flex items-center rounded bg-surface-2 p-0.5 border border-surface-3 relative">
      <div class="slider absolute inset-y-0.5 rounded-xs transition-transform duration-100 ease-in-out"
        :style="{ width: `calc((100% - 4px) / ${values.length})`, transform: `translateX(calc(${selected} * 100%))` }">
      </div>
      <button v-for="(item, idx) in values" :key="idx" @click="select(idx, item)" :aria-pressed="idx === selected"
        class="px-3 py-1.5 rounded relative z-10 transition-colors duration-100"
        :class="idx === selected ? 'text-on-surface' : ''">
        {{ getLabel(item) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch } from 'vue'

const props = defineProps<{
  values: unknown[]
  initialSelected?: number
  onSelect?: (value: unknown, index: number) => void
  labelKey?: string
  labelFn?: (v: unknown) => string
  label?: string
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: number | null): void
}>()

const { values, initialSelected, labelKey, labelFn, onSelect, label } = toRefs(props)

const selected = ref<number | null>(
  initialSelected?.value ?? (values.value && values.value.length ? 0 : null)
)

watch(initialSelected, (v) => {
  selected.value = v ?? (values.value && values.value.length ? 0 : null)
})

function getLabel(item: unknown) {
  if (labelFn?.value && typeof labelFn.value === 'function') {
    try {
      return labelFn.value(item)
    } catch {
      return String(item ?? '')
    }
  }
  if (labelKey?.value && item && typeof item === 'object') {
    const keyed = item as Record<string, unknown>
    const val = keyed[labelKey.value as string]
    return String(val ?? '')
  }
  return String(item ?? '')
}

function select(idx: number, item: unknown) {
  selected.value = idx
  emit('update:selected', idx)
  if (onSelect?.value && typeof onSelect.value === 'function') {
    onSelect.value(item, idx)
  }
}
</script>
