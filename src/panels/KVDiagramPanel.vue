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

    <div class="h-full" ref="screenshotRef">
      <!-- Interactive view -->
      <div
        data-screenshot-ignore
        class="h-full pb-[15%] flex flex-col justify-center items-center overflow-auto"
      >
        <div class="flex-1">
          <KVDiagram
            :key="`${functionType}-${outputVariableIndex}`"
            :values="tableValues"
            :input-vars="inputVars"
            :output-vars="outputVars"
            :outputVariableIndex="outputVariableIndex"
            :formulas="{}"
            :selected-formula="displaySelectedFormula"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="displayQmcResult"
            :formula-term-colors="displayFormulaTermColors"
            :immutable-cell-mask="immutableCellMask"
            @values-changed="tableValues = $event"
          />
        </div>

        <div
          v-if="displayFormulaVariations && showFormula"
          class="pt-8 flex-1 w-full flex justify-center overflow-visible"
        >
          <MinimizedFormulaViewer
            v-model:selectedIndex="currentFormulaIndex"
            :signature="displayFormulaVariations?.signature ?? ''"
            :formulas="displayFormulaVariationLatex"
            :function-representation="functionRepresentation"
          />
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
            :selected-formula="displaySelectedFormula"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="displayQmcResult"
            :formula-term-colors="displayFormulaTermColors"
            :immutable-cell-mask="immutableCellMask"
            @values-changed="tableValues = $event"
          />

          <div v-if="displayFormulaVariations" class="w-full flex justify-center overflow-visible">
            <MinimizedFormulaViewer
              v-model:selectedIndex="currentFormulaIndex"
              :signature="displayFormulaVariations?.signature ?? ''"
              :formulas="displayFormulaVariationLatex"
              :function-representation="functionRepresentation"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue'
import MinimizedFormulaViewer from '@/components/parts/MinimizedFormulaViewer.vue'
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
import { formulaToLatex } from '@/utility/truthtable/latexGenerator'
import { getDockviewApi } from '@/utility/dockview/integration'
import { useClampedSelection } from '@/utility/panelSelection'

interface KVPanelState {
  showFormula: boolean
  selectedFormulaIndex: number
}

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<KVPanelState>(props.params.api.id)
const showFormula = ref(panelState?.showFormula ?? true)
const currentFormulaIndex = ref(panelState?.selectedFormulaIndex ?? 0)
const kvDiagramRef = ref<InstanceType<typeof KVDiagram>>()
const screenshotRef = ref<HTMLElement | null>(null)

// Auto-save panel state when values change

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
  formulaVariations,
  qmcResult,
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
  () =>
    selectedVariation.value?.formula ??
    fsmPresentation.value.selectedFormula ??
    selectedFormula.value,
)

const displayQmcResult = computed(() => fsmPresentation.value.qmcResult ?? qmcResult.value)

const displayFormulaTermColors = computed(() => selectedVariation.value?.termColors ?? [])

const currentOutputVar = computed(() => outputVars.value[outputVariableIndex.value])

const displayFormulaVariations = computed(() => {
  const variationsMap = fsmPresentation.value.formulaVariations ?? formulaVariations.value
  const outputVar = currentOutputVar.value
  return outputVar ? variationsMap?.[outputVar] : undefined
})

const selectedFormulaLatex = computed(() =>
  displaySelectedFormula.value ? formulaToLatex(displaySelectedFormula.value) : '',
)

const displayFormulaVariationLatex = computed(
  () =>
    displayFormulaVariations.value?.variations.map((variation) =>
      formulaToLatex(variation.formula),
    ) ?? [],
)

const selectedVariation = computed(() => {
  const variations = displayFormulaVariations.value?.variations ?? []
  return variations[currentFormulaIndex.value] ?? variations[0]
})

const immutableCellMask = computed(() =>
  buildFsmImmutableCellMask(stateManager.state.fsm, stateManager.state.truthTable),
)

const { clampedSavedIndex: clampedSavedFormulaIndex } = useClampedSelection(
  currentFormulaIndex,
  displayFormulaVariationLatex,
)

stateManager.watchPanelState<KVPanelState>(props.params.api.id, () => ({
  showFormula: showFormula.value,
  selectedFormulaIndex: clampedSavedFormulaIndex.value,
}))

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
    content: () => selectedFormulaLatex.value,
    mimeType: 'text/plain',
    registerWith: 'latex' as const,
  },
])
</script>
