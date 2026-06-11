<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">
    <div class="w-full flex flex-wrap-reverse text-sm justify-end items-center gap-2">
      <SettingsButton
        :input-vars="inputVars"
        :output-vars="outputVars"
        :selected-output-index="outputVariableIndex"
        :selected-function-type="functionType"
        :selected-function-representation="functionRepresentation"
        :custom-setting-slot-labels="{ 'show-formula': 'Show formula' }"
      >
        <template #show-formula>
          <div class="flex gap-2 items-center" @click.stop>
            <Checkbox v-model="showFormula" />
            <div class="text-xs min-w-25">
              <span v-if="showFormula">Showing respective formula</span>
              <span v-else>Toggle to show formula</span>
            </div>
          </div>
        </template>
      </SettingsButton>

      <DownloadButton
        :target-ref="screenshotRef"
        :panel-id="props.params.api.id"
        filename="kv"
        :files="downloadFiles"
      />
    </div>

    <div class="flex-1 min-h-0 flex flex-col" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="flex-1 min-h-0 overflow-auto">
        <div class="min-h-full w-max min-w-full flex flex-col justify-center items-center">
          <KVDiagram
            :key="`${functionType}-${outputVariableIndex}`"
            :values="tableValues"
            :input-vars="inputVars"
            :output-vars="outputVars"
            :outputVariableIndex="outputVariableIndex"
            :formulas="{}"
            :selected-formula="selectedVariationFormula"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="displayQmcResult"
            :formula-term-colors="displayFormulaTermColors"
            :immutable-cell-mask="immutableCellMask"
            :variation-index="currentVariationIndex"
            @values-changed="tableValues = $event"
          />

          <div
            v-if="displayFormulaVariations.length > 0 && showFormula"
            class="pt-8 w-full flex justify-center overflow-visible"
          >
            <VariationViewer
              v-model:current-variation-index="currentVariationIndex"
              :variations="displayFormulaVariations"
              :function-representation="functionRepresentation"
            />
          </div>
        </div>
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div
          v-for="(outputVar, index) in outputVars"
          :key="`screenshot-${outputVar}-${functionType}`"
          class="flex flex-col items-center gap-4"
        >
          <KVDiagram
            :values="tableValues"
            :input-vars="inputVars"
            :output-vars="outputVars"
            :outputVariableIndex="index"
            :formulas="{}"
            :selected-formula="selectedVariationFormula"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="displayQmcResult"
            :formula-term-colors="displayFormulaTermColors"
            :immutable-cell-mask="immutableCellMask"
            :variation-index="currentVariationIndex"
            @values-changed="tableValues = $event"
          />

          <FormulaRenderer
            :latex-expression="displayCouplingTermLatex"
            v-if="displayCouplingTermLatex"
          >
          </FormulaRenderer>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, type ComputedRef } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue'
import FormulaRenderer from '@/components/FormulaRenderer.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import Checkbox from '@/components/parts/Checkbox.vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { stateManager } from '@/projects/stateManager'
import {
  TruthTableProject,
  type TruthTableCell,
  type TruthTableData,
} from '@/projects/truth-table/TruthTableProject'
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager'
import {
  buildFsmImmutableCellMask,
  buildFsmKVDiagramPresentation,
  applyTruthTableToFsm,
} from '@/utility/fsm/kvSync'
import { getDockviewApi } from '@/utility/dockview/integration'
import type { FormulaVariation } from '@/utility/types'
import VariationViewer from '@/components/parts/VariationViewer.vue'

interface KVPanelState {
  showFormula: boolean
}

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<KVPanelState>(props.params.api.id)
const showFormula = ref(panelState?.showFormula ?? true)
const kvDiagramRef = ref<InstanceType<typeof KVDiagram>>()
const screenshotRef = ref<HTMLElement | null>(null)

// Auto-save panel state when values change
stateManager.watchPanelState<KVPanelState>(props.params.api.id, () => ({
  showFormula: showFormula.value,
}))

let disposable: { dispose?: () => void } | null = null

onMounted(() => {
  const api = getDockviewApi()
  if (!api) return

  // Listen to panel visibility changes
  // TODO: Optimize this, rn just for testing
  const visibilityDisposable = api.onDidActivePanelChange(() => {
    if (props.params.api.isActive) {
      // Panel became active/visible - refresh latex rendering
      console.log('Refresh kv diagram')
      kvDiagramRef.value?.refresh()
    }
  })

  // Store unsubscribe for cleanup
  disposable = {
    dispose: () => {
      visibilityDisposable.dispose()
    },
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

// Access state from params
const {
  inputVars,
  outputVars,
  values,
  selectedFormula,
  outputVariableIndex,
  functionType,
  functionRepresentation,
  couplingTermLatex,
  qmcResult,
  formulaTermColors,
  variations,
  variationIndex,
} = TruthTableProject.useState()

const tableValues = ref<TruthTableData>(values.value.map((row: TruthTableCell[]) => [...row]))
let isUpdatingFromState = false

// Display-only remapping for FSM context: remap vars from (a,b,c) to actual FSM names
const fsmPresentation = computed(() => {
  if (!stateManager.state.fsm) return {}
  if (!stateManager.state.truthTable) return {}
  // Explicitly access qmcResult to ensure dependency is tracked
  const qmc = stateManager.state.truthTable.qmcResult
  if (!qmc) return {}
  return buildFsmKVDiagramPresentation(stateManager.state.truthTable)
})

// Use remapped display values when FSM is active, otherwise use direct state
const displaySelectedFormula = computed(
  () => fsmPresentation.value.selectedFormula ?? selectedFormula.value,
)

const displayQmcResult = computed(() => fsmPresentation.value.qmcResult ?? qmcResult.value)

const displayFormulaTermColors = computed(
  () => fsmPresentation.value.formulaTermColors ?? formulaTermColors.value,
)

const displayCouplingTermLatex = computed(
  () => fsmPresentation.value.couplingTermLatex ?? couplingTermLatex.value,
)

const displayFormulaVariations = computed(() => {
  const variationsSource = fsmPresentation.value.variations ?? variations.value
  const outputVar = outputVars.value[outputVariableIndex.value]
  if (!outputVar || !variationsSource) return []
  return variationsSource[outputVar] ?? []
})

const currentVariationIndex = computed({
  get() {
    const outputVar = outputVars.value[outputVariableIndex.value]
    if (!outputVar) return 0

    const indexMap = variationIndex.value as Record<string, number> | number
    if (typeof indexMap === 'number') return indexMap
    return indexMap[outputVar] ?? 0
  },
  set(value: number) {
    const outputVar = outputVars.value[outputVariableIndex.value]
    if (!outputVar || !stateManager.state.truthTable) return

    const current = stateManager.state.truthTable.variationIndex
    stateManager.state.truthTable.variationIndex = {
      ...(typeof current === 'number' ? {} : current),
      [outputVar]: value,
    }
  },
})

const selectedVariationFormula = computed(() => {
  const variation = displayFormulaVariations.value[currentVariationIndex.value]
  return variation?.formula
})

const immutableCellMask = computed(() =>
  buildFsmImmutableCellMask(stateManager.state.fsm, stateManager.state.truthTable),
)

// Watch for local changes and notify DockView
watch(
  tableValues,
  (newVal) => {
    console.log('[KVDiagramPanel] Local tableValues changed:', newVal)
    if (!stateManager.state.truthTable) return

    if (isUpdatingFromState) {
      isUpdatingFromState = false
      console.log('[KVDiagramPanel] Skipping update (isUpdatingFromState)')
      return
    }

    console.log('[KVDiagramPanel] Calling truthTableWorkerManager.update()')
    Object.assign(stateManager.state.truthTable.values, newVal)
    truthTableWorkerManager.update()

    // sync to FSM if editing FSM-derived table while avoiding loops
    if (stateManager.state.fsm) {
      stateManager.suppressFsmSync(() => {
        applyTruthTableToFsm(stateManager.state.fsm!, stateManager.state.truthTable!)
      })
    }
  },
  { deep: true },
)

// Watch for external changes from state (use getter so watcher tracks the computed ref)
watch(
  () => values.value,
  (newVal) => {
    console.log('[KVPanel] state.value.values changed:', newVal)
    if (!newVal) return
    isUpdatingFromState = true
    tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
  },
  { deep: true },
)

const downloadFiles = computed(() => [
  {
    label: 'LaTeX',
    filename: 'kv-diagram',
    extension: 'tex',
    content: () => couplingTermLatex.value,
    mimeType: 'text/plain',
    registerWith: 'latex' as const,
  },
])
</script>
