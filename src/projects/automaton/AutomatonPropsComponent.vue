<template>
  <div class="text-on-surface">
    <p class="mb-4">Create automaton</p>

    <label class="block mb-2 text-sm">
      Type
      <select
        class="border rounded px-2 py-1 ml-2"
        v-model="localProps.automatonType"
      >
        <option value="mealy">Mealy</option>
        <option value="moore">Moore</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry';
import { ref, onMounted, watch } from 'vue';
import type { AutomatonProps } from './AutomatonTypes';

const props = defineProps<{
  modelValue: AutomatonProps;
  registerValidation?: (fn: ValidationFunction) => void;
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AutomatonProps): void;
}>();

const localProps = ref<AutomatonProps>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (val) => {
    localProps.value = { ...val };
  },
  { deep: true }
);

watch(
  localProps,
  (val) => {
    emit('update:modelValue', val);
  },
  { deep: true }
);

// Register validation with parent
onMounted(() => {
  if (props.registerValidation) {
    props.registerValidation(() => {
      return {
        valid: true,
        error: undefined
      };
    });
  }
});
</script>
