<script setup lang="ts">
import { inject, ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
const message = inject<string>('vu3ProvideInjectEvidenceTestMessage') ?? 'not found'
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
</script>

<template>
  <div style="height:100%; color:red;">
    Hello World
    <div>{{ title }}</div>
    <div>{{ message }}</div>
  </div>
</template>

<style scoped></style>
