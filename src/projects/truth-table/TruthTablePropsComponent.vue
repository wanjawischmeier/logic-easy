<template>
  <div class="text-on-surface">
    <div class="bg-surface-2 rounded-xs p-8">
      <p class="mb-4">Configure the amount of variables</p>

      <div class="grid gap-4 text-left">
        <div class="flex flex-col">
          <div class="flex items-center justify-between">
            <label class="text-sm">Input variables</label>
            <input type="number" v-model.number="localInputCount" min="1" max="8" class="w-20 p-2 rounded border"
              @keypress="onlyNumbers" />
          </div>
          <p v-if="inputCountError" class="text-xs text-red-400 mt-1">{{ inputCountError }}</p>
        </div>
        <div class="flex flex-col">
          <div class="flex items-center justify-between">
            <label class="text-sm">Output variables</label>
            <input type="number" v-model.number="localOutputCount" min="1" max="8" class="w-20 p-2 rounded border"
              @keypress="onlyNumbers" />
          </div>
          <p v-if="outputCountError" class="text-xs text-red-400 mt-1">{{ outputCountError }}</p>
        </div>
      </div>

      <p class="mt-4 text-xs text-on-surface-disabled text-center">
        Adjust number of input and output variables for the new truth table.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry';
import { ref, computed, onMounted, watch } from 'vue';
import type { TruthTableProps } from './TruthTableProject';

const props = defineProps<{
  modelValue: TruthTableProps;
  registerValidation?: (fn: ValidationFunction) => void;
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TruthTableProps]
}>();

const localInputCount = ref(props.modelValue.inputVars.length);
const localOutputCount = ref(props.modelValue.outputVars.length);

// Validation
const inputCountError = computed(() => {
  if (localInputCount.value < 1) {
    return 'Must be at least 1';
  }
  if (localInputCount.value > 8) {
    return 'Must be at most 8';
  }
  return undefined;
});

const outputCountError = computed(() => {
  if (localOutputCount.value < 1) {
    return 'Must be at least 1';
  }
  if (localOutputCount.value > 8) {
    return 'Must be at most 8';
  }
  return undefined;
});

// Convert counts to full props on emit
const fullProps = computed((): TruthTableProps => ({
  name: props.modelValue.name,
  inputVars: Array.from({ length: localInputCount.value }, (_, i) => String.fromCharCode(97 + i)),
  outputVars: Array.from({ length: localOutputCount.value }, (_, i) => String.fromCharCode(112 + i))
}))

// Emit changes to parent
watch([localInputCount, localOutputCount], () => {
  emit('update:modelValue', fullProps.value)
}, { immediate: true })

// Register validation with parent
onMounted(() => {
  if (props.registerValidation) {
    props.registerValidation(() => {
      const errors = [inputCountError.value, outputCountError.value].filter(Boolean);
      return {
        valid: errors.length === 0,
        error: errors[0]
      };
    });
  }
});

// Only allow numeric input
const onlyNumbers = (event: KeyboardEvent) => {
  if (!/[0-9]/.test(event.key)) {
    event.preventDefault();
  }
};
</script>
