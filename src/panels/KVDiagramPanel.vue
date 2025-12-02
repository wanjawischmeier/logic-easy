<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import type { TruthTableCell, TruthTableData } from '@/components/TruthTable.vue';
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

const selectedType = ref<'DNF' | 'CNF'>('DNF');
const currentFormula = computed(() => state?.formulas?.[selectedType.value]);
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-hidden">
    <div class="flex justify-between items-center mb-2">
      <div class="font-semibold">KV Diagram</div>
      <div class="flex gap-2 text-sm">
        <button v-for="type in ['DNF', 'CNF']" :key="type" @click="selectedType = type as 'DNF' | 'CNF'"
          :class="['px-2 py-1 rounded', selectedType === type ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300']">
          {{ type }}
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col items-center overflow-auto">
      <KVDiagram :key="selectedType" v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars"
        :minified-values="state?.minifiedValues || []" :formula="currentFormula" :mode="selectedType" />

      <div class="mt-4 w-full flex justify-center">
        <FormulaRenderer :formula="currentFormula" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
