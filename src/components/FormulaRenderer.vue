<script setup lang="ts">
import { computed } from 'vue';
import type { Formula } from '@/utility/truthTableInterpreter';

const props = defineProps<{
  formula?: Formula;
  outputVar?: string;
}>();

const latexExpression = computed(() => {
  const formula = props.formula;
  const varName = props.outputVar || 'x';

  if (!formula || !formula.terms.length) return `f(${varName}) = ...`;

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

      if (term.literals.length === 1) {
        return sum;
      } else {
        return `(${sum})`;
      }
    }
  });

  const result = formula.type === 'DNF' ? terms.join(' + ') : terms.join('');
  return `f(${varName}) = ${result}`;
});
</script>

<template>
  <div class="text-xl text-primary-variant p-2">
    <vue-latex :expression="latexExpression" display-mode />
  </div>
</template>
