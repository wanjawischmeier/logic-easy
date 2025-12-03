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

// Access state from params (DockView source of truth)
const state = props.params.params?.state
const inputVars = state?.inputVars || []
const outputVars = state?.outputVars || []
const functionTypes = computed(() => Object.values(FunctionType));

// Local model for the component
const tableValues = ref<TruthTableData>(state?.values ? state.values.map((row: TruthTableCell[]) => [...row]) : [])
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

// Watch for external changes
watch(() => state?.values, (newVal) => {
  if (newVal && JSON.stringify(newVal) !== JSON.stringify(tableValues.value)) {
    isUpdatingFromState = true
    tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
  }
}, { deep: true })

const selectedType = ref<FunctionType>('DNF');
const selectedOutputIndex = ref(0);
const currentFormula = computed(() => {
  const outputVar = outputVars[selectedOutputIndex.value];
  return state?.formulas?.[outputVar]?.[selectedType.value];
});
</script>

<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">
    <div class="flex justify-between items-center mb-2">
      <div class="font-semibold">KV Diagram</div>
      <div class="flex gap-2 text-sm">
        <select v-model="selectedOutputIndex" class="">
          <option v-for="(outputVar, idx) in outputVars" :key="outputVar" :value="idx">
            {{ outputVar }}
          </option>
        </select>
        <MultiSelectSwitch :values="functionTypes" :onSelect="(v, i) => selectedType = v as FunctionType">
        </MultiSelectSwitch>
      </div>
    </div>

    <div class="flex-1 flex flex-col items-center overflow-auto">
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
