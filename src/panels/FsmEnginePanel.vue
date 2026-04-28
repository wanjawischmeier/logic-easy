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


/* from project:
// reactive postmessage listener
const fsmHandler = (event: MessageEvent) => {
  if (event.data?.action === 'export') {
    const fsmData: FSMState = {
      states: event.data.fsm.states || [],
      transitions: event.data.fsm.transitions || [],
    }
    stateManager.state.automaton = { ...fsmData }
  }
}

let listenerAttached = false

function ensureFsmListener() {
  if (!listenerAttached) {
    window.addEventListener('message', fsmHandler)
    listenerAttached = true
    console.log('FSM listener attached')
  }
}

function disposeFsmListener() {
  if (listenerAttached) {
    window.removeEventListener('message', fsmHandler)
    listenerAttached = false
    console.log('FSM listener disposed')
  }
}*/
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold">{{ title }}</div>
    <IframePanel iframe-key="__fsm_preloaded_iframe" src="/logic-easy/fsm-engine/dist/index.html"
      :visible="params.api.isVisible" class="flex-1" />
  </div>
</template>

<style scoped></style>
