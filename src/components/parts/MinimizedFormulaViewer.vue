<template>
  <div v-if="formulas.length > 0" class="w-full flex justify-center overflow-visible">
    <div class="inline-flex items-center gap-3 min-w-0 max-w-full overflow-visible">
      <div v-if="showSelector" class="relative shrink-0">
        <FormulaSelector
          :formulas="props.formulas"
          :selectedIndex="localSelectedIndex"
          @update:selectedIndex="(v) => (localSelectedIndex = v)"
        />
      </div>

      <div class="min-w-0 flex-1 overflow-x-auto">
        <FormulaRenderer :latex-expression="selectedLatex" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import FormulaRenderer from '@/components/FormulaRenderer.vue'
import type { FunctionRepresentation } from '@/utility/types'
import { dropdownService } from '@/utility/dropdownService'
import FormulaSelector from '@/components/parts/FormulaSelector.vue'

const props = withDefaults(
  defineProps<{
    signature: string
    formulas: string[]
    functionRepresentation?: FunctionRepresentation
    selectedIndex?: number
    label?: string
  }>(),
  {
    selectedIndex: 0,
    label: 'Select formula',
  },
)

const emit = defineEmits<{
  (e: 'update:selectedIndex', value: number): void
}>()

const localSelectedIndex = ref(props.selectedIndex)

watch(
  () => props.selectedIndex,
  (value) => {
    localSelectedIndex.value = value
  },
)

watch(localSelectedIndex, (value) => {
  emit('update:selectedIndex', value)
})

const showSelector = computed(
  () => props.functionRepresentation !== 'Normal' && props.formulas.length > 1,
)

const selectedLatex = computed(() => {
  const term = props.formulas[localSelectedIndex.value] ?? props.formulas[0] ?? '0'
  return `${props.signature}${term}`
})
</script>
