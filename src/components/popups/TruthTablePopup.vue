<template>
  <PopupBase :visible="true" title="Create Truth Table" :actions="actions" @close="onClose">
    <div class="text-on-surface">

      <!-- Placeholder content area -->
      <div class="bg-surface-2 rounded-xs p-8">
        <p class="mb-4">Configure the new truth table</p>

        <!-- added: input/output count controls -->
        <div class="grid gap-4 text-left">
          <div class="flex items-center justify-between">
            <label class="text-sm">Input variables</label>
            <input type="number" v-model.number="inputCount" min="1" max="8" class="w-20 p-2 rounded border" />
          </div>
          <div class="flex items-center justify-between">
            <label class="text-sm">Output variables</label>
            <input type="number" v-model.number="outputCount" min="1" max="8" class="w-20 p-2 rounded border" />
          </div>
        </div>

        <p class="mt-4 text-xs text-on-surface-disabled text-center">Adjust number of input and output variables for the
          new truth
          table.</p>
      </div>
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import PopupBase, { type PopupAction } from '@/components/PopupBase.vue';
import { addPanel } from '@/utility/dockviewIntegration';
import { popupService } from '@/utility/popupService';
import { ref, watch } from 'vue';

const inputCount = ref<number>(2);
const outputCount = ref<number>(1);

// Clamp values between 1 and 8 whenever they change
watch(inputCount, (val) => {
  if (val < 1) inputCount.value = 1;
  if (val > 8) inputCount.value = 8;
});

watch(outputCount, (val) => {
  if (val < 1) outputCount.value = 1;
  if (val > 8) outputCount.value = 8;
});

function onClose() {
  popupService.close();
}

function onCreate() {
  addPanel('truth-table', 'Truth Table');
  popupService.close();
}

const actions: PopupAction[] = [
  {
    type: 'DEFAULT',
    label: 'Cancel',
    onClick: onClose,
  },
  {
    type: 'SUBMIT',
    label: 'Create',
    onClick: onCreate,
  },
];
</script>
