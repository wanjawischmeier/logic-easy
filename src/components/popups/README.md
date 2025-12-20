Popup components used across the application.

# Responsibilities

Modal and popup UIs for user flows (credits, manual, project creation, property editing).

# Usage
Use `PopupBase.vue` for consistent styling and accessibility. For project creation popups, add a props file (like `TruthTableProjectProps.vue`) for each popup type that defines its props and their layout. Those will then be embedded into the content area of `ProjectCreationPopup.vue`. Open/close a popup via `popupService` or parent state.

# Key files

- `PopupBase.vue`: base modal wrapper — use to create consistent general popups.
- `ProjectCreationPopup.vue`: More specialized, use to create project creation popups specifically.
# Project Props Validation

Parent (`ProjectCreationPopup`) validates the project name and provides a `registerValidation` function via slot props. Child props components call `registerValidation(fn)` to register a function that returns `{ valid: boolean, error?: string }`.

## Example:

```vue
<!-- Parent usage (slot provides registerValidation) -->
<ProjectCreationPopup v-slot="{ registerValidation }" @create="onCreate">
  <TruthTableProjectProps v-model:inputCount="props.inputCount" :registerValidation="registerValidation" />
</ProjectCreationPopup>

<!-- Child component -->
<template>
  <div>
    <input type="number" v-model.number="local" />
    <p v-if="error" class="text-red">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
const props = defineProps<{ inputCount?: number; registerValidation?: (fn: any) => void }>();
const emit = defineEmits<{ 'update:inputCount': [number] }>();

const local = ref(props.inputCount ?? 1);
watch(local, v => emit('update:inputCount', v));

const error = computed(() => (local.value < 1 ? 'Must be ≥ 1' : undefined));

onMounted(() => {
  props.registerValidation?.(() => ({ valid: !error.value, error: error.value }));
});
</script>
```
