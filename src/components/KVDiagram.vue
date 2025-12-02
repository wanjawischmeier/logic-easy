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
import type { Formula, Term } from '@/utility/truthTableInterpreter';

const props = defineProps<{
  inputVars: string[];
  outputVars: string[];
  modelValue: TruthTableData;
  minifiedValues?: TruthTableData;
  formula?: Formula;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TruthTableData): void
}>();

const variables = computed(() => props.inputVars || []);

const leftVariables = computed(() => {
  const count = variables.value.length;
  if (count === 2) return [variables.value[0]]; // A
  if (count === 3) return [variables.value[0]]; // A
  if (count === 4) return [variables.value[0], variables.value[1]]; // AB
  return [];
});

const topVariables = computed(() => {
  const count = variables.value.length;
  if (count === 2) return [variables.value[1]]; // B
  if (count === 3) return [variables.value[1], variables.value[2]]; // BC
  if (count === 4) return [variables.value[2], variables.value[3]]; // CD
  return [];
});

// Gray codes
const grayCode2 = ['00', '01', '11', '10'];
const grayCode1 = ['0', '1'];

const rowCodes = computed(() => {
  const count = variables.value.length;
  if (count === 2) return grayCode1; // A: 0, 1
  if (count === 3) return grayCode1; // A: 0, 1
  if (count === 4) return grayCode2; // AB: 00, 01, 11, 10
  return [];
});

const colCodes = computed(() => {
  const count = variables.value.length;
  if (count === 2) return grayCode1; // B: 0, 1
  if (count === 3) return grayCode2; // BC: 00, 01, 11, 10
  if (count === 4) return grayCode2; // CD: 00, 01, 11, 10
  return [];
});

const getValue = (rowCode: string, colCode: string) => {
  if (!props.modelValue) return '-';

  // Combine row and col bits to find the matching row in truth table
  // The order depends on how we split variables.
  // 2 vars: Row=A, Col=B -> AB
  // 3 vars: Row=A, Col=BC -> ABC
  // 4 vars: Row=AB, Col=CD -> ABCD

  const binaryString = rowCode + colCode;
  const rowIndex = parseInt(binaryString, 2);

  if (rowIndex >= 0 && rowIndex < props.modelValue.length) {
    // Return the first result column (assuming single output for KV map for now)
    return props.modelValue[rowIndex]?.[0] ?? '-';
  }
  return '-';
};

const toggleCell = (rowCode: string, colCode: string) => {
  if (!props.modelValue) return;

  const binaryString = rowCode + colCode;
  const rowIndex = parseInt(binaryString, 2);

  if (rowIndex >= 0 && rowIndex < props.modelValue.length) {
    const newValues = props.modelValue.map(row => [...row]);
    const row = newValues[rowIndex];
    if (row) {
      // Toggle logic: 0 -> 1 -> - -> 0
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

const getTermColor = (index: number) => {
  const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
  return `hsla(${hue}, 70%, 50%, 0.3)`;
};

const isCovered = (term: Term, rowCode: string, colCode: string) => {
  const binaryString = rowCode + colCode;
  for (const literal of term.literals) {
    const varIndex = props.inputVars.indexOf(literal.variable);
    if (varIndex === -1) continue;

    const bit = binaryString[varIndex];

    if (props.formula?.type === 'DNF') {
      // DNF: Term is product.
      // literal A (negated=false) matches bit '1'
      // literal !A (negated=true) matches bit '0'
      if (!literal.negated && bit !== '1') return false;
      if (literal.negated && bit !== '0') return false;
    } else {
      // CNF: Term is sum (clause).
      // Clause (A) (negated=false) is FALSE if A=0. So it covers '0's where A=0.
      // Clause (!A) (negated=true) is FALSE if A=1. So it covers '0's where A=1.
      if (!literal.negated && bit !== '0') return false;
      if (literal.negated && bit !== '1') return false;
    }
  }
  return true;
};

const getHighlights = (rIdx: number, cIdx: number) => {
  if (!props.formula) return [];

  const rows = rowCodes.value;
  const cols = colCodes.value;
  const rowCode = rows[rIdx];
  const colCode = cols[cIdx];

  if (!rowCode || !colCode) return [];

  const highlights: { style: Record<string, string> }[] = [];

  props.formula.terms.forEach((term, index) => {
    if (!isCovered(term, rowCode, colCode)) return;

    const color = getTermColor(index);

    // Check neighbors (wrapping)
    const topRow = rows[(rIdx - 1 + rows.length) % rows.length]!;
    const bottomRow = rows[(rIdx + 1) % rows.length]!;
    const leftCol = cols[(cIdx - 1 + cols.length) % cols.length]!;
    const rightCol = cols[(cIdx + 1) % cols.length]!;

    const hasTop = isCovered(term, topRow, colCode);
    const hasBottom = isCovered(term, bottomRow, colCode);
    const hasLeft = isCovered(term, rowCode, leftCol);
    const hasRight = isCovered(term, rowCode, rightCol);

    const pad = '8px';

    highlights.push({
      style: {
        backgroundColor: color,
        top: hasTop ? '0' : pad,
        bottom: hasBottom ? '0' : pad,
        left: hasLeft ? '0' : pad,
        right: hasRight ? '0' : pad,
      }
    });
  });

  return highlights;
};
</script>
