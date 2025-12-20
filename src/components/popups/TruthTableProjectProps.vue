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
import { ref, computed, onMounted, watch } from 'vue';
import type { ValidationFunction } from './ProjectCreationPopup.vue';

// TODO use this type alongside a generalized `ProjectCreationProps` instead of `props: Record<string, unknown>`
export type TruthTableProjectCreationProps = {
  inputCount?: number;
  outputCount?: number;
  registerValidation?: (fn: ValidationFunction) => void;
};

const props = defineProps<TruthTableProjectCreationProps>();

const emit = defineEmits<{
  'update:inputCount': [value: number];
  'update:outputCount': [value: number];
}>();

const localInputCount = ref(props.inputCount ?? 2);
const localOutputCount = ref(props.outputCount ?? 1);

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

// Emit changes to parent
watch(localInputCount, (val) => {
  emit('update:inputCount', val);
}, { immediate: true });

watch(localOutputCount, (val) => {
  emit('update:outputCount', val);
}, { immediate: true });

// Only allow numeric input
const onlyNumbers = (event: KeyboardEvent) => {
  if (!/[0-9]/.test(event.key)) {
    event.preventDefault();
  }
};
</script>
