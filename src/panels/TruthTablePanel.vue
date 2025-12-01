<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import TruthTable, { type TruthTableCell } from '../components/TruthTable.vue'
import KVDiagram from '@/components/KVDiagram.vue';

const props = defineProps<{ params: IDockviewPanelProps & { inputVars?: string[]; outputVars?: string[]; values?: TruthTableCell[][] } }>()

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


// Support both direct and nested params (for DockView API)
let inputVars: string[] = []
let outputVars: string[] = []
let initialValues: TruthTableCell[][] = []
if (props.params.inputVars && props.params.outputVars && props.params.values) {
  inputVars = props.params.inputVars
  outputVars = props.params.outputVars
  initialValues = props.params.values
} else if (
  props.params.params &&
  props.params.params.inputVars &&
  props.params.params.outputVars &&
  props.params.params.values
) {
  inputVars = props.params.params.inputVars
  outputVars = props.params.params.outputVars
  initialValues = props.params.params.values
}
const tableValues = ref<TruthTableCell[][]>(initialValues.map(row => [...row]))
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 overflow-hidden">
    <div class="font-semibold mb-2">TruthTable</div>
    <TruthTable v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" />

    <div class="font-semibold mb-2">KV Diagram</div>
    <KVDiagram :input-vars="inputVars" :output-vars="outputVars" :model-value="tableValues" />
  </div>
</template>

<style scoped></style>
