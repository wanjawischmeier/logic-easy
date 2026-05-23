<template>
  <PopupBase :visible="true" title="Export LogicCircuits (.lc)" :actions="actions" @close="onClose">
    <div class="flex flex-col gap-4 text-on-surface">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm text-secondary-variant">Gate Type</label>
          <MultiSelectSwitch
            :values="methodOptions"
            :initialSelected="methodIndex"
            :onSelect="onMethodSelect"
          />
        </div>

        <div>
          <label class="text-sm text-secondary-variant">Function Type</label>
          <MultiSelectSwitch
            :values="functionTypeOptions"
            :initialSelected="functionTypeIndex"
            :onSelect="onFunctionTypeSelect"
          />
        </div>

        <div>
          <label class="text-sm text-secondary-variant">Representation</label>
          <MultiSelectSwitch
            :values="representationOptions"
            :initialSelected="representationIndex"
            :onSelect="onRepresentationSelect"
          />
        </div>

        <div>
          <label class="text-sm text-secondary-variant">Selected Variation</label>
          <FormulaSelector
            v-if="variationLatex.length"
            :formulas="variationLatex"
            v-model:selectedIndex="selectedVariationIndex"
          />
        </div>
      </div>

      <div class="text-sm text-secondary-variant">
        Export will use the selected variation for the active output variable.
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
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { projectManager } from '@/projects/projectManager'

const {
  inputVars,
  outputVars,
  formulas,
  functionType,
  functionRepresentation,
  formulaVariations,
  outputVariableIndex,
} = TruthTableProject.useState()

const methodOptions = ['AND/OR', 'NAND', 'NOR']
const methodIndex = 0
const selectedMethodIndex = ref(0)

const functionTypeOptions = ['Disjunctive', 'Conjunctive']
const functionTypeIndex = functionTypeOptions.indexOf(functionType.value ?? 'Disjunctive')
const selectedFunctionTypeIndex = ref(functionTypeIndex >= 0 ? functionTypeIndex : 0)

const representationOptions = ['Normal', 'Minimized']
const representationIndex = representationOptions.indexOf(
  functionRepresentation.value ?? 'Minimized',
)
const selectedRepresentationIndex = ref(representationIndex >= 0 ? representationIndex : 1)

const selectedVariationIndex = ref(0)

const variationLatex = computed(
  () =>
    formulaVariations?.value?.variations.map((v) =>
      v && v.formula ? JSON.stringify(v.formula) : '',
    ) ?? [],
)

function onMethodSelect(value: unknown, idx: number) {
  selectedMethodIndex.value = idx
}

function onFunctionTypeSelect(value: unknown, idx: number) {
  selectedFunctionTypeIndex.value = idx
}

function onRepresentationSelect(value: unknown, idx: number) {
  selectedRepresentationIndex.value = idx
}

function onClose() {
  popupService.close()
}

function doExport() {
  // Build base formulas map
  const outType =
    selectedMethodIndex.value === 0 ? 'and-or' : selectedMethodIndex.value === 1 ? 'nand' : 'nor'

  const baseFormulas: Record<string, any> =
    representationOptions[selectedRepresentationIndex.value] === 'Normal'
      ? {} // canonical fallback handled by caller (we keep it simple here)
      : { ...(formulas.value || {}) }

  // apply selected variation for active output
  try {
    const variations = formulaVariations?.value
    const selectedOut = outputVars.value[outputVariableIndex.value]
    if (variations && selectedOut) {
      const variation = variations.variations[selectedVariationIndex.value]
      if (variation && variation.formula) baseFormulas[selectedOut] = variation.formula
    }
  } catch (err) {
    console.warn('Export popup: failed to apply variation', err)
  }

  const lc = formulaToLC(baseFormulas, inputVars.value, outputVars.value, outType as any)
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

const actions = [
  { type: 'DEFAULT' as const, label: 'Cancel', onClick: onClose },
  { type: 'SUBMIT' as const, label: 'Export', onClick: doExport },
]
</script>

<style scoped></style>
