<template>
  <div class="mt-8 font-mono">
    <div v-if="variables.length < 2 || variables.length > 4">
      Only 2, 3, or 4 variables are supported for KV-Diagrams.
    </div>
    <div v-else class="inline-grid grid-cols-[min-content_max-content] grid-rows-[min-content_max-content] select-none">
      <!-- Top Header (Variables) -->
      <div class="col-start-2 row-start-1 flex">
        <!-- Spacer for the corner cell width -->
        <div class="w-14 shrink-0"></div>
        <!-- Centered label over data columns -->
        <div class="flex-1 flex justify-center items-end text-green-300">
          <vue-latex :expression="topVariables.join('')" display-mode />
        </div>
      </div>

      <!-- Left Header (Variables) -->
      <div class="col-start-1 row-start-2 flex flex-col pr-2">
        <!-- Spacer for the header row height -->
        <div class="h-14 shrink-0"></div>
        <!-- Centered label next to data rows -->
        <div class="flex-1 flex items-center justify-end pr-2 text-green-300">
          <vue-latex :expression="leftVariables.join('')" display-mode />
        </div>
      </div>

      <!-- The Grid -->
      <table class="col-start-2 row-start-2 border-collapse">
        <thead>
          <tr>
            <th class="border-none bg-transparent w-10 h-10"></th>
            <th v-for="(colCode, cIdx) in colCodes" :key="colCode"
              class="border border-b-4 border-blue-400 bg-slate-800 text-blue-300 font-normal text-sm w-14 h-14 text-center"
              :class="{ 'border-l-4': cIdx === 0 }">
              <vue-latex :expression="colCode" display-mode />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rowCode, rIdx) in rowCodes" :key="rowCode">
            <th
              class="border border-r-4 border-blue-400 bg-slate-800 text-blue-300 font-normal text-sm w-14 text-center"
              :class="{ 'border-t-4': rIdx === 0 }">
              <vue-latex :expression="rowCode" display-mode />
            </th>
            <td v-for="(colCode, cIdx) in colCodes" :key="colCode"
              class="relative border border-blue-400 bg-slate-800 text-center hover:bg-slate-700 transition-colors duration-100 cursor-pointer select-none w-14 h-14"
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
import { computed } from 'vue';
import type { TruthTableData, TruthTableCell } from './TruthTable.vue';
import type { Formula } from '@/utility/truthTableInterpreter';
import {
  getLeftVariables,
  getTopVariables,
  getRowCodes,
  getColCodes,
  getBinaryString
} from '@/utility/kvDiagramLayout';
import { calculateHighlights } from '@/utility/kvDiagramHighlights';

const props = defineProps<{
  inputVars: string[];
  outputVars: string[];
  modelValue: TruthTableData;
  minifiedValues?: TruthTableData;
  formula?: Formula;
  mode?: 'DNF' | 'CNF';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TruthTableData): void
}>();

const variables = computed(() => props.inputVars || []);

const leftVariables = computed(() => getLeftVariables(variables.value));

const topVariables = computed(() => getTopVariables(variables.value));

const rowCodes = computed(() => getRowCodes(variables.value.length));

const colCodes = computed(() => getColCodes(variables.value.length));

const getValue = (rowCode: string, colCode: string) => {
  if (!props.modelValue) return '-';

  const binaryString = getBinaryString(rowCode, colCode);
  const rowIndex = parseInt(binaryString, 2);

  if (rowIndex >= 0 && rowIndex < props.modelValue.length) {
    return props.modelValue[rowIndex]?.[0] ?? '-';
  }
  return '-';
};

const toggleCell = (rowCode: string, colCode: string) => {
  if (!props.modelValue) return;

  const binaryString = getBinaryString(rowCode, colCode);
  const rowIndex = parseInt(binaryString, 2);

  if (rowIndex >= 0 && rowIndex < props.modelValue.length) {
    const newValues = props.modelValue.map(row => [...row]);
    const row = newValues[rowIndex];
    if (row) {
      const current = row[0];
      let next: TruthTableCell = 0;
      if (current === 0) next = 1;
      else if (current === 1) next = '-';
      else next = 0;

      row[0] = next;
      emit('update:modelValue', newValues);
    }
  }
};

const getHighlights = (rIdx: number, cIdx: number) => {
  if (!props.formula) return [];

  const currentMode = props.mode || props.formula?.type || 'DNF';

  return calculateHighlights(
    rIdx,
    cIdx,
    rowCodes.value,
    colCodes.value,
    props.formula.terms,
    currentMode,
    props.inputVars
  );
};
</script>
