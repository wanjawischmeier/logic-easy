<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import TruthTable from '../components/TruthTable.vue'
import type { Formula } from '@/utility/truthTableInterpreter';
import type { TruthTableCell, TruthTableData } from '@/utility/types';

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

// Local model for the table component
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
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-hidden">
    <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" />
  </div>
</template>

<style scoped></style>
