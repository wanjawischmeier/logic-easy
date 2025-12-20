<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { logicCircuits } from '@/utility/logicCircuitsWrapper'
import IframePanel from '@/components/IFramePanel.vue'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

onMounted(() => {
  console.log('LogicCircuitsTestingPanel mounted')

  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')
  disposable?.dispose?.()
})

async function loadFile() {
  const success = await logicCircuits.loadFile({
    content: '[0.8.12-patch1,0,0,1,1]\r\n[{2,115,194,0,,1n};\r\n{8,233,188,0,n,}]\r\n[{0o0};\r\n{1i0}]\r\n[{0,1}]\r\n[{68,-54,12,0,yay,0}]\r\n[]'
  })

  if (!success) {
    console.error('Failed to load file')
  }
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <button @click="loadFile" class="w-50 bg-surface-2 hover:bg-surface-3">Import
      BasicTest.lc</button>
    <IframePanel iframe-key="__lc_preloaded_iframe" src="/logic-easy/logic-circuits/index.html"
      :visible="params.api.isVisible" class="flex-1" />
  </div>
</template>

<style scoped></style>
