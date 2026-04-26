<!--

# FSM Engine Panel
*Panel wrapper for the FSM editor iframe.*
The purpose of this panel is to integrate the external FSM editor into dockview while keeping sync lifecycle safe.

## Responsibilities
- Mount iframe panel with the FSM editor source.
- Connect panel lifecycle to automaton listener setup/cleanup.
- Keep panel code focused on embedding and lifecycle wiring.

## Runtime behavior
- Uses the preloaded FSM iframe key.
- Attaches editor message listener on mount.
- Disposes listener on unmount.
- Leaves data normalization and sync decisions to automaton domain modules.

## Boundaries
This panel is an integration shell around the iframe.
It should not contain automaton transformation logic itself.

-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import IframePanel from '@/components/IFramePanel.vue'
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'

const props = defineProps<{ params: IDockviewPanelProps }>()

onMounted(() => {
  AutomatonProject.attachFsmListener()
})

onBeforeUnmount(() => {
  AutomatonProject.disposeFsmListener()
})

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
    <IframePanel
      iframe-key="__fsm_preloaded_iframe"
      src="/logic-easy/fsm-engine/dist/index.html"
      :visible="params.api.isVisible"
      class="flex-1"
    />
  </div>
</template>
