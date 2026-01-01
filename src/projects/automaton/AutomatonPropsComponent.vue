<template>
  <div class="text-on-surface">
    <p class="mb-4">Create automaton</p>
  </div>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry';
import { ref, computed, onMounted, watch } from 'vue';
import type { AutomatonProps } from './AutomatonProject';

const props = defineProps<{
  modelValue: AutomatonProps;
  registerValidation?: (fn: ValidationFunction) => void;
}>()


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
