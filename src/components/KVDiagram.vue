<template>
  <div class="mt-8 font-mono" :key="renderKey">
    <div v-if="variables.length < 2 || variables.length > 6">
      Only 2 to 6 variables are supported for KV-Diagrams.
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
          <vue-latex
            :expression="topVariables.map((v) => formatLatexIdentifier(v)).join('\\,')"
            display-mode
          />
        </div>
      </div>

      <!-- Left Header (Variables) -->
      <div class="col-start-1 row-start-2 flex flex-col pr-2">
        <!-- Spacer for the header row height -->
        <div class="h-14 shrink-0"></div>
        <!-- Centered label next to data rows -->
        <div class="flex-1 flex items-center justify-end pr-2 text-secondary-variant">
          <vue-latex
            :expression="leftVariables.map((v) => formatLatexIdentifier(v)).join('\\,')"
            display-mode
          />
        </div>
      </div>

      <!-- The Grid -->
      <table class="col-start-2 row-start-2 border-collapse">
        <thead>
          <tr>
            <th class="border-none bg-transparent w-10 h-10 text-secondary-variant text-sm">
              <vue-latex
                :expression="
                  formatLatexIdentifier(
                    (outputVarLabels?.[outputVariableIndex ?? 0] ??
                      outputVars[outputVariableIndex ?? 0]) ||
                      'f',
                  )
                "
                display-mode
              />
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
              class="relative border border-primary bg-surface-1 text-center hover:bg-surface-3 transition-colors duration-100 cursor-pointer select-none w-14 h-14"
              @click="toggleCell(rowCode, colCode)"
            >
              <!-- Highlights -->
              <div
                v-if="functionRepresentation == 'Minimal'"
                class="absolute inset-0 pointer-events-none"
              >
                <div
                  v-for="(highlight, idx) in getHighlights(rIdx, cIdx)"
                  :key="idx"
                  class="absolute transition-all duration-100"
                  :style="highlight.style"
                ></div>
              </div>
              <!-- Content -->
              <div class="relative z-10 flex items-center justify-center h-full">
                <span class="kv-cell-value">{{ getValue(rowCode, colCode) }}</span>
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
import {
  Formula,
  FunctionType,
  defaultFunctionType,
  type FunctionRepresentation,
} from '../utility/types'
import {
  getLeftVariables,
  getTopVariables,
  getRowCodes,
  getColCodes,
  getBinaryString,
} from '@/utility/truthtable/kvDiagramLayout'
import { calculateHighlightGrid } from '@/utility/truthtable/kvDiagramHighlights'
import { formatLatexIdentifier } from '@/utility/truthtable/latexGenerator'
import type { TruthTableData, TruthTableCell } from '@/projects/truth-table/TruthTableProject'
import type { QMCResult } from '@/utility/truthtable/minimizer'
import type { TermColor } from '@/utility/truthtable/colorGenerator'

type KVDiagramProps = {
  inputVars: string[]
  outputVars: string[]
  inputVarLabels?: string[]
  outputVarLabels?: string[]
  values: TruthTableData
  formulas: Record<string, Formula>
  outputVariableIndex: number
  functionType: FunctionType
  functionRepresentation: FunctionRepresentation
  qmcResult?: QMCResult
  selectedFormula?: Formula
  formulaTermColors?: TermColor[]
  variationIndex?: number
  immutableCellMask?: boolean[][]
}

const props = defineProps<KVDiagramProps>()

const emit = defineEmits<{
  (e: 'valuesChanged', value: TruthTableData): void
}>()

const variables = computed(() => props.inputVars || [])
const displayVariables = computed(() => props.inputVarLabels ?? props.inputVars ?? [])
const leftVariables = computed(() => getLeftVariables(displayVariables.value))
const topVariables = computed(() => getTopVariables(displayVariables.value))
const rowCodes = computed(() => getRowCodes(variables.value.length))
const colCodes = computed(() => getColCodes(variables.value.length))

const getValue = (rowCode: string, colCode: string) => {
  if (!props.values) return '-'

  const binaryString = getBinaryString(rowCode, colCode)
  const rowIndex = parseInt(binaryString, 2)
  const outputIdx = props.outputVariableIndex ?? 0

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    return props.values[rowIndex]?.[outputIdx] ?? '-'
  }
  return '-'
}

const toggleCell = (rowCode: string, colCode: string) => {
  if (!props.values) return

  const binaryString = getBinaryString(rowCode, colCode)
  const rowIndex = parseInt(binaryString, 2)
  const outputIdx = props.outputVariableIndex ?? 0

  if (rowIndex >= 0 && rowIndex < props.values.length) {
    const newValues = props.values.map((row) => [...row])
    const row = newValues[rowIndex]
    if (row) {
      const current = row[outputIdx]
      let next: TruthTableCell = 0
      if (current === 0) next = 1
      else if (current === 1) next = '-'
      else next = 0

      row[outputIdx] = next
      emit('valuesChanged', newValues)
    }
  }
}

const isCellImmutableByIndex = (rowIndex: number, outputIdx: number): boolean => {
  return !!props.immutableCellMask?.[rowIndex]?.[outputIdx]
}

const isCellImmutable = (rowCode: string, colCode: string): boolean => {
  const binaryString = getBinaryString(rowCode, colCode)
  const rowIndex = parseInt(binaryString, 2)
  const outputIdx = props.outputVariableIndex ?? 0

  if (Number.isNaN(rowIndex) || rowIndex < 0) return false
  return isCellImmutableByIndex(rowIndex, outputIdx)
}

// Compute the whole highlight grid once per render instead of per cell.
const highlightGrid = computed(() => {
  if (props.functionRepresentation !== 'Minimal' || !props.selectedFormula) return []
  if (!props.outputVars[props.outputVariableIndex]) return []

  return calculateHighlightGrid(
    rowCodes.value,
    colCodes.value,
    props.selectedFormula.terms,
    props.functionType || defaultFunctionType,
    props.inputVars,
    props.formulaTermColors || [],
  )
})

const getHighlights = (rIdx: number, cIdx: number) => highlightGrid.value[rIdx]?.[cIdx] ?? []

const renderKey = ref(0)

const refresh = async () => {
  await nextTick()
  renderKey.value++
}

defineExpose({ refresh })
</script>

<style scoped>
.kv-cell-value {
  font-family: KaTeX_Main, serif;
  font-size: 1rem;
}
</style>
