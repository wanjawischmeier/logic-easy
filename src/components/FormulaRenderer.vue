<template>
  <div class="text-xl text-primary-variant p-2">
    <!-- container: latex left, copy button right -->
    <div class="relative flex items-center gap-2">
      <!-- latex renderer -->
      <div class="flex-1">
        <vue-latex :expression="latexExpression" display-mode />
      </div>

      <!-- TODO: Replace with proper button and checkmark -->
      <!-- copy button -->
      <button id="copy-to-clipboard" type="button" @click="copyLatex" :aria-pressed="copied" title="Copy LaTeX" class="ml-2 p-2
            text-on-surface-disabled hover:text-primary-variant focus:text-secondary-variant
              transition transform duration-100 ease-initial
              hover:scale-110 focus:scale-120 focus:outline-none" data-screenshot-ignore>

        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Toast } from '@/utility/toastService';
import { FunctionType, type Formula } from '@/utility/types';
import { computed, ref } from 'vue';

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

    if (formula.type === FunctionType.DNF) {
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

  const result = formula.type === FunctionType.DNF ? terms.join(' + ') : terms.join('');
  return `f(${varName}) = ${result}`;
});

const copied = ref(false);

async function copyLatex() {
  try {
    await navigator.clipboard.writeText(latexExpression.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1400);
  } catch (error) {
    console.error(`Failed to copy formula to clipboard: ${error}`)
    Toast.error('Failed to copy formula to clipboard');
  } finally {
    const btn = document.getElementById('copy-to-clipboard') as HTMLButtonElement | null;
    if (btn && document.activeElement === btn) btn.blur();
  }
}
</script>
