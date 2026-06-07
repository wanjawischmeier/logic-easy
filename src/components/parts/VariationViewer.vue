<template>
  <div v-if="variations.length > 0" class="w-full flex justify-center overflow-visible">
    <div class="inline-flex items-center gap-3 min-w-0 max-w-full overflow-visible">
      <div
        v-if="variations.length > 1 && functionRepresentation === 'Minimal'"
        class="relative shrink-0"
      >
        <VariationSelector
          :formulas="latexStrings"
          v-model:selected-index="currentVariationIndex"
        />
      </div>

      <div class="min-w-0 flex-1 overflow-x-auto">
        <FormulaRenderer :latex-expression="selectedLatex" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FormulaRenderer from '@/components/FormulaRenderer.vue'
import type { FormulaVariation, FunctionRepresentation } from '@/utility/types'
import VariationSelector from '@/components/parts/VariationSelector.vue'

const currentVariationIndex = defineModel<number>('currentVariationIndex')
const props = defineProps<{
  functionRepresentation: FunctionRepresentation
  variations: FormulaVariation[]
}>()

const latexStrings = computed(() => props.variations.map((v) => v.latex))

const selectedLatex = computed(() => {
  const index = currentVariationIndex.value ?? 0
  return props.variations[index]?.latex ?? '0'
})
</script>
