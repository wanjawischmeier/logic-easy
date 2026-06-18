<template>
  <div
    ref="containerRef"
    :class="[
      'w-full h-full overflow-auto flex',
      centeredHorizontally ? 'justify-center' : 'justify-start',
      centeredVertically ? ' items-center' : 'items-start',
    ]"
  >
    <table
      v-if="modelValue.length && inputVars.length && outputVars.length"
      ref="tableRef"
      class="bg-surface-1 border border-primary table-fixed w-auto select-none"
    >
      <thead>
        <tr>
          <th
            class="px-3 text-secondary-variant border-b-4 border-r-4 border-primary bg-surface-1 w-12"
          >
            #
          </th>
          <th
            v-for="(input, idx) in inputVars"
            :key="input"
            class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1 w-16"
            :class="{
              'border-r-4': idx === inputVars.length - 1,
              'border-r': idx !== inputVars.length - 1,
            }"
          >
            <vue-latex :expression="input" display-mode />
          </th>
          <th
            v-for="output in displayedOutputVars"
            :key="output"
            class="px-3 text-primary-variant border-b-4 border-primary bg-surface-1 border-r w-24"
          >
            <vue-latex :expression="output" display-mode />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }">
          <td :colspan="inputVars.length + outputVars.length + 1" />
        </tr>
        <tr
          v-for="{ row, rowIdx } in visibleRows"
          :key="rowIdx"
          :class="{
            'bg-yellow-200/50': highlightedRow === rowIdx,
            'bg-green-200/50': blinkGreenRow === rowIdx,
          }"
          class="transition-colors duration-300"
        >
          <!-- Index Column -->
          <td
            class="px-3 py-1 text-sm font-mono text-center align-middle border-b border-r-4 border-primary transition-colors duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== rowIdx && blinkGreenRow !== rowIdx,
            }"
          >
            {{ rowIdx }}
          </td>
          <!-- Generated Input Columns -->
          <td
            v-for="(input, colIdx) in inputVars"
            :key="'in-' + colIdx"
            class="text-lg font-mono text-center align-middle border-b border-primary transition-colors duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== rowIdx && blinkGreenRow !== rowIdx,
              'border-r-4': colIdx === inputVars.length - 1,
              'border-r': colIdx !== inputVars.length - 1,
            }"
          >
            <div class="flex-1 flex items-center justify-center">
              <span class="tt-cell-value">{{ getInputValue(rowIdx, colIdx) }}</span>
            </div>
          </td>
          <!-- Editable Output Columns -->
          <td
            v-for="(item, idx) in getDisplayedOutputCells(row)"
            :key="'out-' + item.actualIndex"
            class="text-lg font-mono text-center align-middle cursor-pointer hover:bg-surface-3 border-b border-r border-primary transition-colors duration-300"
            :class="{
              'bg-surface-1': highlightedRow !== rowIdx && blinkGreenRow !== rowIdx,
            }"
            @click="toggleCell(rowIdx, item.actualIndex)"
          >
            <div class="flex-1 flex items-center justify-center">
              <span class="tt-cell-value">{{ item.cell }}</span>
            </div>
          </td>
        </tr>
        <tr v-if="bottomSpacerHeight" :style="{ height: bottomSpacerHeight + 'px' }">
          <td :colspan="inputVars.length + outputVars.length + 1" />
        </tr>
      </tbody>
    </table>
    <div v-else class="p-4">No data :/</div>
  </div>
</template>

<script setup lang="ts">
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject'
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
const centeredHorizontally = ref(true)
const centeredVertically = ref(true)

const scrollTop = ref(0)
const containerHeight = ref(600)
const rowHeight = ref(36)
let rowHeightMeasured = false
const BUFFER = 5

const startIdx = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - BUFFER))
const endIdx = computed(() =>
  Math.min(
    props.modelValue.length,
    Math.ceil((scrollTop.value + containerHeight.value) / rowHeight.value) + BUFFER,
  ),
)
const visibleRows = computed(() =>
  props.modelValue
    .slice(startIdx.value, endIdx.value)
    .map((row, i) => ({ row, rowIdx: startIdx.value + i })),
)
const topSpacerHeight = computed(() => startIdx.value * rowHeight.value)
const bottomSpacerHeight = computed(
  () => (props.modelValue.length - endIdx.value) * rowHeight.value,
)

const displayedOutputVars = computed(() => {
  if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
    return [props.outputVars[props.outputVariableIndex]]
  }
  return props.outputVars
})

let containerObserver: ResizeObserver | null = null
let tableObserver: ResizeObserver | null = null

function getDisplayedOutputCells(row: any[]) {
  if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
    return [
      {
        cell: row[props.outputVariableIndex],
        actualIndex: props.outputVariableIndex,
        displayIndex: 0,
      },
    ]
  }
  return row.map((cell, idx) => ({ cell, actualIndex: idx, displayIndex: idx }))
}

function toggleCell(rowIdx: number, colIdx: number) {
  const newValues = props.modelValue.map((row) => [...row])
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
  const shiftAmount = props.inputVars.length - 1 - colIdx
  return (rowIdx >> shiftAmount) & 1
}

function onScroll() {
  scrollTop.value = containerRef.value?.scrollTop ?? 0
}

function updateCentered() {
  const c = containerRef.value
  const t = tableRef.value
  if (!c || !t) {
    centeredHorizontally.value = true
    centeredVertically.value = true
    return
  }
  containerHeight.value = c.clientHeight
  if (c.scrollTop !== scrollTop.value) {
    c.scrollTop = scrollTop.value
  }
  if (!rowHeightMeasured) {
    const row = t.querySelector<HTMLElement>('tbody tr:not([style])')
    if (row?.offsetHeight) {
      rowHeight.value = row.offsetHeight
      rowHeightMeasured = true
    }
  }
  centeredHorizontally.value = t.scrollWidth <= c.clientWidth
  centeredVertically.value = t.scrollHeight <= c.clientHeight
}

onMounted(() => {
  nextTick(updateCentered)
  containerRef.value?.addEventListener('scroll', onScroll, { passive: true })
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
  containerRef.value?.removeEventListener('scroll', onScroll)
})

watch(
  () => [props.modelValue, props.inputVars, props.outputVars],
  () => nextTick(updateCentered),
  { deep: true },
)

watch(
  () => props.highlightedRow,
  (rowIdx) => {
    if (typeof rowIdx === 'number' && containerRef.value) {
      const top = rowIdx * rowHeight.value - containerHeight.value / 2 + rowHeight.value / 2
      containerRef.value.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  },
)
</script>

<style scoped>
.tt-cell-value {
  font-family: KaTeX_Main, serif;
  font-size: 1rem;
}
</style>
