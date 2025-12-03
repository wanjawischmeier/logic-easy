<template>
  <div class="flex items-center rounded bg-surface-2 p-0.5 border border-surface-3">
    <button v-for="(item, idx) in values" :key="idx" @click="select(idx, item)" :aria-pressed="idx === selected"
      :class="idx === selected ? 'selected' : ''">
      {{ getLabel(item) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch } from 'vue'

type Value = unknown

const props = defineProps<{
  values: Value[]
  initialSelected?: number | null
  onSelect?: (value: Value, index: number) => void
  labelKey?: string
  labelFn?: (v: Value) => string
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: number | null): void
}>()

const { values, initialSelected, labelKey, labelFn, onSelect } = toRefs(props)

const selected = ref<number | null>(
  initialSelected?.value ?? (values.value && values.value.length ? 0 : null)
)

watch(initialSelected, (v) => {
  selected.value = v ?? (values.value && values.value.length ? 0 : null)
})

function getLabel(item: Value) {
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

function select(idx: number, item: Value) {
  selected.value = idx
  emit('update:selected', idx)
  if (onSelect?.value && typeof onSelect.value === 'function') {
    onSelect.value(item, idx)
  }
}
</script>
