<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Barrier -->
      <div class="absolute inset-0 bg-black/20" @click="onBarrierClick"></div>

      <!-- Popup Content -->
      <div
        class="relative bg-surface-1 border border-surface-3 rounded-xs shadow-xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        @keydown.enter="onEnterPress">
        <!-- Project Name Input -->
        <input v-focus ref="projectInput" type="text" placeholder="Project Name" maxlength="40" v-model="projectName"
          class="w-full outline-none truncate text-3xl text-on-surface mb-1" />
        <p v-if="projectNameError" class="text-xs text-red-400 mb-4">{{ projectNameError }}</p>
        <div v-else class="mb-4"></div>
        <hr class="text-surface-3">


        <!-- Project-Specific Configuration -->
        <div class="flex-1 overflow-auto py-4">
          <slot :project-name="projectName" :register-validation="registerValidation" :model-value="projectProps"
            @update:model-value="projectProps = $event"></slot>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-4">
          <button @click="onCancel" class="px-2 py-1 rounded-xs font-medium text-on-surface bg-surface-2" type="button">
            Cancel
          </button>
          <button @click="onCreate" :disabled="!isValid" :class="createButtonClass" type="button">
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ValidationFunction } from '@/projects/projectRegistry';
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  visible: boolean;
  initialProps: Record<string, unknown>;
}>();

const emit = defineEmits<{
  close: [];
  create: [props: Record<string, unknown>];
}>();

const projectName = ref((props.initialProps.name as string) || '');
const projectProps = ref<Record<string, unknown>>({ ...props.initialProps });
const childValidation = ref<ValidationFunction | null>(null);

// Keep name in projectProps synchronized with projectName
watch(projectName, (newVal) => {
  projectName.value = newVal.replace(/[^A-Za-z0-9\s_\-()]/g, '');
  projectProps.value = { ...projectProps.value, name: projectName.value };
});

// Allow child components to register their validation function
function registerValidation(validationFn: ValidationFunction) {
  childValidation.value = validationFn;
}

// Validate project name
const projectNameError = computed(() => {
  if (projectName.value === '') {
    return 'Project name is required';
  }
  return undefined;
});

// Combined validation
const isValid = computed(() => {
  // Check project name
  if (projectNameError.value) {
    return false;
  }

  // Check child validation if registered
  if (childValidation.value) {
    const childResult = childValidation.value();
    return childResult.valid;
  }

  return true;
});

const createButtonClass = computed(() => {
  const baseClass = 'px-2 py-1 rounded-xs font-medium text-on-surface';
  return !isValid.value
    ? `${baseClass} bg-surface-2 text-on-surface-disabled cursor-not-allowed`
    : `${baseClass} bg-primary`;
});

function onBarrierClick() {
  emit('close');
}

function onCancel() {
  emit('close');
}

function onCreate() {
  if (isValid.value) {
    emit('create', projectProps.value);
  }
}

function onEnterPress() {
  onCreate();
}
</script>
