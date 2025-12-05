<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import type { TruthTableCell, TruthTableData } from '@/utility/types';
import { defaultFunctionType, Formula, FunctionType } from '@/utility/types';
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue';
import { useTruthTableState } from '@/utility/states/truthTableState';
import { updateTruthTable } from '@/utility/truthTableInterpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/utility/states/stateManager';

const props = defineProps<IDockviewPanelProps>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

interface KVPanelState {
  selectedType: FunctionType
  selectedOutputIndex: number
}

// Load saved panel state
const savedState = stateManager.getPanelState<KVPanelState>(props.params.api.id)

const selectedType = ref<FunctionType>(
  savedState?.selectedType ?? defaultFunctionType
);
const selectedOutputIndex = ref(
  savedState?.selectedOutputIndex ?? 0
);

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

// Access state from params
const { state, inputVars, outputVars, functionTypes } = useTruthTableState()

// Local model for the component
const tableValues = ref<TruthTableData>(state.value?.values ? state.value.values.map((row: TruthTableCell[]) => [...row]) : [])
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  if (isUpdatingFromState) {
    isUpdatingFromState = false
    return
  }
  if (props.params.params?.updateTruthTable) {
    updateTruthTable(newVal)
  }
}, { deep: true })

// Watch for external changes from state
watch(() => state.value?.values, (newVal) => {
  if (newVal && JSON.stringify(newVal) !== JSON.stringify(tableValues.value)) {
    isUpdatingFromState = true
    tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
  }
}, { deep: true })

// Watch for params updates (when DockView updateParameters is called)
watch(() => props.params.params?.state, (newState) => {
  if (newState?.values && JSON.stringify(newState.values) !== JSON.stringify(tableValues.value)) {
    isUpdatingFromState = true
    tableValues.value = newState.values.map((row: TruthTableCell[]) => [...row])
  }
}, { deep: true, immediate: true })

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

  return state.value?.formulas?.[outputVar]?.[selectedType.value];
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
        :output-vars="outputVars" :output-index="selectedOutputIndex" :minified-values="state?.minifiedValues || []"
        :formula="currentFormula" :functionType="selectedType" />

      <div class="mt-4 w-full flex justify-center">
        <FormulaRenderer :formula="currentFormula" :output-var="outputVars[selectedOutputIndex]" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
