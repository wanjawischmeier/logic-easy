<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex flex-wrap-reverse text-sm justify-end items-center gap-2">
      <MultiSelectSwitch :values="viewTabs" :initialSelected="selectedViewIndex"
        :onSelect="(v, i) => selectedViewIndex = i">
      </MultiSelectSwitch>

      <SettingsButton :output-vars="outputVars" :function-types="functionTypes"
        :selected-output-index="outputVariableIndex" :selected-function-type="functionType"
        @update:selected-output-index="" @update:selected-function-type="" />

      <DownloadButton :target-ref="screenshotRef" filename="kv" :latex-content="couplingTermLatex" />
    </div>

    <div class="h-full" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="h-full flex flex-col items-center overflow-auto">
        <div class="flex-1 flex items-center justify-center overflow-auto w-full">
          <QMCGroupingTable v-if="selectedViewIndex === 0" :values="tableValues" :input-vars="inputVars"
            :output-vars="outputVars" :outputVariableIndex="outputVariableIndex" :formulas="formulas"
            :functionType="functionType" :qmc-result="qmcResult" />

          <QMCPrimeImplicantChart v-else-if="selectedViewIndex === 1" :values="tableValues" :input-vars="inputVars"
            :output-vars="outputVars" :outputVariableIndex="outputVariableIndex" :formulas="formulas"
            :functionType="functionType" :qmc-result="qmcResult" />
        </div>
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div v-for="(outputVar, index) in outputVars" :key="`screenshot-${outputVar}-${functionType}`"
          class="flex flex-col items-center gap-4">
          <KVDiagram :values="tableValues" :input-vars="inputVars" :output-vars="outputVars"
            :outputVariableIndex="index" :formulas="formulas" :functionType="functionType"
            @values-changed="tableValues = $event" />

          <FormulaRenderer :latex-expression="couplingTermLatex" v-if="couplingTermLatex">
          </FormulaRenderer>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import DownloadButton from '@/components/parts/DownloadButton.vue'
import SettingsButton from '@/components/parts/SettingsButton.vue'
import { FunctionType } from '@/utility/types';
import QMCGroupingTable from '@/components/parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from '@/components/parts/QMCPrimeImplicantChart.vue'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/projects/stateManager';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { getDockviewApi } from '@/utility/dockview/integration';

const props = defineProps<Partial<IDockviewPanelProps>>()

let disposable: { dispose?: () => void } | null = null

const screenshotRef = ref<HTMLElement | null>(null)

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
    }
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

const functionTypes = computed(() =>
  Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>)
);

const viewTabs = ['Grouping Table', 'Prime Implicant Chart'];
const selectedViewIndex = ref(0);

// Access state from params
const { inputVars, outputVars, values, formulas, outputVariableIndex, functionType, qmcResult, couplingTermLatex } = TruthTableProject.useState()

const tableValues = ref<TruthTableData>(values.value.map((row: TruthTableCell[]) => [...row]))
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  console.log('[KVDiagramPanel] Local tableValues changed:', newVal);
  if (!stateManager.state.truthTable) return

  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[KVDiagramPanel] Skipping update (isUpdatingFromState)');
    return
  }

  console.log('[KVDiagramPanel] Calling updateTruthTable');
  Object.assign(stateManager.state.truthTable.values, newVal);
  updateTruthTable()
}, { deep: true })

// Watch for external changes from state (use getter so watcher tracks the computed ref)
watch(() => values.value, (newVal) => {
  console.log('[KVPanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })
</script>
