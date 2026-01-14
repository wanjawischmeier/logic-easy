<template>
  <div ref="containerRef"
    :class="['w-full h-full overflow-auto flex', centeredHorizontally ? 'justify-center' : 'justify-start', centeredVertically ? ' items-center' : 'items-start']">
    <table v-if="modelValue.length && inputVars.length && outputVars.length" ref="tableRef"
      class="bg-surface-1 border border-primary table-fixed w-auto select-none">
      <thead>
        <tr>
          <th v-for="(input, idx) in inputVars" :key="input"
            class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1 w-16"
            :class="{ 'border-r-4': idx === inputVars.length - 1, 'border-r': idx !== inputVars.length - 1 }">
            <vue-latex :expression="input" display-mode />
          </th>
          <th v-for="output in displayedOutputVars" :key="output"
            class="px-3 text-primary-variant border-b-4 border-primary bg-surface-1 border-r last:border-r-0 w-24">
            <vue-latex :expression="output" display-mode />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIdx) in modelValue" :key="rowIdx"
          :ref="el => { if (el) rowRefs[rowIdx] = el as HTMLElement }" :class="{
            'bg-yellow-200/50': highlightedRow === rowIdx,
            'bg-green-200/50': blinkGreenRow === rowIdx
          }" class="transition-colors duration-300">
          <!-- Generated Input Columns -->
          <td v-for="(input, colIdx) in inputVars" :key="'in-' + colIdx"
            class="text-lg font-mono text-center align-middle border-b border-primary transition-colors duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== rowIdx && blinkGreenRow !== rowIdx,
              'border-r-4': colIdx === inputVars.length - 1,
              'border-r': colIdx !== inputVars.length - 1
            }">
            <div class="flex-1 flex items-center justify-center">
              <vue-latex :fontsize=12 :expression="getInputValue(rowIdx, colIdx).toString()" display-mode />
            </div>
          </td>
          <!-- Editable Output Columns -->
          <td v-for="(item, idx) in getDisplayedOutputCells(row)" :key="'out-' + item.actualIndex"
            class="text-lg font-mono text-center align-middle cursor-pointer hover:bg-surface-3 border-b border-primary transition-color duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== rowIdx && blinkGreenRow !== rowIdx,
              'border-r': idx !== getDisplayedOutputCells(row).length - 1
            }" @click="toggleCell(rowIdx, item.actualIndex)">
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


const props = defineProps<{
  inputVars: string[]
  outputVars: string[]
  modelValue: TruthTableData
  highlightedRow?: number | null
  blinkGreenRow?: number | null
  showAllOutputVars?: boolean
  outputVariableIndex?: number
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

let containerObserver: ResizeObserver | null = null
let tableObserver: ResizeObserver | null = null

// Get displayed output cells based on showAllOutputVars
function getDisplayedOutputCells(row: any[]) {
  if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
    return [{ cell: row[props.outputVariableIndex], actualIndex: props.outputVariableIndex, displayIndex: 0 }]
  }
  return row.map((cell, idx) => ({ cell, actualIndex: idx, displayIndex: idx }))
}

// colIdx is the index within the output array (modelValue[row])
function toggleCell(rowIdx: number, colIdx: number) {
  const newValues = props.modelValue.map(row => [...row])
  const row = newValues[rowIdx]
  if (!row) return

  const current = row[colIdx]
  if (current === undefined) return

  if (current === 0) row[colIdx] = 1
  else if (current === 1) row[colIdx] = '-'
  else row[colIdx] = 0

  emit('update:modelValue', newValues)
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
