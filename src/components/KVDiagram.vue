<template>
  <div class="mt-8 font-mono" :key="renderKey">
    <div v-if="variables.length < 2 || variables.length > 4">
      Only 2, 3, or 4 variables are supported for KV-Diagrams.
    </div>
    <div
      v-else
      class="inline-grid grid-cols-[min-content_max-content] grid-rows-[min-content_max-content] select-none"
    >
      <!-- Top Header (Variables) -->
      <div class="col-start-2 row-start-1 flex">
        <!-- Spacer for the corner cell width -->
        <div class="w-14 shrink-0"></div>
        <!-- Centered label over data columns -->
        <div class="flex-1 flex justify-center items-end text-secondary-variant">
          <vue-latex :expression="topVariablesLabel" display-mode />
        </div>
      </div>

      <!-- Left Header (Variables) -->
      <div class="col-start-1 row-start-2 flex flex-col pr-2">
        <!-- Spacer for the header row height -->
        <div class="h-14 shrink-0"></div>
        <!-- Centered label next to data rows -->
        <div class="flex-1 flex items-center justify-end pr-2 text-secondary-variant">
          <vue-latex :expression="leftVariablesLabel" display-mode />
        </div>
      </div>

      <!-- The Grid -->
      <table class="col-start-2 row-start-2 border-collapse">
        <thead>
          <tr>
            <th class="border-none bg-transparent w-10 h-10 text-secondary-variant text-sm">
              <vue-latex :expression="formattedOutputVariable" display-mode />
            </th>
            <th
              v-for="(colCode, cIdx) in colCodes"
              :key="colCode"
              class="border border-b-4 border-primary bg-surface-1 text-primary-variant font-normal text-sm w-14 h-14 text-center"
              :class="{ 'border-l-4': cIdx === 0 }"
            >
              <vue-latex :expression="colCode" display-mode />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rowCode, rIdx) in rowCodes" :key="rowCode">
            <th
              class="border border-r-4 border-primary bg-surface-1 text-primary-variant font-normal text-sm w-14 text-center"
              :class="{ 'border-t-4': rIdx === 0 }"
            >
              <vue-latex :expression="rowCode" display-mode />
            </th>
            <td
              v-for="(colCode, cIdx) in colCodes"
              :key="colCode"
              class="relative border border-primary bg-surface-1 text-center transition-colors duration-100 select-none w-14 h-14"
              :class="
                isCellImmutable(rowCode, colCode)
                  ? 'cursor-not-allowed opacity-70'
                  : 'hover:bg-surface-3 cursor-pointer'
              "
              @click="toggleCell(rowCode, colCode)"
            >
              <!-- Highlights -->
              <div class="absolute inset-0 pointer-events-none">
                <div
                  v-for="(highlight, idx) in getHighlights(rIdx, cIdx)"
                  :key="idx"
                  class="absolute transition-all duration-100"
                  :style="highlight.style"
                ></div>
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
import { computed, nextTick, ref } from 'vue'
import { defaultFunctionType } from '../utility/types'
import {
  getRowCodes,
  getColCodes,
} from '@/utility/truthtable/kvDiagramLayout'
import {
  formatGroupedVariablesForLatex,
  formatVariableForLatex,
  getRowIndexFromCodes,
  resolveAxisVariables,
} from '@/utility/truthtable/kvDiagramVariableGrouping'
import { calculateHighlights } from '@/utility/truthtable/kvDiagramHighlights'
import type {
  TruthTableCell,
  TruthTableState,
} from '@/projects/truth-table/TruthTableProject'

type KVDiagramProps = TruthTableState & {
  automatonModeEnabled?: boolean
  immutableCellMask?: boolean[][]
}

interface KVDiagramCellChange {
  rowIndex: number
  outputIndex: number
  value: TruthTableCell
}

const props = defineProps<KVDiagramProps>()

const emit = defineEmits<{
  (e: 'valuesChanged', value: KVDiagramCellChange): void
}>()

const variables = computed(() => props.inputVars || [])
const axisVariables = computed(() => resolveAxisVariables(variables.value))
const leftVariables = computed(() => axisVariables.value.left)
const topVariables = computed(() => axisVariables.value.top)
const rowCodes = computed(() => getRowCodes(variables.value.length))
const colCodes = computed(() => getColCodes(variables.value.length))
const axisOrderedVariables = computed(() => [...leftVariables.value, ...topVariables.value])

const topVariablesLabel = computed(() => formatGroupedVariablesForLatex(topVariables.value))
const leftVariablesLabel = computed(() => formatGroupedVariablesForLatex(leftVariables.value))
const formattedOutputVariable = computed(() => {
  const raw = props.outputVars[props.outputVariableIndex ?? 0] || 'f'
  return formatVariableForLatex(raw)
})

const getValue = (rowCode: string, colCode: string) => {
  if (!props.values) return '-'

  const rowIndex = getRowIndexFromCodes(
    rowCode,
    colCode,
    axisOrderedVariables.value,
    variables.value,
  )
  const outputIdx = props.outputVariableIndex ?? 0

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    return props.values[rowIndex]?.[outputIdx] ?? '-'
  }
  return '-'
}

const toggleCell = (rowCode: string, colCode: string) => {
  if (!props.values) return

  const rowIndex = getRowIndexFromCodes(
    rowCode,
    colCode,
    axisOrderedVariables.value,
    variables.value,
  )
  const outputIdx = props.outputVariableIndex ?? 0

  if (isCellImmutableByIndex(rowIndex, outputIdx)) return

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    const row = props.values[rowIndex]
    if (row) {
      const current = row[outputIdx]
      let next: TruthTableCell = 0
      if (current === 0) next = 1
      else if (current === 1) next = '-'
      else next = 0

      emit('valuesChanged', {
        rowIndex,
        outputIndex: outputIdx,
        value: next,
      })
    }
  }
}

const isCellImmutableByIndex = (rowIndex: number, outputIdx: number): boolean => {
  if (props.immutableCellMask?.[rowIndex]?.[outputIdx]) return true
  if (!props.automatonModeEnabled) return false
  return false
}

const isCellImmutable = (rowCode: string, colCode: string): boolean => {
  const rowIndex = getRowIndexFromCodes(
    rowCode,
    colCode,
    axisOrderedVariables.value,
    variables.value,
  )
  const outputIdx = props.outputVariableIndex ?? 0

  if (Number.isNaN(rowIndex) || rowIndex < 0) return false
  return isCellImmutableByIndex(rowIndex, outputIdx)
}

const getHighlights = (rIdx: number, cIdx: number) => {
  if (!props.selectedFormula) return []

  const functionType = props.functionType || defaultFunctionType
  const outputVar = props.outputVars[props.outputVariableIndex]
  if (!outputVar) return []

  return calculateHighlights(
    rIdx,
    cIdx,
    rowCodes.value,
    colCodes.value,
    props.selectedFormula.terms,
    functionType,
    axisOrderedVariables.value,
    props.formulaTermColors || [],
  )
}

const renderKey = ref(0)

const refresh = async () => {
  await nextTick()
  renderKey.value++
}

defineExpose({ refresh })
</script>
