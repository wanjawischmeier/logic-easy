<script setup lang="ts">
import { computed } from 'vue';
import type { Formula } from '@/utility/truthTableInterpreter';

const props = defineProps<{
  formula?: Formula;
}>();

const latexExpression = computed(() => {
  const formula = props.formula;
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
  <div class="text-xl text-blue-300 p-2">
    <vue-latex :expression="latexExpression" display-mode />
  </div>
</template>
