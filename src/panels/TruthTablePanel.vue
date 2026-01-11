<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import TruthTable from '@/components/TruthTable.vue'
import DownloadButton from '@/components/parts/DownloadButton.vue'
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { stateManager } from '@/projects/stateManager';

// Access state from params
const { inputVars, outputVars, values } = TruthTableProject.useState()

// Local model for the table component
const tableValues = ref<TruthTableData>(values ? values.value.map((row: TruthTableCell[]) => [...row]) : [])
let isUpdatingFromState = false

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
const truthTableRef = ref<InstanceType<typeof TruthTable> | null>(null)
const searchBarRef = ref<HTMLElement | null>(null)

// Search state
const searchInput = ref('')
const searchStep = ref<1 | 2>(1) // 1 = search for row, 2 = edit values
const highlightedRow = ref<number | null>(null)
const blinkGreenRow = ref<number | null>(null)
const inputRefs = ref<HTMLInputElement[]>([])

// Search hint
const searchHint = computed(() => {
  return searchStep.value === 1 ? 'Search' : 'Edit'
})

// Number of bits for current step
const numBits = computed(() => {
  return searchStep.value === 1 ? inputVars.value.length : outputVars.value.length
})

// Helper to update individual bit at index
function updateBitAtIndex(index: number, value: string) {
  const chars = searchInput.value.split('')
  // Ensure array is long enough
  while (chars.length <= index) {
    chars.push('')
  }
  chars[index] = value
  searchInput.value = chars.join('')
  console.log('[updateBitAtIndex] new searchInput:', searchInput.value)
}

// Get value at index
function getValueAtIndex(index: number): string {
  const val = searchInput.value[index] || ''
  return val
}

// Focus the first empty input field
function focusFirstEmpty() {
  nextTick(() => {
    for (let i = 0; i < inputRefs.value.length; i++) {
      if (!getValueAtIndex(i)) {
        inputRefs.value[i]?.focus()
        return
      }
    }
    // If all filled, focus the last one
    if (inputRefs.value.length > 0) {
      inputRefs.value[inputRefs.value.length - 1]?.focus()
    }
  })
}

// Handle input
function handleInput(index: number, e: Event) {
  const target = e.target as HTMLInputElement;
  // Get only the last character typed (handles replacement)
  const newChar = target.value.slice(-1);
  const filtered = newChar.replace(/[^01]/g, '');

  // Update the value at this index
  updateBitAtIndex(index, filtered);

  // Force update the input field value
  target.value = filtered;

  if (filtered && index < numBits.value - 1) {
    console.log('[handleInput] moving to next input, index + 1 =', index + 1)
    // Move to next input
    nextTick(() => {
      inputRefs.value[index + 1]?.focus();
    });
  }
}

// Handle backspace
function handleBackspace(index: number, e: KeyboardEvent) {
  if (!getValueAtIndex(index) && index > 0) {
    updateBitAtIndex(index - 1, '');
    inputRefs.value[index - 1]?.focus();
  } else {
    updateBitAtIndex(index, '');
  }
}

// Reset search
function resetSearch(shouldRefocus: boolean = false) {
  searchInput.value = ''
  searchStep.value = 1
  highlightedRow.value = null
  if (shouldRefocus) {
    nextTick(() => {
      inputRefs.value[0]?.focus()
    })
  } else {
    // Blur the currently focused input
    document.activeElement instanceof HTMLElement && document.activeElement.blur()
  }
}

// Handle blur - reset search only if focus left the container
function handleBlur(e: FocusEvent) {
  // Check if the new focus target is still within the search container
  const relatedTarget = e.relatedTarget as HTMLElement
  const currentTarget = e.currentTarget as HTMLElement

  if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
    // Focus left the container entirely
    resetSearch(false)
  }
}

// Handle click outside to reset search
function handlePanelClick(e: MouseEvent) {
  if (!searchBarRef.value) {
    return
  }

  const contains = searchBarRef.value.contains(e.target as Node)

  if (!contains) {
    resetSearch(false)
  }
}

// Auto-advance when input is complete
watch(searchInput, (newValue, oldValue) => {
  if (searchStep.value === 1 && newValue.length === inputVars.value.length) {
    console.log('[watch searchInput] Step 1 complete, moving to step 2')
    // Step 1 complete: move to step 2
    const rowIndex = parseInt(newValue, 2)
    if (rowIndex >= 0 && rowIndex < tableValues.value.length) {
      highlightedRow.value = rowIndex
      searchInput.value = ''
      searchStep.value = 2
    }
  } else if (searchStep.value === 2 && newValue.length === outputVars.value.length) {
    console.log('[watch searchInput] Step 2 complete, updating values')
    // Step 2 complete: update values and reset
    const rowIdx = highlightedRow.value
    if (rowIdx !== null) {
      const newValues = tableValues.value.map(row => [...row])
      const outputRow = newValues[rowIdx]
      if (outputRow) {
        for (let i = 0; i < newValue.length; i++) {
          const char = newValue[i]
          outputRow[i] = char === '1' ? 1 : char === '0' ? 0 : '-'
        }
        tableValues.value = newValues
        // Blink green
        blinkGreenRow.value = rowIdx
        setTimeout(() => {
          blinkGreenRow.value = null
        }, 300)
      }
    }
    resetSearch()
  }
})

// Auto-focus first input when step changes
watch(searchStep, () => {
  focusFirstEmpty()
})

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
      <DownloadButton :target-ref="screenshotRef" filename="truth-table" :latex-content="getTruthTableLatex()" />
    </div>
    <div ref="screenshotRef" class="flex-1 overflow-auto">
      <TruthTable ref="truthTableRef" v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars"
        :highlighted-row="highlightedRow" :blink-green-row="blinkGreenRow" />
    </div>
  </div>
</template>

<style scoped></style>
