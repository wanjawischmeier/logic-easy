<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import IframePanel from '@/components/IFramePanel.vue'
import {
  setIsSyncing,
  useFsmListener,
  forceSyncTableToEditor,
  consumeSuppressIncomingEditorExport,
} from '@/utility/fsm/EditorSync/fsmListener'
import { stateManager } from '@/projects/stateManager'
import { FsmProject } from '@/projects/state-machine/FsmProject'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null
const iframeRef = ref<any | null>(null)

let messageHandler: ((event: MessageEvent) => void) | null = null

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''
})

onMounted(() => {
  // Initialize FSM outbound sync when the FSM panel mounts.
  useFsmListener()

  // handle editor -> app exports: delegate concrete state handling to FsmProject
  messageHandler = (event: MessageEvent) => {
    const fsmIframe = iframeRef.value?.getIframe
      ? iframeRef.value.getIframe()
      : (window as any).__fsm_preloaded_iframe
    if (!fsmIframe) return
    if (event.origin !== window.location.origin || event.source !== fsmIframe.contentWindow) return

    const data = event.data || {}
    if ((data.action === 'export' || data.action === 'editorToTableExport') && data.fsm) {
      // if we suppressed the next editor export (because we forced a sync), consume suppression and ignore
      if (consumeSuppressIncomingEditorExport()) return

      const prevNodes = stateManager.state.fsm?.nodes?.length ?? 0
      let shouldForce = false

      try {
        setIsSyncing(true)
        FsmProject.importEditorExport(data.fsm)

        const nextNodes = stateManager.state.fsm?.nodes?.length ?? 0
        // mark whether we should force a single back-sync (do it after resetting isSyncing)
        shouldForce = nextNodes > prevNodes
      } finally {
        setTimeout(() => {
          setIsSyncing(false)
          if (shouldForce) forceSyncTableToEditor()
        }, 50)
      }
    }
  }

  window.addEventListener('message', messageHandler)
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
  if (messageHandler) window.removeEventListener('message', messageHandler)
})
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 bg-surface">
    <div v-if="title" class="font-semibold mb-2">{{ title }}</div>

    <IframePanel
      ref="iframeRef"
      iframe-key="__fsm_preloaded_iframe"
      src="/logic-easy/fsm-engine/dist/index.html"
      :visible="params.api.isVisible"
      class="flex-1 border-none"
    />
  </div>
</template>

<style scoped></style>
