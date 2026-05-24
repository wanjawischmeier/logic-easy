<template>
  <PopupBase :visible="true" title="Export VHDL (.vhdl)" :actions="actions" @close="onClose">
    <div class="flex flex-col gap-5 text-on-surface">
      <div class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Mode</label>
        <MultiSelectSwitch
          :values="modeOptions"
          :initialSelected="selectedModeIndex"
          :onSelect="onModeSelect"
        />
      </div>

      <div v-if="isBooleanMode" class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Boolean Type</label>
        <MultiSelectSwitch
          :values="functionTypeOptions"
          :initialSelected="selectedFunctionTypeIndex"
          :onSelect="onFunctionTypeSelect"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Output Variable</label>
        <MultiSelectSwitch
          :values="outputVarsList"
          :initialSelected="selectedOutputIndex"
          :onSelect="onOutputSelect"
        />
      </div>

      <div v-if="showVariationSelector" class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Variation</label>
        <FormulaSelector
          :formulas="currentVariationLatex"
          v-model:selectedIndex="selectedVariationIndex"
          :placement="'bottom'"
        />
      </div>
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import PopupBase from '@/components/popups/PopupBase.vue'
import { popupService } from '@/utility/popupService'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue'
import FormulaSelector from '@/components/parts/FormulaSelector.vue'
import { computed, ref } from 'vue'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { projectManager } from '@/projects/projectManager'
import {
  exportTruthTableTOVHDLcaseWhen,
  exportTruthTableTOVHDLboolExpr,
} from '@/utility/VHDL/export'
import { formulaToLatex } from '@/utility/truthtable/latexGenerator'
import { toRaw } from 'vue'
import type { Formula, FunctionType } from '@/utility/types'
import { useFormulaVariations } from '@/utility/truthtable/useFormulaVariations'

const {
  state,
  inputVars,
  outputVars,
  values,
  functionType,
  formulaVariations,
  outputVariableIndex,
} = TruthTableProject.useState()

const modeOptions = ['Case-When', 'Boolean']
const selectedModeIndex = ref(0)
const isBooleanMode = computed(() => modeOptions[selectedModeIndex.value] === 'Boolean')

const functionTypeOptions = ['Disjunctive', 'Conjunctive']
const selectedFunctionTypeIndex = ref(
  Math.max(0, functionTypeOptions.indexOf(functionType.value ?? 'Disjunctive')),
)

const outputVarsList = computed(() => outputVars.value)
const selectedOutputIndex = ref(outputVariableIndex.value ?? 0)

const selectedVariationIndex = ref(0)

const currentOutputVar = computed(() => outputVars.value[selectedOutputIndex.value])
const selectedFunctionType = computed(() =>
  selectedFunctionTypeIndex.value === 0 ? 'Disjunctive' : 'Conjunctive',
)

const { normalForm, minimalForm } = useFormulaVariations(formulaVariations, selectedFunctionType)

const currentVariationEntry = computed(() => {
  const out = currentOutputVar.value
  if (!out || !isBooleanMode.value) return undefined
  return minimalForm.value[out]
})

const currentVariationLatex = computed(
  () =>
    currentVariationEntry.value?.variations.map((variation) =>
      formulaToLatex(variation.formula),
    ) ?? [],
)

const showVariationSelector = computed(
  () => (currentVariationEntry.value?.variations?.length ?? 0) > 1,
)

function onModeSelect(_v: unknown, idx: number) {
  selectedModeIndex.value = idx
}

function onFunctionTypeSelect(_v: unknown, idx: number) {
  selectedFunctionTypeIndex.value = idx
}

function onOutputSelect(_v: unknown, idx: number) {
  selectedOutputIndex.value = idx
  selectedVariationIndex.value = 0
}

function onClose() {
  popupService.close()
}

function buildCanonicalFormulaForOutput(outIdx: number): Formula {
  const terms: Formula['terms'] = []
  const isDNF = functionTypeOptions[selectedFunctionTypeIndex.value] === 'Disjunctive'
  const targetValue = isDNF ? 1 : 0

  values.value.forEach((row, rowIdx) => {
    if (row[outIdx] === targetValue) {
      const literals = inputVars.value.map((inVar, inIdx) => {
        const bitValue = (rowIdx >> (inputVars.value.length - 1 - inIdx)) & 1
        const negated = isDNF ? bitValue === 0 : bitValue === 1
        return { variable: inVar, negated }
      })
      terms.push({ literals })
    }
  })

  return { type: functionTypeOptions[selectedFunctionTypeIndex.value] as FunctionType, terms }
}

function doExport() {
  const projectName = projectManager.getCurrentProject()?.name ?? 'logic-table'

  if (modeOptions[selectedModeIndex.value] === 'Case-When') {
    exportTruthTableTOVHDLcaseWhen(toRaw(state.value), projectName)
    popupService.close()
    return
  }

  // Boolean export - build a small truth table for the selected output
  const outIdx = selectedOutputIndex.value
  const outName = outputVars.value[outIdx]
  const selectedVariationEntry = currentVariationEntry.value

  let selectedFormula: Formula | undefined

  if (selectedVariationEntry && (selectedVariationEntry.variations?.length ?? 0) > 0) {
    selectedFormula = selectedVariationEntry.variations[selectedVariationIndex.value]?.formula
  }

  if (!selectedFormula || !Array.isArray(selectedFormula.terms)) {
    // fallback to canonical
    selectedFormula = buildCanonicalFormulaForOutput(outIdx)
  }

  const smallFormulas: Record<string, Formula> = {}
  if (outName && selectedFormula) smallFormulas[outName] = selectedFormula

  const smallTruthTable = {
    inputVars: toRaw(inputVars.value),
    outputVars: [outName],
    values: values.value.map((row: any[]) => [row[outIdx]]),
    formulas: smallFormulas,
    selectedFormula: selectedFormula,
    outputVariableIndex: 0,
    functionType: functionTypeOptions[selectedFunctionTypeIndex.value] as FunctionType,
    functionRepresentation: 'Minimal' as any,
  }

  exportTruthTableTOVHDLboolExpr(
    smallTruthTable as any,
    projectName,
    selectedFunctionTypeIndex.value === 0 ? 'dnf' : 'cnf',
  )
  popupService.close()
}

const actions = [
  { type: 'DEFAULT' as const, label: 'Cancel', onClick: onClose },
  { type: 'SUBMIT' as const, label: 'Export', onClick: doExport },
]
</script>

<style scoped></style>
