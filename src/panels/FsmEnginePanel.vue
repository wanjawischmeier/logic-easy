<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import IframePanel from '@/components/IFramePanel.vue'

const props = defineProps<{ params: IDockviewPanelProps }>()

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
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold">{{ title }}</div>
    <IframePanel
      iframe-key="__fsm_preloaded_iframe"
      src="/logic-easy/fsm-engine/index.html"
      :visible="params.api.isVisible"
      class="flex-1"
    />
  </div>
</template>

<style scoped></style>
