<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import type { TruthTableCell, TruthTableData } from '@/utility/types';
import type { Formula } from '@/utility/truthTableInterpreter';
import { FunctionType } from '@/utility/types';
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue';

const props = defineProps<{
  params: IDockviewPanelProps & {
    params?: {
      state?: {
        inputVars: string[],
        outputVars: string[],
        values: TruthTableData,
        minifiedValues: TruthTableData,
        formulas: Record<string, Formula>
      },
      updateTruthTable?: (values: TruthTableData) => void
    }
  }
}>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

// Access state from params (DockView source of truth) - make reactive
const state = computed(() => props.params.params?.state)
const inputVars = computed(() => state.value?.inputVars || [])
const outputVars = computed(() => state.value?.outputVars || [])
const functionTypes = computed(() => Object.values(FunctionType));

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
    props.params.params.updateTruthTable(newVal)
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

const selectedType = ref<FunctionType>('DNF');
const selectedOutputIndex = ref(0);
const currentFormula = computed(() => {
  const outputVar = outputVars.value[selectedOutputIndex.value];
  return state.value?.formulas?.[outputVar]?.[selectedType.value];
});
</script>

<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex gap-10 text-sm justify-end">
      <MultiSelectSwitch :label="'Output Variable'" :values="outputVars" :onSelect="(v, i) => selectedOutputIndex = i">
      </MultiSelectSwitch>

      <MultiSelectSwitch :label="'Function Type'" :values="functionTypes"
        :onSelect="(v, i) => selectedType = v as FunctionType">
      </MultiSelectSwitch>
    </div>

    <div class="h-full flex flex-col items-center justify-center overflow-auto">
      <KVDiagram :key="`${selectedType}-${selectedOutputIndex}`" v-model="tableValues" :input-vars="inputVars"
        :output-vars="outputVars" :output-index="selectedOutputIndex" :minified-values="state?.minifiedValues || []"
        :formula="currentFormula" :mode="selectedType" />

      <div class="mt-4 w-full flex justify-center">
        <FormulaRenderer :formula="currentFormula" :output-var="outputVars[selectedOutputIndex]" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
