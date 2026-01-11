<template>
  <div class="h-full text-white flex flex-col p-2 overflow-auto" @mousedown="searchBarRef?.exit">
    <div class="flex justify-end items-center h-10 mb-2 gap-2">
      <TruthTableSearch :input-vars="inputVars" :output-vars="outputVars" :values="tableValues"
        :show-all-output-vars="showAllOutputVars" :output-variable-index="outputVariableIndex"
        @values-changed="tableValues = $event" @highlighted-row-changed="highlightedRow = $event"
        @blink-green-row-changed="blinkGreenRow = $event"></TruthTableSearch>

      <LegendButton :legend="legend" />

      <SettingsButton :input-vars="inputVars" :output-vars="outputVars" :selected-output-index="outputVariableIndex"
        :selected-function-type="functionType" :input-selection="inputSelection"
        :customSettingSlotLabels="{ 'show-all-ouput-vars': 'Show all ouput variables' }">
        <template #show-all-ouput-vars>
          <div class="flex gap-2 items-center" @click.stop>
            <Checkbox v-model="showAllOutputVars"></Checkbox>
            <div class="text-xs">
              <span v-if="showAllOutputVars">Showing all variables</span>
              <span v-else="showAllOutputVars">Showing currently selected</span>
            </div>
          </div>
        </template>
      </SettingsButton>

      <DownloadButton :target-ref="screenshotRef" filename="truth-table" :latex-content="getTruthTableLatex()" />
    </div>
    <div ref="screenshotRef" class="flex-1 overflow-auto">
      <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars"
        :highlighted-row="highlightedRow" :blink-green-row="blinkGreenRow" :show-all-output-vars="showAllOutputVars"
        :output-variable-index="outputVariableIndex" />
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, watch } from 'vue'
import TruthTable from '@/components/TruthTable.vue'
import TruthTableSearch from '@/components/parts/TruthTableSearch.vue';
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { stateManager } from '@/projects/stateManager';
import LegendButton, { type LegendItem } from '@/components/parts/buttons/LegendButton.vue';
import type { IDockviewPanelProps } from 'dockview-vue';
import Checkbox from '@/components/parts/Checkbox.vue';

const legend: LegendItem[] = [
  {
    symbol: 'bg-secondary-variant',
    symbolType: 'bg-color',
    label: 'Input variables',
    description: 'Independent boolean values that define each row of the truth table.'
  },
  {
    symbol: 'bg-primary-variant',
    symbolType: 'bg-color',
    label: 'Output variables',
    description: 'Dependent boolean results produced by the respective function for each combination of input variables.'
  }
]

interface TruthTablePanelState {
  showAllOutputVars: boolean
}

// Access state from params
const { inputVars, outputVars, values, outputVariableIndex, functionType, inputSelection } = TruthTableProject.useState()

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<TruthTablePanelState>(props.params.api.id)
const searchBarRef = ref<InstanceType<typeof TruthTableSearch>>()
const tableValues = ref<TruthTableData>(values ? values.value.map((row: TruthTableCell[]) => [...row]) : [])
const highlightedRow = ref<number | null>(null)
const blinkGreenRow = ref<number | null>(null)
const showAllOutputVars = ref(panelState?.showAllOutputVars ?? true)
let isUpdatingFromState = false

// Auto-save panel state when values change
stateManager.watchPanelState<TruthTablePanelState>(props.params.api.id, () => ({
  showAllOutputVars: showAllOutputVars.value
}))

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  if (!stateManager.state.truthTable) return

  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[TruthTablePanel] Skipping update (isUpdatingFromState)');
    return
  }

  console.log('[TruthTablePanel] Calling updateTruthTable');
  Object.assign(stateManager.state.truthTable.values, newVal);
  updateTruthTable()
}, { deep: true })

// Watch for external changes from state
watch(() => values.value, (newVal) => {
  console.log('[TruthTablePanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })

const screenshotRef = ref<HTMLElement | null>(null)

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
