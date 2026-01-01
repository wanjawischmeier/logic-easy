<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import { defaultFunctionType, Formula, FunctionType } from '@/utility/types';
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/projects/stateManager';
import { type TruthTableData, type TruthTableCell } from '@/projects/Project';
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject';

const props = defineProps<Partial<IDockviewPanelProps>>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

interface KVPanelState {
  selectedType: FunctionType
  selectedOutputIndex: number
}

// Load saved panel state
const panelState = stateManager.getPanelState<KVPanelState>(props.params.api.id)

const selectedType = ref<FunctionType>(
  panelState?.selectedType ?? defaultFunctionType
);
const selectedOutputIndex = ref(
  panelState?.selectedOutputIndex ?? 0
);

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  // Store unsubscribe for cleanup
  const originalDispose = disposable?.dispose
  disposable = {
    dispose: () => {
      originalDispose?.()
    }
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

const functionTypes = computed(() =>
  Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>)
);

// Access state from params
const { inputVars, outputVars, values, minifiedValues, formulas } = TruthTableProject.useState()

// Local model for the component
const tableValues = ref<TruthTableData>(values ? values.value.map((row: TruthTableCell[]) => [...row]) : [])
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  console.log('[KVDiagramPanel] Local tableValues changed:', newVal);
  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[KVDiagramPanel] Skipping update (isUpdatingFromState)');
    return
  }
  console.log('[KVDiagramPanel] Calling updateTruthTable');
  updateTruthTable(newVal)
}, { deep: true })

// Watch for external changes from state (use getter so watcher tracks the computed ref)
watch(() => values.value, (newVal) => {
  console.log('[KVPanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })

// Auto-save panel state when values change
stateManager.watchPanelState(props.params.api.id, () => ({
  selectedType: selectedType.value,
  selectedOutputIndex: selectedOutputIndex.value
}))

const currentFormula = computed(() => {
  const outputVar = outputVars.value[selectedOutputIndex.value];
  if (!outputVar) {
    return Formula.empty;
  }

  return formulas.value[outputVar]?.[selectedType.value];
});
</script>

<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex gap-10 text-sm justify-end">
      <MultiSelectSwitch v-if="outputVars.length > 1" :label="'Output Variable'" :values="outputVars"
        :initialSelected="selectedOutputIndex" :onSelect="(v, i) => selectedOutputIndex = i">
      </MultiSelectSwitch>

      <MultiSelectSwitch :label="'Function Type'" :values="functionTypes"
        :initialSelected="functionTypes.indexOf(selectedType)" :onSelect="(v, i) => selectedType = v as FunctionType">
      </MultiSelectSwitch>
    </div>

    <div class="h-full flex flex-col items-center justify-center overflow-auto">
      <KVDiagram :key="`${selectedType}-${selectedOutputIndex}`" v-model="tableValues" :input-vars="inputVars"
        :output-vars="outputVars" :output-index="selectedOutputIndex" :minified-values="minifiedValues || []"
        :formula="currentFormula" :functionType="selectedType" />

      <div class="mt-4 w-full flex justify-center">
        <FormulaRenderer :formula="currentFormula" :output-var="outputVars[selectedOutputIndex]" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
