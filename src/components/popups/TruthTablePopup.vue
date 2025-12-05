<template>
  <PopupBase :visible="true" title="Create Truth Table or KV Diagram" :actions="actions" @close="onClose">
    <div class="text-on-surface">

      <!-- Placeholder content area -->
      <div class="bg-surface-2 rounded-xs p-8">
        <p class="mb-4">Configure the amount of variables</p>

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
import { stateManager } from '@/utility/states/stateManager';
import { ref, watch } from 'vue';
import { Formula, type TruthTableCell, type TruthTableData } from '@/utility/types'; // added import

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
  const inCount = Math.max(1, Math.min(8, inputCount.value));
  const outCount = Math.max(1, Math.min(8, outputCount.value));

  // input names: a, b, c, ...
  const inputVars = Array.from({ length: inCount }, (_, i) =>
    String.fromCharCode(97 + i)
  );

  // output names: p, q, r, ...
  const outputVars = Array.from({ length: outCount }, (_, i) =>
    String.fromCharCode(112 + i)
  );

  // create formulas as a mapping per output to a mapping per row (matches expected Record<string, Record<string, Formula>>)
  const formulas: Record<string, Record<string, Formula>> = {};
  outputVars.forEach((name) => {
    formulas[name] = {}; // leave per-row formulas empty for now
  });

  // number of rows = 2^n
  const rows = 1 << inCount;

  // initialize all output values to zero: rows x outCount, typed as TruthTableData
  const values = Array.from({ length: rows }, () =>
    Array.from({ length: outCount }, () => 0 as TruthTableCell)
  ) as TruthTableData;

  stateManager.state.truthTable = {
    inputVars,
    outputVars,
    formulas, // now matches expected record shape
    values,
    minifiedValues: values,
  };
  stateManager.save()

  addPanel('truth-table', 'Truth Table');
  addPanel('kv-diagram', 'Truth Table', {
    referencePanel: 'truth-table',
    direction: 'right'
  });
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
