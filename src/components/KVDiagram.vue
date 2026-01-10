<template>
  <div class="mt-8 font-mono" :key="renderKey">
    <div v-if="variables.length < 2 || variables.length > 4">
      Only 2, 3, or 4 variables are supported for KV-Diagrams.
    </div>
    <div v-else class="inline-grid grid-cols-[min-content_max-content] grid-rows-[min-content_max-content] select-none">
      <!-- Top Header (Variables) -->
      <div class="col-start-2 row-start-1 flex">
        <!-- Spacer for the corner cell width -->
        <div class="w-14 shrink-0"></div>
        <!-- Centered label over data columns -->
        <div class="flex-1 flex justify-center items-end text-secondary-variant">
          <vue-latex :expression="topVariables.join('')" display-mode />
        </div>
      </div>

      <!-- Left Header (Variables) -->
      <div class="col-start-1 row-start-2 flex flex-col pr-2">
        <!-- Spacer for the header row height -->
        <div class="h-14 shrink-0"></div>
        <!-- Centered label next to data rows -->
        <div class="flex-1 flex items-center justify-end pr-2 text-secondary-variant">
          <vue-latex :expression="leftVariables.join('')" display-mode />
        </div>
      </div>

      <!-- The Grid -->
      <table class="col-start-2 row-start-2 border-collapse">
        <thead>
          <tr>
            <th class="border-none bg-transparent w-10 h-10 text-secondary-variant text-sm">
              <vue-latex :expression="outputVars[outputVariableIndex ?? 0] || 'f'" display-mode />
            </th>
            <th v-for="(colCode, cIdx) in colCodes" :key="colCode"
              class="border border-b-4 border-primary bg-surface-1 text-primary-variant font-normal text-sm w-14 h-14 text-center"
              :class="{ 'border-l-4': cIdx === 0 }">
              <vue-latex :expression="colCode" display-mode />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rowCode, rIdx) in rowCodes" :key="rowCode">
            <th
              class="border border-r-4 border-primary bg-surface-1 text-primary-variant font-normal text-sm w-14 text-center"
              :class="{ 'border-t-4': rIdx === 0 }">
              <vue-latex :expression="rowCode" display-mode />
            </th>
            <td v-for="(colCode, cIdx) in colCodes" :key="colCode"
              class="relative border border-primary bg-surface-1 text-center hover:bg-surface-3 transition-colors duration-100 cursor-pointer select-none w-14 h-14"
              @click="toggleCell(rowCode, colCode)">

              <!-- Highlights -->
              <div class="absolute inset-0 pointer-events-none">
                <div v-for="(highlight, idx) in getHighlights(rIdx, cIdx)" :key="idx"
                  class="absolute transition-all duration-100" :style="highlight.style">
                </div>
              </div>
              <!-- Content -->
              <div class="relative z-10 flex items-center justify-center h-full">
                <vue-latex :expression="getValue(rowCode, colCode).toString()" display-mode />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Formula, FunctionType, defaultFunctionType } from '../utility/types';
import {
  getLeftVariables,
  getTopVariables,
  getRowCodes,
  getColCodes,
  getBinaryString
} from '@/utility/truthtable/kvDiagramLayout';
import { calculateHighlights } from '@/utility/truthtable/kvDiagramHighlights';
import type { TruthTableData, TruthTableCell, TruthTableState } from '@/projects/truth-table/TruthTableProject';

const props = defineProps<TruthTableState>();

const emit = defineEmits<{
  (e: 'valuesChanged', value: TruthTableData): void
}>();

// Filter to only selected variables
const selectedVars = computed(() => {
  if (!props.inputSelection) return props.inputVars || [];
  return props.inputVars.filter((_, idx) => props.inputSelection[idx]) || [];
});

const variables = computed(() => selectedVars.value);
const leftVariables = computed(() => getLeftVariables(variables.value));
const topVariables = computed(() => getTopVariables(variables.value));
const rowCodes = computed(() => getRowCodes(variables.value.length));
const colCodes = computed(() => getColCodes(variables.value.length));

// Convert from reduced KV diagram index to full truth table row index
const getFullRowIndex = (reducedIndex: number): number => {
  if (!props.inputSelection || props.inputSelection.every(Boolean)) {
    return reducedIndex;
  }

  // Extract bits for the reduced index and map them back to full row index
  let fullIndex = 0;
  let reducedBit = 0;

  for (let i = props.inputVars.length - 1; i >= 0; i--) {
    if (props.inputSelection[i]) {
      // This variable is selected, use bit from reduced index
      const bit = (reducedIndex >> reducedBit) & 1;
      fullIndex |= (bit << i);
      reducedBit++;
    }
    // If not selected, bit stays 0 in full index
  }

  return fullIndex;
};

const getValue = (rowCode: string, colCode: string) => {
  if (!props.values) return '-';

  const binaryString = getBinaryString(rowCode, colCode);
  const reducedIndex = parseInt(binaryString, 2);
  const rowIndex = getFullRowIndex(reducedIndex);
  const outputIdx = props.outputVariableIndex ?? 0;

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    return props.values[rowIndex]?.[outputIdx] ?? '-';
  }
  return '-';
};

const toggleCell = (rowCode: string, colCode: string) => {
  console.log('Toggle cell' + props.values)
  if (!props.values) return;

  const binaryString = getBinaryString(rowCode, colCode);
  const reducedIndex = parseInt(binaryString, 2);
  const rowIndex = getFullRowIndex(reducedIndex);
  const outputIdx = props.outputVariableIndex ?? 0;

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    const newValues = props.values.map(row => [...row]);
    const row = newValues[rowIndex];
    if (row) {
      const current = row[outputIdx];
      let next: TruthTableCell = 0;
      if (current === 0) next = 1;
      else if (current === 1) next = '-';
      else next = 0;

      row[outputIdx] = next;
      emit('valuesChanged', newValues);
    }
  }
};

const getHighlights = (rIdx: number, cIdx: number) => {
  if (!props.formulas) return [];

  const functionType = props.functionType || props.formulas?.type || defaultFunctionType;
  const outputVar = props.outputVars[props.outputVariableIndex]
  if (!outputVar) return []

  const formulas = props.formulas[outputVar]
  if (!formulas) return []

  const formula = formulas[props.functionType]
  return calculateHighlights(
    rIdx,
    cIdx,
    rowCodes.value,
    colCodes.value,
    formula.terms,
    functionType,
    props.inputVars
  );
};

const renderKey = ref(0);

const refresh = async () => {
  await nextTick();
  renderKey.value++;
};

defineExpose({ refresh });
</script>
