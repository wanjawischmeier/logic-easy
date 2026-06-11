<template>
  <div class="text-on-surface">
    <p class="mb-4">Configure the amount of variables</p>

    <div class="grid gap-5 text-left">
      <!-- Input variables -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <label class="text-sm">Input variables</label>
          <input
            type="number"
            v-model.number="localInputCount"
            min="1"
            max="8"
            class="w-20 p-2 rounded border"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="inputCountError" class="text-xs text-red-400">{{ inputCountError }}</p>
        <button
          type="button"
          @click="showInputRename = !showInputRename"
          class="flex items-center gap-1 text-xs text-on-surface-disabled hover:text-on-surface transition-colors self-start"
        >
          <svg
            class="w-3 h-3 transition-transform duration-150"
            :class="showInputRename ? 'rotate-90' : ''"
            viewBox="0 0 6 10"
            fill="currentColor"
          >
            <path
              d="M1 1l4 4-4 4"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Rename
        </button>
        <div v-if="showInputRename" class="flex flex-col gap-1.5 pt-0.5">
          <div class="flex flex-wrap gap-1.5">
            <input
              v-for="i in inputRange"
              :key="`in-${i}`"
              v-model="localInputLabels[i]"
              :class="[
                'w-14 px-1 py-1 text-center text-sm font-mono rounded-xs border bg-surface-2 text-on-surface focus:outline-none transition-colors',
                localInputLabels[i]?.trim() === ''
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-surface-3 focus:border-primary',
              ]"
              maxlength="5"
              @keypress="onlyVarChars"
            />
          </div>
          <p v-if="inputError" class="text-xs text-red-400">{{ inputError }}</p>
        </div>
      </div>

      <!-- Output variables -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <label class="text-sm">Output variables</label>
          <input
            type="number"
            v-model.number="localOutputCount"
            min="1"
            max="8"
            class="w-20 p-2 rounded border"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="outputCountError" class="text-xs text-red-400">{{ outputCountError }}</p>
        <button
          type="button"
          @click="showOutputRename = !showOutputRename"
          class="flex items-center gap-1 text-xs text-on-surface-disabled hover:text-on-surface transition-colors self-start"
        >
          <svg
            class="w-3 h-3 transition-transform duration-150"
            :class="showOutputRename ? 'rotate-90' : ''"
            viewBox="0 0 6 10"
            fill="currentColor"
          >
            <path
              d="M1 1l4 4-4 4"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Rename
        </button>
        <div v-if="showOutputRename" class="flex flex-col gap-1.5 pt-0.5">
          <div class="flex flex-wrap gap-1.5">
            <input
              v-for="i in outputRange"
              :key="`out-${i}`"
              v-model="localOutputLabels[i]"
              :class="[
                'w-14 px-1 py-1 text-center text-sm font-mono rounded-xs border bg-surface-2 text-on-surface focus:outline-none transition-colors',
                localOutputLabels[i]?.trim() === ''
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-surface-3 focus:border-primary',
              ]"
              maxlength="5"
              @keypress="onlyVarChars"
            />
          </div>
          <p v-if="outputError" class="text-xs text-red-400">{{ outputError }}</p>
        </div>
      </div>
    </div>

    <p class="mt-4 text-xs text-on-surface-disabled text-center">
      Adjust number of variables and optionally rename them.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry'
import { ref, computed, onMounted, watch } from 'vue'
import type { TruthTableProps } from './TruthTableProject'

const props = defineProps<{
  modelValue: TruthTableProps
  registerValidation?: (fn: ValidationFunction) => void
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TruthTableProps]
}>()

const localInputCount = ref(props.modelValue.inputVariableCount)
const localOutputCount = ref(props.modelValue.outputVariableCount)
const showInputRename = ref(false)
const showOutputRename = ref(false)

const defaultInputName = (i: number) => String.fromCharCode(97 + i)
const defaultOutputName = (i: number) => String.fromCharCode(112 + i)

const localInputLabels = ref<string[]>(
  Array.from({ length: props.modelValue.inputVariableCount }, (_, i) => defaultInputName(i)),
)
const localOutputLabels = ref<string[]>(
  Array.from({ length: props.modelValue.outputVariableCount }, (_, i) => defaultOutputName(i)),
)

const clamp = (n: number) => Math.min(Math.max(Math.floor(n) || 1, 1), 8)

const inputRange = computed(() => Array.from({ length: clamp(localInputCount.value) }, (_, i) => i))
const outputRange = computed(() =>
  Array.from({ length: clamp(localOutputCount.value) }, (_, i) => i),
)

// Resize label arrays when counts change, filling new slots with defaults
watch(localInputCount, (n) => {
  const c = clamp(n)
  const arr = localInputLabels.value
  while (arr.length < c) arr.push(defaultInputName(arr.length))
  if (arr.length > c) localInputLabels.value = arr.slice(0, c)
})
watch(localOutputCount, (n) => {
  const c = clamp(n)
  const arr = localOutputLabels.value
  while (arr.length < c) arr.push(defaultOutputName(arr.length))
  if (arr.length > c) localOutputLabels.value = arr.slice(0, c)
})

const effectiveInputLabels = computed(() =>
  localInputLabels.value.map((l, i) => l.trim() || defaultInputName(i)),
)
const effectiveOutputLabels = computed(() =>
  localOutputLabels.value.map((l, i) => l.trim() || defaultOutputName(i)),
)

const inputCountError = computed(() => {
  if (localInputCount.value < 1) return 'Must be at least 1'
  if (localInputCount.value > 8) return 'Must be at most 8'
  return undefined
})

const outputCountError = computed(() => {
  if (localOutputCount.value < 1) return 'Must be at least 1'
  if (localOutputCount.value > 8) return 'Must be at most 8'
  return undefined
})

const validVarName = (l: string) => /^[a-zA-Z0-9äöüÄÖÜ_-]+$/.test(l.trim())

function labelError(raw: string[], effective: string[], otherEffective: string[]): string | undefined {
  if (raw.some((l) => !l.trim())) return 'Name cannot be empty'
  if (raw.some((l) => !validVarName(l))) return 'Variable names may only contain letters, numbers, and underscores.'
  if (new Set(effective).size < effective.length) return 'All variable names must be unique.'
  const otherSet = new Set(otherEffective)
  if (effective.some((l) => otherSet.has(l))) return 'All variable names must be unique.'
  return undefined
}

const inputError = computed(() =>
  labelError(localInputLabels.value, effectiveInputLabels.value, effectiveOutputLabels.value),
)
const outputError = computed(() =>
  labelError(localOutputLabels.value, effectiveOutputLabels.value, effectiveInputLabels.value),
)

// Only send labels if any differ from the defaults
const hasCustomInputLabels = computed(() =>
  localInputLabels.value.some((l, i) => l.trim() !== defaultInputName(i)),
)
const hasCustomOutputLabels = computed(() =>
  localOutputLabels.value.some((l, i) => l.trim() !== defaultOutputName(i)),
)

const fullProps = computed(
  (): TruthTableProps => ({
    name: props.modelValue.name,
    inputVariableCount: clamp(localInputCount.value),
    outputVariableCount: clamp(localOutputCount.value),
    inputVarLabels: hasCustomInputLabels.value ? effectiveInputLabels.value : undefined,
    outputVarLabels: hasCustomOutputLabels.value ? effectiveOutputLabels.value : undefined,
  }),
)

watch(
  [localInputCount, localOutputCount, localInputLabels, localOutputLabels],
  () => emit('update:modelValue', fullProps.value),
  { immediate: true, deep: true },
)

onMounted(() => {
  if (props.registerValidation) {
    props.registerValidation(() => {
      const errors = [
        inputCountError.value,
        outputCountError.value,
        inputError.value,
        outputError.value,
      ].filter(Boolean)
      return { valid: errors.length === 0, error: errors[0] }
    })
  }
})

const onlyNumbers = (event: KeyboardEvent) => {
  if (!/[0-9]/.test(event.key)) event.preventDefault()
}

const onlyVarChars = (event: KeyboardEvent) => {
  if (!/[a-zA-Z0-9äöüÄÖÜ_-]/.test(event.key)) event.preventDefault()
}
</script>
