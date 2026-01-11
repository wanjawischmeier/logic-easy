<template>
  <div ref="containerRef"
    :class="['w-full h-full overflow-auto flex', centeredHorizontally ? 'justify-center' : 'justify-start', centeredVertically ? ' items-center' : 'items-start']">
    <table v-if="modelValue.length && inputVars.length && outputVars.length" ref="tableRef"
      class="bg-surface-1 border border-primary table-fixed w-auto select-none">
      <thead>
        <tr>
          <th v-for="(input, idx) in displayedInputVars" :key="input"
            class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1 w-16"
            :class="{ 'border-r-4': idx === displayedInputVars.length - 1, 'border-r': idx !== displayedInputVars.length - 1 }">
            <vue-latex :expression="input" display-mode />
          </th>
          <th v-for="output in displayedOutputVars" :key="output"
            class="px-3 text-primary-variant border-b-4 border-primary bg-surface-1 border-r last:border-r-0 w-24">
            <vue-latex :expression="output" display-mode />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="displayRowIdx in numDisplayedRows" :key="displayRowIdx"
          :ref="el => { if (el) rowRefs[displayRowIdx] = el as HTMLElement }" :class="{
            'bg-yellow-200/50': highlightedRow === getOriginalRowIndex(displayRowIdx - 1),
            'bg-green-200/50': blinkGreenRow === getOriginalRowIndex(displayRowIdx - 1)
          }" class="transition-colors duration-300">
          <!-- Generated Input Columns -->
          <td v-for="(input, displayIdx) in displayedInputVars" :key="'in-' + displayIdx"
            class="text-lg font-mono text-center align-middle border-b border-primary transition-colors duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== getOriginalRowIndex(displayRowIdx - 1) && blinkGreenRow !== getOriginalRowIndex(displayRowIdx - 1),
              'border-r-4': displayIdx === displayedInputVars.length - 1,
              'border-r': displayIdx !== displayedInputVars.length - 1
            }">
            <div class="flex-1 flex items-center justify-center">
              <vue-latex :fontsize=12 :expression="getDisplayedInputValue(displayRowIdx - 1, displayIdx).toString()"
                display-mode />
            </div>
          </td>
          <!-- Editable Output Columns -->
          <td v-for="(item, idx) in getDisplayedOutputCells(modelValue[getOriginalRowIndex(displayRowIdx - 1)])"
            :key="'out-' + item.actualIndex"
            class="text-lg font-mono text-center align-middle cursor-pointer hover:bg-surface-3 border-b border-primary transition-color duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== getOriginalRowIndex(displayRowIdx - 1) && blinkGreenRow !== getOriginalRowIndex(displayRowIdx - 1),
              'border-r': idx !== getDisplayedOutputCells(modelValue[getOriginalRowIndex(displayRowIdx - 1)]).length - 1
            }" @click="toggleCell(getOriginalRowIndex(displayRowIdx - 1), item.actualIndex)">
            <div class="flex-1 flex items-center justify-center">
              <vue-latex :fontsize=12 :expression="item.cell.toString()" display-mode />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="p-4">No data :/</div>
  </div>
</template>

<script setup lang="ts">
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { getAllMatchingRows } from '@/utility/truthtable/rowMatching'


const props = defineProps<{
  inputVars: string[]
  outputVars: string[]
  modelValue: TruthTableData
  highlightedRow?: number | null
  blinkGreenRow?: number | null
  showAllOutputVars?: boolean
  outputVariableIndex?: number
  inputSelection?: boolean[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: TruthTableData): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const tableRef = ref<HTMLElement | null>(null)
const rowRefs = ref<Record<number, HTMLElement>>({})
const centeredHorizontally = ref(true)
const centeredVertically = ref(true)

const displayedOutputVars = computed(() => {
  if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
    return [props.outputVars[props.outputVariableIndex]]
  }
  return props.outputVars
})

const displayedInputVars = computed(() => {
  if (!props.inputSelection) return props.inputVars
  return props.inputVars.filter((_, idx) => props.inputSelection![idx])
})

const selectedInputIndices = computed(() => {
  if (!props.inputSelection) return props.inputVars.map((_, idx) => idx)
  return props.inputVars.map((_, idx) => idx).filter(idx => props.inputSelection![idx])
})

// Calculate number of rows based on selected inputs
const numDisplayedRows = computed(() => {
  return Math.pow(2, displayedInputVars.value.length)
})

// Map display row index to original row index
function getOriginalRowIndex(displayRowIdx: number): number {
  if (!props.inputSelection || selectedInputIndices.value.length === props.inputVars.length) {
    return displayRowIdx
  }

  // Build the full input pattern with unselected bits at 0
  let originalRowIdx = 0
  for (let i = 0; i < selectedInputIndices.value.length; i++) {
    const bitValue = (displayRowIdx >> (selectedInputIndices.value.length - 1 - i)) & 1
    const actualInputIdx = selectedInputIndices.value[i]
    if (bitValue === 1 && actualInputIdx !== undefined) {
      originalRowIdx |= (1 << (props.inputVars.length - 1 - actualInputIdx))
    }
  }
  return originalRowIdx
}

let containerObserver: ResizeObserver | null = null
let tableObserver: ResizeObserver | null = null

// Get displayed output cells based on showAllOutputVars
function getDisplayedOutputCells(row: any[] | undefined) {
  if (!row) return []
  if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
    return [{ cell: row[props.outputVariableIndex], actualIndex: props.outputVariableIndex, displayIndex: 0 }]
  }
  return row.map((cell, idx) => ({ cell, actualIndex: idx, displayIndex: idx }))
}

// colIdx is the index within the output array (modelValue[row])
function toggleCell(rowIdx: number, colIdx: number) {
  const newValues = props.modelValue.map(row => [...row])

  // If all inputs are selected, just toggle the single row
  if (!props.inputSelection || selectedInputIndices.value.length === props.inputVars.length) {
    const row = newValues[rowIdx]
    if (!row) return

    const current = row[colIdx]
    if (current === undefined) return

    if (current === 0) row[colIdx] = 1
    else if (current === 1) row[colIdx] = '-'
    else row[colIdx] = 0
  } else {
    // When fewer inputs are selected, toggle ALL rows that match the selected input pattern
    const rowsToToggle = getAllMatchingRows(
      rowIdx,
      props.inputVars.length,
      props.modelValue.length,
      props.inputSelection
    )

    // Get the current value from the first matching row to determine next state
    const firstRowIdx = rowsToToggle[0]
    if (firstRowIdx === undefined) return
    const firstRow = newValues[firstRowIdx]
    if (!firstRow) return
    const current = firstRow[colIdx]
    if (current === undefined) return

    let newValue: 0 | 1 | '-'
    if (current === 0) newValue = 1
    else if (current === 1) newValue = '-'
    else newValue = 0

    // Apply the new value to all matching rows
    for (const matchingRowIdx of rowsToToggle) {
      const row = newValues[matchingRowIdx]
      if (row) {
        row[colIdx] = newValue
      }
    }
  }

  emit('update:modelValue', newValues)
}

function getDisplayedInputValue(displayRowIdx: number, displayColIdx: number) {
  // displayRowIdx is the row in the compact table (0 to 2^selectedInputs - 1)
  // displayColIdx is the column in the displayed inputs (0 to selectedInputs.length - 1)
  const shiftAmount = displayedInputVars.value.length - 1 - displayColIdx
  return (displayRowIdx >> shiftAmount) & 1
}

function getInputValue(rowIdx: number, colIdx: number) {
  // MSB is at index 0
  const shiftAmount = props.inputVars.length - 1 - colIdx;
  return (rowIdx >> shiftAmount) & 1;
}

function updateCentered() {
  const c = containerRef.value
  const t = tableRef.value
  if (!c || !t) {
    centeredHorizontally.value = true
    centeredVertically.value = true
    return
  }
  // If table height fits, center it. Otherwise align to allow scrolling
  centeredHorizontally.value = t.scrollWidth <= c.clientWidth
  centeredVertically.value = t.scrollHeight <= c.clientHeight
}

onMounted(() => {
  // Wait for DOM updates then compute
  nextTick(updateCentered)

  if (containerRef.value) {
    containerObserver = new ResizeObserver(() => nextTick(updateCentered))
    containerObserver.observe(containerRef.value)
  }
  if (tableRef.value) {
    tableObserver = new ResizeObserver(() => nextTick(updateCentered))
    tableObserver.observe(tableRef.value)
  }
})

onBeforeUnmount(() => {
  containerObserver?.disconnect()
  tableObserver?.disconnect()
})

// Recompute whenever data changes
watch(
  () => [props.modelValue, props.inputVars, props.outputVars],
  () => nextTick(updateCentered),
  { deep: true }
)

// Scroll highlighted row into view
watch(() => props.highlightedRow, (rowIdx) => {
  if (typeof rowIdx === 'number' && rowRefs.value[rowIdx]) {
    nextTick(() => {
      rowRefs.value[rowIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
</script>
