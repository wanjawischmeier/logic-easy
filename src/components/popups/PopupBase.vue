<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Barrier -->
      <div class="absolute inset-0 bg-black/20" @click="onBarrierClick"></div>

      <!-- Popup Content -->
      <div
        class="relative bg-surface-1 border border-surface-3 rounded-xs shadow-xl max-w-2xl w-full pt-4 pb-2 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        @keydown.enter="onEnterPress(confirmAction)">
        <!-- Header -->
        <div class="px-6 pb-4">
          <h2 class="text-3xl text-on-surface">{{ title }}</h2>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-auto px-6 py-4">
          <slot></slot>
        </div>

        <!-- Actions -->
        <div v-if="actions.length > 0" class="flex items-center justify-end gap-2 px-6 py-4">
          <button v-for="(action, idx) in actions" :key="idx" @click="handleAction(action)"
            :disabled="action.type === 'DISABLED'" :class="getActionClass(action.type)" type="button">
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type PopupActionType = 'DEFAULT' | 'SUBMIT' | 'WARNING' | 'DISABLED';

export type PopupAction = {
  type: PopupActionType;
  label: string;
  onClick: () => void;
  closesPopup?: boolean;
};

defineProps<{
  visible: boolean;
  title: string;
  actions: PopupAction[];
  confirmAction?: PopupAction
}>();

const emit = defineEmits<{
  close: [];
}>();

function close() {
  emit('close');
}

function onBarrierClick() {
  close();
}

function onEnterPress(action?: PopupAction) {
  handleAction(action)
}

function handleAction(action?: PopupAction) {
  if (!action) return;

  action.onClick();
  if (action.closesPopup !== false) {
    close();
  }
}

function getActionClass(type: PopupActionType): string {
  const baseClass = 'px-2 py-1 rounded-xs font-medium text-on-surface';

  switch (type) {
    case 'SUBMIT':
      return `${baseClass} bg-primary`;
    case 'WARNING':
      return `${baseClass} bg-error`;
    case 'DISABLED':
      return `${baseClass} bg-surface-2 text-on-surface-disabled cursor-not-allowed`;
    case 'DEFAULT':
    default:
      return `${baseClass} bg-surface-2`;
  }
}


</script>
