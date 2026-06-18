<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">
    <div class="w-full flex flex-wrap text-sm justify-end items-center gap-2">
      <MultiSelectSwitch
        :values="viewTabs"
        :initialSelected="selectedTabIndex"
        :onSelect="(v, i) => (selectedTabIndex = i)"
        :highlight-border="true"
      >
      </MultiSelectSwitch>

      <LegendButton :legend="currentLegend" />

      <SettingsButton
        :input-vars="displayInputVars"
        :output-vars="displayOutputVars"
        :selected-output-index="outputVariableIndex"
        :selected-function-type="functionType"
        :show-function-representation-selection="false"
        :customSettingSlotLabels="
          selectedTabIndex === 1 ? { 'show-highlights': 'Show highlights' } : {}
        "
      >
        <template v-if="selectedTabIndex === 1" #show-highlights>
          <div class="flex gap-2 items-center" @click.stop>
            <Checkbox v-model="showHighlights" />
            <div class="text-xs min-w-25">
              <span v-if="showHighlights">Highlights enabled</span>
              <span v-else>Highlights disabled</span>
            </div>
          </div>
        </template>
      </SettingsButton>

      <DownloadButton
        :target-ref="screenshotRef"
        :panel-id="props.params.api.id"
        filename="qmc"
        :files="downloadFiles"
      />
    </div>

    <div class="flex-1 min-h-0 flex flex-col" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="flex-1 min-h-0 flex flex-col items-center">
        <div
          v-if="(qmcResult?.iterations.length ?? 0) !== 0"
          class="flex-1 min-h-0 overflow-auto w-full"
        >
          <div class="min-h-full w-max min-w-full flex items-center justify-center">
            <QMCGroupingTable
              v-if="selectedTabIndex === 0"
              :values="tableValues"
              :input-vars="displayInputVars"
              :output-vars="displayOutputVars"
              :outputVariableIndex="outputVariableIndex"
              :formulas="{}"
              :functionType="functionType"
              :function-representation="functionRepresentation"
              :qmc-result="qmcResult"
            />

            <QMCPrimeImplicantChart
              v-else-if="selectedTabIndex === 1"
              :values="tableValues"
              :input-vars="displayInputVars"
              :output-vars="displayOutputVars"
              :outputVariableIndex="outputVariableIndex"
              :formulas="{}"
              :functionType="functionType"
              :function-representation="functionRepresentation"
              :qmc-result="qmcResult"
              :coupling-term-latex="couplingTermLatex"
              :show-highlights="showHighlights"
              :display-formula-variations="displayFormulaVariations"
              v-model:current-variation-index="currentVariationIndex"
            />
          </div>
        </div>
        <div v-else class="flex-1 overflow-auto w-full">
          <div class="min-h-full min-w-full flex justify-center items-center">
            <div
              v-if="displayFormulaVariations.length > 0"
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
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div
          v-for="(outputVar, outIdx) in outputVars"
          :key="`screenshot-${outputVar}-${functionType}`"
          class="flex flex-col items-center gap-4"
        >
          <vue-latex
            :fontsize="14"
            :expression="`\\text{Output Variable:}${formatLatexIdentifier(displayOutputVars[outIdx] ?? outputVar)}`"
          />

          <QMCGroupingTable
            :values="tableValues"
            :input-vars="displayInputVars"
            :output-vars="displayOutputVars"
            :outputVariableIndex="outputVariableIndex"
            :formulas="{}"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="qmcResult"
            :function-type="functionType"
          />

          <QMCPrimeImplicantChart
            :values="tableValues"
            :input-vars="displayInputVars"
            :output-vars="displayOutputVars"
            :outputVariableIndex="outputVariableIndex"
            :formulas="{}"
            :functionType="functionType"
            :function-representation="functionRepresentation"
            :qmc-result="qmcResult"
            :coupling-term-latex="couplingTermLatex"
            :show-highlights="showHighlights"
            :display-formula-variations="displayFormulaVariations"
            v-model:current-variation-index="currentVariationIndex"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import VariationViewer from '@/components/parts/VariationViewer.vue'
import LegendButton, { type LegendItem } from '@/components/parts/buttons/LegendButton.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import Checkbox from '@/components/parts/Checkbox.vue'
import QMCGroupingTable from '@/components/parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from '@/components/parts/QMCPrimeImplicantChart.vue'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { stateManager } from '@/projects/stateManager'
import { formatLatexIdentifier } from '@/utility/truthtable/latexGenerator'
import {
  TruthTableProject,
  type TruthTableCell,
  type TruthTableData,
} from '@/projects/truth-table/TruthTableProject'
import { getDockviewApi } from '@/utility/dockview/integration'
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager'
import { buildFsmKVDiagramPresentation } from '@/utility/fsm/kvSync'

interface QMCPanelState {
  selectedTabIndex: number
  showHighlights: boolean
}

let disposable: { dispose?: () => void } | null = null

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<QMCPanelState>(props.params.api.id)
const viewTabs = ['Grouping Table', 'Prime Implicants']
const selectedTabIndex = ref(panelState?.selectedTabIndex ?? 0)
const showHighlights = ref(panelState?.showHighlights ?? true)
const screenshotRef = ref<HTMLElement | null>(null)

const legends: Record<string, LegendItem[]> = {
  groupingTable: [
    {
      symbol: 'K_n',
      symbolType: 'latex',
      label: 'Term Class',
      description:
        "Terms are classified based on the number of 1's (DMF) or 0's (CMF) they contain.",
    },
    {
      symbol: '#',
      symbolType: 'text',
      label: 'Term Index',
      description: "The decimal equivalent of the term's binary representation.",
    },
    {
      symbol: 'bg-secondary-variant',
      symbolType: 'bg-color',
      label: 'Prime implicant',
      description:
        'An implicant that cannot be further combined or simplified in the grouping table.',
    },
    {
      symbol: 'bg-yellow-200/75',
      symbolType: 'bg-color',
      label: 'Term hierarchy (on hover)',
      description:
        'Shows part of which terms the currently hovered over term is (across iterations).',
    },
  ],
  primeImplicants: [
    {
      symbol: '\\times',
      symbolType: 'latex',
      label: 'Covered Minterm',
      description: 'The respective prime implicant covers this minterm in the truth table.',
    },
    {
      symbol: '\\oplus',
      symbolType: 'latex',
      label: 'Essential Minterm',
      description:
        'Can only be covered by one prime implicant. Meaning that has to be a part of the function.',
    },
    {
      symbol: 'border-2 border-red-600 border-dashed rounded-lg',
      symbolType: 'tailwind',
      label: 'Essential prime implicant bounds',
      description:
        'Shows which minterms the respective prime implicant already covers. Those no longer need to be considered.',
    },
  ],
}

const currentLegend = computed(() =>
  selectedTabIndex.value === 0 ? legends.groupingTable : legends.primeImplicants,
)

onMounted(() => {
  const api = getDockviewApi()
  if (!api) return

  // Listen to panel visibility changes
  // TODO: Optimize this, rn just for testing
  const visibilityDisposable = api.onDidActivePanelChange(() => {
    if (props.params.api.isActive) {
      // Panel became active/visible - refresh latex rendering
      console.log('Refresh kv diagram')
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

// Auto-save panel state when values change
stateManager.watchPanelState<QMCPanelState>(props.params.api.id, () => ({
  selectedTabIndex: selectedTabIndex.value,
  showHighlights: showHighlights.value,
}))

// Access state from params
const {
  inputVars,
  outputVars,
  displayInputVars,
  displayOutputVars,
  values,
  outputVariableIndex,
  functionType,
  functionRepresentation,
  qmcResult,
  couplingTermLatex,
  variations,
  variationIndex,
} = TruthTableProject.useState()

const fsmPresentation = computed(() => {
  if (!stateManager.state.fsm) return {}
  if (!stateManager.state.truthTable) return {}
  // Explicitly access qmcResult to ensure dependency is tracked
  const qmc = stateManager.state.truthTable.qmcResult
  if (!qmc) return {}
  return buildFsmKVDiagramPresentation(stateManager.state.truthTable)
})

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

const tableValues = ref<TruthTableData>(values.value.map((row: TruthTableCell[]) => [...row]))
let isUpdatingFromState = false

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

    console.log('[KVDiagramPanel] Calling updateTruthTable')
    Object.assign(stateManager.state.truthTable.values, newVal)
    truthTableWorkerManager.update()
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
    filename: 'kv',
    extension: 'tex',
    content: () => couplingTermLatex.value,
    mimeType: 'text/plain',
    registerWith: 'latex' as const,
  },
])
</script>
