<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import IframePanel from '@/components/IFramePanel.vue'
import { useFsmListener } from '@/utility/fsm/EditorSync/fsmListener';

const props = defineProps<{ params: IDockviewPanelProps }>()
useFsmListener()

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
  <div class="h-full text-white flex flex-col p-2 bg-surface">
    <div v-if="title" class="font-semibold mb-2">{{ title }}</div>

    <IframePanel
      iframe-key="__fsm_preloaded_iframe"
      src="/logic-easy/fsm-engine/dist/index.html"
      :visible="params.api.isVisible"
      class="flex-1 border-none"
    />
  </div>
</template>
