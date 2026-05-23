<template>
  <PopupBase :visible="true" title="Export LogicCircuits (.lc)" :actions="actions" @close="onClose">
    <div class="flex flex-col gap-5 text-on-surface">
      <div class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Gate Type</label>
        <MultiSelectSwitch
          :values="methodOptions"
          :initialSelected="selectedMethodIndex"
          :onSelect="onMethodSelect"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Function Type</label>
        <MultiSelectSwitch
          :values="functionTypeOptions"
          :initialSelected="selectedFunctionTypeIndex"
          :onSelect="onFunctionTypeSelect"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <label class="text-sm text-secondary-variant">Representation</label>
        <MultiSelectSwitch
          :values="representationOptions"
          :initialSelected="selectedRepresentationIndex"
          :onSelect="onRepresentationSelect"
        />
      </div>

      <div
        v-for="row in variationRows"
        :key="row.outputVar"
        class="flex items-center justify-between gap-4"
      >
        <label class="text-sm text-secondary-variant">Variation: {{ row.outputVar }}</label>
        <FormulaSelector
          :formulas="row.formulas"
          :placement="'bottom'"
          :selectedIndex="selectedVariationIndices[row.outputVar] ?? 0"
          @update:selectedIndex="(value) => setSelectedVariationIndex(row.outputVar, value)"
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
import { computed, reactive, ref } from 'vue'
import { formulaToLatex } from '@/utility/truthtable/latexGenerator'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { projectManager } from '@/projects/projectManager'
import type { Formula, FunctionType } from '@/utility/types'
import { Toast } from '@/utility/toastService'

const { inputVars, outputVars, values, functionType, functionRepresentation, formulaVariations } =
  TruthTableProject.useState()

const methodOptions = ['AND/OR', 'NAND', 'NOR']
const selectedMethodIndex = ref(0)

const functionTypeOptions = ['Disjunctive', 'Conjunctive']
const selectedFunctionTypeIndex = ref(
  Math.max(0, functionTypeOptions.indexOf(functionType.value ?? 'Disjunctive')),
)

const representationOptions = ['Normal', 'Minimal']
const selectedRepresentationIndex = ref(
  Math.max(0, representationOptions.indexOf(functionRepresentation.value ?? 'Minimal')),
)

const selectedVariationIndices = reactive<Record<string, number>>({})

type VariationRow = { outputVar: string; formulas: string[] }

const variationRows = computed<VariationRow[]>(() =>
  representationOptions[selectedRepresentationIndex.value] === 'Normal'
    ? []
    : outputVars.value.flatMap((outputVar) => {
        const variations = formulaVariations.value?.[outputVar]?.variations ?? []
        if (variations.length <= 1) return []

        return [
          {
            outputVar,
            formulas: variations.map((variation) => formulaToLatex(variation.formula)),
          },
        ]
      }),
)

function onMethodSelect(_value: unknown, idx: number) {
  selectedMethodIndex.value = idx
}

function onFunctionTypeSelect(_value: unknown, idx: number) {
  selectedFunctionTypeIndex.value = idx
}

function onRepresentationSelect(_value: unknown, idx: number) {
  selectedRepresentationIndex.value = idx
}

function onClose() {
  popupService.close()
}

function generateCanonicalFormulas(selectedType: FunctionType): Record<string, Formula> {
  const canonicalFormulas: Record<string, Formula> = {}

  outputVars.value.forEach((outVar, outIdx) => {
    const terms: Formula['terms'] = []
    const isDNF = selectedType === 'Disjunctive'
    const targetValue = isDNF ? 1 : 0

    values.value.forEach((row, rowIdx) => {
      if (row[outIdx] === targetValue) {
        const literals = inputVars.value.map((inputVar, inputIdx) => {
          const bitValue = (rowIdx >> (inputVars.value.length - 1 - inputIdx)) & 1
          const negated = isDNF ? bitValue === 0 : bitValue === 1
          return { variable: inputVar, negated }
        })
        terms.push({ literals })
      }
    })

    canonicalFormulas[outVar] = { type: selectedType, terms }
  })

  return canonicalFormulas
}

function buildExportFormulas(): Record<string, Formula> {
  const selectedType = (functionTypeOptions[selectedFunctionTypeIndex.value] ??
    'Disjunctive') as FunctionType
  const selectedRepresentation =
    representationOptions[selectedRepresentationIndex.value] ?? 'Minimized'

  if (selectedRepresentation === 'Normal') {
    return generateCanonicalFormulas(selectedType)
  }

  const baseFormulas: Record<string, Formula> = {}
  let missingVariation = false

  outputVars.value.forEach((outputVar) => {
    const entry = formulaVariations.value?.[outputVar]
    const selectedIndex = selectedVariationIndices[outputVar] ?? 0
    const selectedVariation = entry?.variations[selectedIndex] ?? entry?.variations[0]
    if (selectedVariation) {
      baseFormulas[outputVar] = selectedVariation.formula
      return
    }

    missingVariation = true
  })

  if (missingVariation) {
    return {}
  }

  return baseFormulas
}

function doExport() {
  const outType =
    methodOptions[selectedMethodIndex.value] === 'NAND'
      ? 'nand'
      : methodOptions[selectedMethodIndex.value] === 'NOR'
        ? 'nor'
        : 'and-or'

  const exportFormulas = buildExportFormulas()
  if (Object.keys(exportFormulas).length === 0 && selectedRepresentationIndex.value !== 0) {
    Toast.warning('No variations available for this export.')
    return
  }

  const lc = formulaToLC(exportFormulas, inputVars.value, outputVars.value, outType)

  const blob = new Blob([lc.toString()], { type: 'text/lc' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const projectName = projectManager.getCurrentProject()?.name ?? 'logic-circuit'
  link.download = `${projectName}.lc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  popupService.close()
}

function setSelectedVariationIndex(outputVar: string, index: number) {
  selectedVariationIndices[outputVar] = index
}

const actions = [
  { type: 'DEFAULT' as const, label: 'Cancel', onClick: onClose },
  { type: 'SUBMIT' as const, label: 'Export', onClick: doExport },
]
</script>

<style scoped></style>
