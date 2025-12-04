<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'  
import type { IDockviewPanelProps } from 'dockview-vue'
import MealyAutomat from '@/components/MealyAutomat.vue'

const props = defineProps<{
  params: IDockviewPanelProps  
}>()

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
  <div class="h-full flex flex-col p-2 overflow-hidden">  <!-- ✅ Dockview Layout -->
    <MealyAutomat />
  </div>
</template>
