<template>
  <div class="text-on-surface">
    <div class="bg-surface-2 rounded-xs p-8">
      <p class="mb-4">Configure the amount of variables</p>

      <div class="grid gap-4 text-left">
        <div class="flex items-center justify-between">
          <label class="text-sm">Input variables</label>
          <input type="number" v-model.number="localInputCount" min="1" max="8" class="w-20 p-2 rounded border" />
        </div>
        <div class="flex items-center justify-between">
          <label class="text-sm">Output variables</label>
          <input type="number" v-model.number="localOutputCount" min="1" max="8" class="w-20 p-2 rounded border" />
        </div>
      </div>

      <p class="mt-4 text-xs text-on-surface-disabled text-center">
        Adjust number of input and output variables for the new truth table.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  inputCount?: number;
  outputCount?: number;
}>();

const emit = defineEmits<{
  'update:inputCount': [value: number];
  'update:outputCount': [value: number];
}>();

const localInputCount = ref(props.inputCount ?? 2);
const localOutputCount = ref(props.outputCount ?? 1);

watch(localInputCount, (val) => {
  const clamped = Math.max(1, Math.min(8, val));
  localInputCount.value = clamped;
  emit('update:inputCount', clamped);
}, { immediate: true });

watch(localOutputCount, (val) => {
  const clamped = Math.max(1, Math.min(8, val));
  localOutputCount.value = clamped;
  emit('update:outputCount', clamped);
}, { immediate: true });
</script>
