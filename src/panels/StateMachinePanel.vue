<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import StateMachine from '@/components/StateMachine.vue';

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('State Machine')
let disposable: { dispose?: () => void } | null = null

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? 'State Machine'
  })
  title.value = props.params.api.title ?? 'State Machine'
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})
</script>

<template>
  <div class="h-full w-full overflow-hidden">
    <StateMachine class="h-full w-full" />
  </div>
</template>

<style scoped></style>
