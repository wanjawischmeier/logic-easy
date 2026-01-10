<template>
    <div class="inline-flex items-center gap-2">
        <span v-if="label" class="text-on-surface-variant select-none">{{ label }}</span>
        <div class="inline-flex items-center gap-1">
            <button v-for="(item, idx) in values" :key="idx" @click="toggle(idx)"
                class="px-3 py-1.5 rounded-xs border transition-colors duration-100" :class="isSelected[idx]
                    ? 'bg-primary border-primary text-white'
                    : 'bg-surface-2 border-surface-3 text-on-surface-variant hover:bg-surface-3'">
                {{ getLabel(item) }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch } from 'vue'

const props = defineProps<{
    values: unknown[]
    initialSelected?: boolean[]
    onToggle?: (index: number, value: boolean, selected: boolean[]) => void
    labelKey?: string
    labelFn?: (v: unknown) => string
    label?: string
    minSelected?: number
}>()

const emit = defineEmits<{
    (e: 'update:selected', value: boolean[]): void
}>()

const { values, initialSelected, labelKey, labelFn, onToggle, label } = toRefs(props)

const isSelected = ref<boolean[]>(
    initialSelected?.value ?? Array(values.value.length).fill(true)
)

watch(initialSelected, (v) => {
    if (v) {
        isSelected.value = [...v]
    }
}, { deep: true })

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

function toggle(idx: number) {
    const newValue = !isSelected.value[idx]

    // If trying to deselect, check if we're at the minimum
    if (!newValue && props.minSelected) {
        const currentlySelected = isSelected.value.filter(Boolean).length
        if (currentlySelected <= props.minSelected) {
            return // Don't allow deselecting below minimum
        }
    }

    isSelected.value[idx] = newValue
    emit('update:selected', isSelected.value)
    if (onToggle?.value && typeof onToggle.value === 'function') {
        onToggle.value(idx, isSelected.value[idx]!, isSelected.value)
    }
}
</script>
