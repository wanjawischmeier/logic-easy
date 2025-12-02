<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import TruthTable, { type TruthTableCell, type TruthTableData } from '../components/TruthTable.vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import type { Formula } from '@/utility/truthTableInterpreter';

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

// Local model for the table component
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
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-hidden">
    <div class="font-semibold mb-2">TruthTable</div>
    <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" />

    <div class="font-semibold mb-2">Formula</div>
    <FormulaRenderer v-if="state?.formulas" :formulas="state.formulas" />

    <div class="font-semibold mb-2">KV Diagram</div>
    <KVDiagram :input-vars="inputVars" :output-vars="outputVars" :model-value="tableValues"
      :minified-values="state?.minifiedValues || []" />
  </div>
</template>

<style scoped></style>
