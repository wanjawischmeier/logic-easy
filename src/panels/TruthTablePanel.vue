<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TruthTable from '@/components/TruthTable.vue'
import DownloadButton from '@/components/parts/DownloadButton.vue'
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';

// Access state from params
const { inputVars, outputVars, values } = TruthTableProject.useState()

console.log('[TruthTablePanel] State from useState:', {
  inputVars: inputVars.value,
  outputVars: outputVars.value,
  hasValues: !!(values.value),
})

// Local model for the table component
const tableValues = ref<TruthTableData>(values ? values.value.map((row: TruthTableCell[]) => [...row]) : [])
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  console.log('[TruthTablePanel] Local tableValues changed:', newVal);
  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[TruthTablePanel] Skipping update (isUpdatingFromState)');
    return
  }
  console.log('[TruthTablePanel] Calling updateTruthTable');
  updateTruthTable(newVal)
}, { deep: true })

// Watch for external changes from state
watch(() => values.value, (newVal) => {
  console.log('[TruthTablePanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })

const screenshotRef = ref<HTMLElement | null>(null)

const downloadFiles = computed(() => [
  {
    label: 'LaTeX',
    filename: 'truth-table',
    extension: 'tex',
    content: () => getTruthTableLatex(),
    mimeType: 'text/plain',
    registerWith: 'latex' as const,
  },
])

function getInputValue(rowIdx: number, colIdx: number, numInputs: number): number {
  // MSB is at index 0
  const shiftAmount = numInputs - 1 - colIdx;
  return (rowIdx >> shiftAmount) & 1;
}

function getTruthTableLatex(): string {
  const numInputs = inputVars.value.length;
  const numOutputs = outputVars.value.length;

  // Create table header with proper column alignment
  const colSpec = 'c'.repeat(numInputs) + '|' + 'c'.repeat(numOutputs);
  let latex = `\\begin{tabular}{${colSpec}}\n`;

  // Add header row
  const headers = [...inputVars.value, ...outputVars.value];
  latex += headers.join(' & ') + ' \\\\\n\\hline\n';

  // Add data rows
  for (let rowIdx = 0; rowIdx < values.value.length; rowIdx++) {
    const row = values.value[rowIdx];
    if (!row) continue

    // Generate input values
    const inputValues = [];
    for (let colIdx = 0; colIdx < numInputs; colIdx++) {
      inputValues.push(getInputValue(rowIdx, colIdx, numInputs).toString());
    }

    // Get output values
    const outputValues = row.map(cell => cell.toString());

    // Combine input and output values
    const allValues = [...inputValues, ...outputValues];
    latex += allValues.join(' & ') + ' \\\\\n';
  }

  latex += '\\end{tabular}';
  return latex;
}
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-auto">
    <div class="flex justify-end h-10 mb-2">
      <DownloadButton :target-ref="screenshotRef" filename="truth-table" :files="downloadFiles" />
    </div>
    <div ref="screenshotRef" class="flex-1 overflow-auto">
      <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" />
    </div>
  </div>
</template>

<style scoped></style>
