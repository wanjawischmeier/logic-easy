<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex flex-wrap-reverse text-sm justify-end items-center gap-2">
      <SettingsButton :input-vars="inputVars" :output-vars="outputVars" :selected-output-index="outputVariableIndex"
        :selected-function-type="functionType" :custom-setting-slot-labels="{ 'show-formula': 'Show formula' }">
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

      <DownloadButton :target-ref="screenshotRef" :files="downloadFiles" />
    </div>

    <div class="h-full" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="h-full pb-[15%] flex flex-col justify-center items-center overflow-auto">
        <KVDiagram :key="`${functionType}-${outputVariableIndex}`" :values="tableValues" :input-vars="inputVars"
          :output-vars="outputVars" :outputVariableIndex="outputVariableIndex" :formulas="{}"
          :selected-formula="selectedFormula" :functionType="functionType" @values-changed="tableValues = $event" />

        <FormulaRenderer v-if="couplingTermLatex && showFormula" class="pt-8" :latex-expression="couplingTermLatex" />
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div v-for="(outputVar, index) in outputVars" :key="`screenshot-${outputVar}-${functionType}`"
          class="flex flex-col items-center gap-4">
          <KVDiagram :values="tableValues" :input-vars="inputVars" :output-vars="outputVars"
            :outputVariableIndex="index" :formulas="{}" :selected-formula="selectedFormula" :functionType="functionType"
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
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import Checkbox from '@/components/parts/Checkbox.vue';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/projects/stateManager';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { getDockviewApi } from '@/utility/dockview/integration';
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager';

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
  showFormula: showFormula.value
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
    }
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

// Access state from params
const { inputVars, outputVars, values, selectedFormula, outputVariableIndex, functionType, couplingTermLatex } = TruthTableProject.useState()

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
  truthTableWorkerManager.update()
}, { deep: true })

// Watch for external changes from state (use getter so watcher tracks the computed ref)
watch(() => values.value, (newVal) => {
  console.log('[KVPanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })

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
