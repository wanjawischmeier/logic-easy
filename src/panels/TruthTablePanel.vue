<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import TruthTable from '../components/TruthTable.vue'
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { type TruthTableData, type TruthTableCell } from '@/projects/Project';
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject';

const props = defineProps<Partial<IDockviewPanelProps>>()

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

// Access state from params
const { state, inputVars, outputVars } = TruthTableProject.useState()

console.log('[TruthTablePanel] State from useState:', {
  hasState: !!state.value,
  stateKeys: state.value ? Object.keys(state.value) : [],
  inputVars: inputVars.value,
  outputVars: outputVars.value,
  hasValues: !!(state.value?.values),
  state: state.value
})

// Local model for the table component
const tableValues = ref<TruthTableData>(state.value?.values ? state.value.values.map((row: TruthTableCell[]) => [...row]) : [])
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  console.log('[TruthTablePanel] Local tableValues changed:', newVal);
  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[TruthTablePanel] Skipping update (isUpdatingFromState)');
    return
  }
  console.log('[TruthTablePanel] Calling updateTruthTable');
  updateTruthTable(newVal)
}, { deep: true })

// Watch for external changes from state
watch(() => state.value?.values, (newVal) => {
  console.log('[TruthTablePanel] state.value.values changed:', newVal);
  if (newVal && JSON.stringify(newVal) !== JSON.stringify(tableValues.value)) {
    console.log('[TruthTablePanel] Updating tableValues from state');
    isUpdatingFromState = true
    tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
  }
}, { deep: true })
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-auto">
    <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" />
  </div>
</template>

<style scoped></style>
