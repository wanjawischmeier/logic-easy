<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">
    <div class="w-full flex flex-wrap-reverse text-sm justify-end items-center gap-2">
      <SettingsButton
        :input-vars="kvBinding.inputVars"
        :output-vars="kvBinding.outputVars"
        :selected-output-index="kvBinding.outputVariableIndex"
        :selected-function-type="kvBinding.functionType"
        :selected-function-representation="kvBinding.functionRepresentation"
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
      <div
        data-screenshot-ignore
        class="h-full flex flex-col justify-center items-center overflow-auto"
      >
        <div class="flex-1">
          <KVDiagram
            :key="`${kvBinding.functionType}-${kvBinding.outputVariableIndex}`"
            :values="tableValues"
            :input-vars="kvBinding.inputVars"
            :output-vars="kvBinding.outputVars"
            :outputVariableIndex="kvBinding.outputVariableIndex"
            :formulas="{}"
            :selected-formula="effectiveSelectedFormula"
            :functionType="kvBinding.functionType"
            :function-representation="kvBinding.functionRepresentation"
            :qmc-result="effectiveQmcResult"
            :formula-term-colors="effectiveFormulaTermColors"
            :immutable-cell-mask="kvBinding.immutableCellMask"
            :automaton-mode-enabled="useAutomatonBinding"
            @values-changed="onCellChanged"
          />
        </div>

        <FormulaRenderer
          v-if="effectiveCouplingTermLatex && showFormula"
          class="pt-6"
          :latex-expression="effectiveCouplingTermLatex"
        />
      </div>

      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div
          v-for="(outputVar, index) in kvBinding.outputVars"
          :key="`screenshot-${outputVar}-${kvBinding.functionType}`"
          class="flex flex-col items-center gap-4"
        >
          <KVDiagram
            :values="tableValues"
            :input-vars="kvBinding.inputVars"
            :output-vars="kvBinding.outputVars"
            :outputVariableIndex="index"
            :formulas="{}"
            :selected-formula="effectiveSelectedFormula"
            :functionType="kvBinding.functionType"
            :function-representation="kvBinding.functionRepresentation"
            :qmc-result="effectiveQmcResult"
            :formula-term-colors="effectiveFormulaTermColors"
            :immutable-cell-mask="kvBinding.immutableCellMask"
            :automaton-mode-enabled="useAutomatonBinding"
            @values-changed="onCellChanged"
          />

          <FormulaRenderer
            :latex-expression="effectiveCouplingTermLatex"
            v-if="effectiveCouplingTermLatex"
          >
          </FormulaRenderer>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue'
import FormulaRenderer from '@/components/FormulaRenderer.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import Checkbox from '@/components/parts/Checkbox.vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { stateManager } from '@/projects/stateManager'
import { projectManager } from '@/projects/projectManager'
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'
import {
  TruthTableProject,
  type TruthTableData,
  type TruthTableState,
} from '@/projects/truth-table/TruthTableProject'
import { getDockviewApi } from '@/utility/dockview/integration'
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager'
import {
  applyTruthTableStateToAutomaton,
  applyCellChangeToTruthTable,
  applyCellChangeToValues,
  buildBaseTruthTableState,
  buildPatchedAutomatonTruthTable,
  buildComputedColumnsFromBinaryTransitions,
  buildKVDiagramBinding,
  cloneTruthTableValues,
  deriveAutomatonFormulaBundle,
  exportTransitionColumnsToKVDiagram,
  hasUsableTruthTableData,
  resolveAutomatonKVMode,
  resolveUseAutomatonBinding,
  type AutomatonDerivedFormulaBundle,
  type KVDiagramCellChange,
} from '@/utility/automaton/kvDiagramExport'

interface KVPanelState {
  showFormula: boolean
}

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<KVPanelState>(props.params.api.id)
const showFormula = ref(panelState?.showFormula ?? true)
const kvDiagramRef = ref<InstanceType<typeof KVDiagram>>()
const screenshotRef = ref<HTMLElement | null>(null)

const panelParams = computed<Record<string, unknown> | undefined>(
  () => (props.params as { params?: Record<string, unknown> } | undefined)?.params,
)

const isAutomatonProject = computed(
  () => projectManager.currentProjectInfo?.projectType === 'automaton',
)

const hasUsableTruthTableDataComputed = computed(() =>
  hasUsableTruthTableData({
    inputVars: inputVars.value,
    outputVars: outputVars.value,
    values: values.value,
  }),
)

const automatonKVMode = computed(() =>
  resolveAutomatonKVMode({
    panelId: props.params?.api?.id,
    panelParams: panelParams.value,
    hasAutomatonState: !!stateManager.state.automaton,
    hasUsableTruthTableData: hasUsableTruthTableDataComputed.value,
    isAutomatonProject: isAutomatonProject.value,
  }),
)

stateManager.watchPanelState<KVPanelState>(props.params.api.id, () => ({
  showFormula: showFormula.value,
}))

let disposable: { dispose?: () => void } | null = null

onMounted(() => {
  const api = getDockviewApi()
  if (!api) return

  const visibilityDisposable = api.onDidActivePanelChange(() => {
    if (props.params.api.isActive) {
      console.log('Refresh kv diagram')
      kvDiagramRef.value?.refresh()
    }
  })

  disposable = {
    dispose: () => {
      visibilityDisposable.dispose()
    },
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

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
} = TruthTableProject.useState()
const {
  states,
  binaryTransitions,
  bitNumber,
  inputBits: automatonInputBits,
  outputBits: automatonOutputBits,
} = AutomatonProject.useState()

const transitionTableExport = computed(() => {
  if (!stateManager.state.automaton) return null

  const columns = buildComputedColumnsFromBinaryTransitions(binaryTransitions.value, {
    stateCount: states.value.length,
    bitNumber: bitNumber.value,
    inputBits: automatonInputBits.value,
    outputBits: automatonOutputBits.value,
  })

  return exportTransitionColumnsToKVDiagram(columns, stateManager.state.truthTable)
})

const useAutomatonBinding = computed(() => {
  return resolveUseAutomatonBinding({
    hasTransitionTableExport: !!transitionTableExport.value,
    isAutomatonTransitionKV: automatonKVMode.value.isAutomatonTransitionKV,
    shouldForceAutomatonMode: automatonKVMode.value.shouldForceAutomatonMode,
  })
})

const baseTruthTable = computed(() =>
  buildBaseTruthTableState({
    inputVars: inputVars.value,
    outputVars: outputVars.value,
    values: values.value,
    outputVariableIndex: outputVariableIndex.value,
    functionType: functionType.value,
    functionRepresentation: functionRepresentation.value,
    selectedFormula: selectedFormula.value,
    qmcResult: qmcResult.value,
    couplingTermLatex: couplingTermLatex.value,
    formulaTermColors: formulaTermColors.value,
  }),
)

const kvBinding = computed(() =>
  buildKVDiagramBinding(
    baseTruthTable.value,
    transitionTableExport.value,
    useAutomatonBinding.value,
  ),
)

const tableValues = ref<TruthTableData>(cloneTruthTableValues(kvBinding.value.values))

const automatonFormulaBundle = ref<AutomatonDerivedFormulaBundle>({})
let automatonComputationToken = 0

watch(
  [
    () => useAutomatonBinding.value,
    () => transitionTableExport.value,
    () => tableValues.value,
    () => kvBinding.value.outputVariableIndex,
    () => kvBinding.value.functionType,
    () => kvBinding.value.functionRepresentation,
  ],
  async () => {
    if (!useAutomatonBinding.value || !transitionTableExport.value) {
      automatonFormulaBundle.value = {}
      return
    }

    const computationToken = ++automatonComputationToken
    const truthTableForQmc: TruthTableState = {
      ...transitionTableExport.value.truthTable,
      values: cloneTruthTableValues(tableValues.value),
      outputVariableIndex: kvBinding.value.outputVariableIndex,
      functionType: kvBinding.value.functionType,
      functionRepresentation: kvBinding.value.functionRepresentation,
    }

    const formulaBundle = await deriveAutomatonFormulaBundle(truthTableForQmc)
    if (computationToken !== automatonComputationToken) return

    automatonFormulaBundle.value = formulaBundle
  },
  { immediate: true },
)

const effectiveQmcResult = computed(() =>
  useAutomatonBinding.value ? automatonFormulaBundle.value.qmcResult : kvBinding.value.qmcResult,
)

const effectiveSelectedFormula = computed(() =>
  useAutomatonBinding.value
    ? automatonFormulaBundle.value.selectedFormula
    : kvBinding.value.selectedFormula,
)

const effectiveFormulaTermColors = computed(() =>
  useAutomatonBinding.value
    ? automatonFormulaBundle.value.formulaTermColors
    : kvBinding.value.formulaTermColors,
)

const effectiveCouplingTermLatex = computed(() =>
  useAutomatonBinding.value
    ? automatonFormulaBundle.value.couplingTermLatex
    : kvBinding.value.couplingTermLatex,
)

const onCellChanged = (change: KVDiagramCellChange) => {
  const nextValues = applyCellChangeToValues(tableValues.value, change)
  if (!nextValues) return
  tableValues.value = nextValues

  if (useAutomatonBinding.value) {
    if (!automatonKVMode.value.exportToTable) return

    const currentAutomaton = stateManager.state.automaton
    const exportedTruthTable = transitionTableExport.value?.truthTable
    if (!currentAutomaton || !exportedTruthTable) return

    const patchedTruthTable = buildPatchedAutomatonTruthTable({
      truthTable: exportedTruthTable,
      values: tableValues.value,
      outputVariableIndex: kvBinding.value.outputVariableIndex,
      functionType: kvBinding.value.functionType,
      functionRepresentation: kvBinding.value.functionRepresentation,
    })

    AutomatonProject.setLastUpdateSource('table')
    stateManager.state.automaton = applyTruthTableStateToAutomaton(
      currentAutomaton,
      patchedTruthTable,
    )
    return
  }

  if (!applyCellChangeToTruthTable(stateManager.state.truthTable, change)) return
  truthTableWorkerManager.update()
}

watch(
  () => values.value,
  (newVal) => {
    console.log('[KVPanel] state.value.values changed:', newVal)
    if (useAutomatonBinding.value) return
    if (!newVal) return
    tableValues.value = cloneTruthTableValues(newVal)
  },
  { deep: true },
)

watch(
  () => kvBinding.value.values,
  (newVal) => {
    if (!newVal) return
    tableValues.value = cloneTruthTableValues(newVal)
  },
)

const downloadFiles = computed(() => [
  {
    label: 'LaTeX',
    filename: 'kv-diagram',
    extension: 'tex',
    content: () => effectiveCouplingTermLatex.value,
    mimeType: 'text/plain',
    registerWith: 'latex' as const,
  },
])
</script>
