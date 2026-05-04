<template>
  <div class="text-on-surface">
    <p class="mb-4">Configure your State Machine</p>

    <div class="grid gap-4 text-left">
      <div class="flex flex-col">
        <div class="flex items-center justify-between">
          <label class="text-sm">Type</label>
          <select class="border rounded px-2 py-2 w-32 bg-surface" v-model="localFsmType">
            <option value="mealy">Mealy</option>
            <option value="moore">Moore</option>
          </select>
        </div>
      </div>

      <hr class="border-on-surface-disabled opacity-20" />

      <div class="flex flex-col">
        <div class="flex items-center justify-between">
          <label class="text-sm">Input Bits (1-5)</label>
          <input
            type="number"
            v-model.number="localInputBits"
            min="1"
            max="5"
            class="w-20 p-2 rounded border bg-surface"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="inputBitsError" class="text-xs text-red-400 mt-1">{{ inputBitsError }}</p>
      </div>

      <div class="flex flex-col">
        <div class="flex items-center justify-between">
          <label class="text-sm">Output Bits (1-5)</label>
          <input
            type="number"
            v-model.number="localOutputBits"
            min="1"
            max="5"
            class="w-20 p-2 rounded border bg-surface"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="outputBitsError" class="text-xs text-red-400 mt-1">{{ outputBitsError }}</p>
      </div>

      <p class="mt-4 text-xs text-on-surface-disabled text-center">
        The selected bit numbers determine the amount of input / output bits.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry'
import { ref, computed, onMounted, watch } from 'vue'
import type { FsmProps } from './FsmTypes'

const props = defineProps<{
  modelValue: FsmProps
  registerValidation?: (fn: ValidationFunction) => void
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: FsmProps): void
}>()

// local state
const localFsmType = ref(props.modelValue.initialFsmType)
const localInputBits = ref(props.modelValue.initialInputBits ?? 1)
const localOutputBits = ref(props.modelValue.initialOutputBits ?? 1)

// props input validation
const inputBitsError = computed(() => {
  if (localInputBits.value < 1) return 'Must be at least 1'
  if (localInputBits.value > 5) return 'Max 5 bits allowed'
  return undefined
})

const outputBitsError = computed(() => {
  if (localOutputBits.value < 1) return 'Must be at least 1'
  if (localOutputBits.value > 5) return 'Max 5 bits allowed'
  return undefined
})

const onlyNumbers = (event: KeyboardEvent) => {
  if (!/[0-9]/.test(event.key)) {
    event.preventDefault()
  }
}

// combined full props for emit
const fullProps = computed(
  (): FsmProps => ({
    ...props.modelValue,
    initialFsmType: localFsmType.value,
    initialInputBits: localInputBits.value,
    initialOutputBits: localOutputBits.value,
  }),
)

// watch all local refs and emit changes
watch(
  [localFsmType, localInputBits, localOutputBits],
  () => {
    emit('update:modelValue', fullProps.value)
  },
  { immediate: true },
)

// Register validation with parent
onMounted(() => {
  if (props.registerValidation) {
    props.registerValidation(() => {
      const errors = [inputBitsError.value, outputBitsError.value].filter(Boolean)
      return {
        valid: errors.length === 0,
        error: errors[0],
      }
    })
  }
})
</script>
