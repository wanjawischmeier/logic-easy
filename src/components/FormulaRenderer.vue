<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Formula } from '@/utility/truthTableInterpreter';

const props = defineProps<{
  formulas: Record<string, Formula>;
}>();

const selectedType = ref('DNF');

const currentFormula = computed(() => {
  return props.formulas[selectedType.value];
});

const latexExpression = computed(() => {
  const formula = currentFormula.value;
  if (!formula || !formula.terms.length) return '';

  const terms = formula.terms.map(term => {
    if (term.literals.length === 0) return '1';

    if (formula.type === 'DNF') {
      // Product of literals
      return term.literals.map(lit => {
        return lit.negated ? `\\overline{${lit.variable}}` : lit.variable;
      }).join('');
    } else {
      // Sum of literals (CNF)
      const sum = term.literals.map(lit => {
        return lit.negated ? `\\overline{${lit.variable}}` : lit.variable;
      }).join(' + ');
      return `(${sum})`;
    }
  });

  if (formula.type === 'DNF') {
    return terms.join(' + ');
  } else {
    // CNF: Product of sums
    return terms.join('');
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2 text-sm">
      <button v-for="type in Object.keys(formulas)" :key="type" @click="selectedType = type"
        :class="['px-2 py-1 rounded', selectedType === type ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300']">
        {{ type }}
      </button>
    </div>
    <div class="text-xl text-blue-300 p-2">
      <vue-latex :expression="latexExpression" display-mode />
    </div>
  </div>
</template>
