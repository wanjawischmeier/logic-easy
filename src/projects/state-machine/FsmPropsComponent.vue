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
          <label class="text-sm">Input Bits (1-{{ maxIoBits }})</label>
          <input
            type="number"
            v-model.number="localInputBits"
            min="1"
            :max="maxIoBits"
            class="w-20 p-2 rounded border bg-surface"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="inputBitsError" class="text-xs text-red-400 mt-1">{{ inputBitsError }}</p>
      </div>

      <div class="flex flex-col">
        <div class="flex items-center justify-between">
          <label class="text-sm">Output Bits (1-{{ maxIoBits }})</label>
          <input
            type="number"
            v-model.number="localOutputBits"
            min="1"
            :max="maxIoBits"
            class="w-20 p-2 rounded border bg-surface"
            @keypress="onlyNumbers"
          />
        </div>
        <p v-if="outputBitsError" class="text-xs text-red-400 mt-1">{{ outputBitsError }}</p>
      </div>

      <p class="mt-4 text-xs text-on-surface-disabled text-center">
        Please select the amount of input and output bits. The bit count cannot be changed after creation.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry'
import { ref, computed, onMounted, watch } from 'vue'
import { MAX_FSM_IO_BITS } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import type { FsmProps } from './FsmTypes'

const maxIoBits = MAX_FSM_IO_BITS

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
  if (localInputBits.value < 1) return 'Please enter at least 1 input bit.'
  if (localInputBits.value > maxIoBits) return `Please enter at most ${maxIoBits} input bits.`
  return undefined
})

const outputBitsError = computed(() => {
  if (localOutputBits.value < 1) return 'Please enter at least 1 output bit.'
  if (localOutputBits.value > maxIoBits) return `Please enter at most ${maxIoBits} output bits.`
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
