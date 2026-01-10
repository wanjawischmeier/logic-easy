<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex gap-4 text-sm justify-end">
      <MultiSelectSwitch v-if="outputVars.length > 1" :label="'Output Variable'" :values="outputVars"
        :initialSelected="selectedOutputIndex" :onSelect="(v, i) => selectedOutputIndex = i">
      </MultiSelectSwitch>

      <MultiSelectSwitch :label="'Function Type'" :values="functionTypes"
        :initialSelected="functionTypes.indexOf(selectedFunctionType)"
        :onSelect="(v, i) => selectedFunctionType = v as FunctionType">
      </MultiSelectSwitch>
      <DownloadButton :target-ref="screenshotRef" filename="kv" :latex-content="projectLatex" />
    </div>

    <div class="h-full" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="h-full flex flex-col items-center justify-center overflow-auto">
        <KVDiagram class="" :key="`${selectedFunctionType}-${selectedOutputIndex}`" v-model="tableValues"
          :input-vars="inputVars" :output-vars="outputVars" :output-index="selectedOutputIndex"
          :minified-values="minifiedValues || []" :formula="currentFormula" :functionType="selectedFunctionType" />

        <div class="mt-4 w-full justify-center">
          <FormulaRenderer :latex-expression="getLatexExpression(selectedOutputIndex)" />
        </div>

        <QMCViewer :input-vars="inputVars" :output-vars="outputVars" :values="tableValues"
          :output-variable-index="selectedOutputIndex" :function-type="selectedFunctionType"
          :minified-values="minifiedValues" :formulas="formulas"></QMCViewer>
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div v-for="(outputVar, index) in outputVars" :key="`screenshot-${outputVar}-${selectedFunctionType}`"
          class="flex flex-col items-center gap-4">
          <KVDiagram v-model="tableValues" :input-vars="inputVars" :output-vars="outputVars" :output-index="index"
            :minified-values="minifiedValues || []"
            :formula="formulas[outputVar]?.[selectedFunctionType] || Formula.empty"
            :functionType="selectedFunctionType" />

          <FormulaRenderer :latex-expression="getLatexExpression(index)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import KVDiagram from '@/components/KVDiagram.vue';
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import DownloadButton from '@/components/parts/DownloadButton.vue'
import { Formula, FunctionType } from '@/utility/types';
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/projects/stateManager';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { getDockviewApi } from '@/utility/dockview/integration';
import QMCViewer from '@/components/QMCViewer.vue';

const props = defineProps<Partial<IDockviewPanelProps>>()

let disposable: { dispose?: () => void } | null = null

// Load saved panel state
const kvDiagramRef = ref<InstanceType<typeof KVDiagram>>()
const screenshotRef = ref<HTMLElement | null>(null)

onMounted(() => {
  const api = getDockviewApi()
  if (!api) return

  // Listen to panel visibility changes
  // TODO: Optimize this, rn just for testing
  const visibilityDisposable = api.onDidActivePanelChange(() => {
    if (props.params.api.isActive) {
      // Panel became active/visible - refresh latex rendering
      console.log('Refresh kv diagram')
      kvDiagramRef.value?.refresh()
    }
  })

  // Store unsubscribe for cleanup
  disposable = {
    dispose: () => {
      visibilityDisposable.dispose()
    }
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

const functionTypes = computed(() =>
  Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>)
);

// Access state from params
const { inputVars, outputVars, values, minifiedValues, formulas, outputVariableIndex, functionType } = TruthTableProject.useState()

const selectedOutputIndex = ref(outputVariableIndex.value);
const selectedFunctionType = ref<FunctionType>(functionType.value);
const tableValues = ref<TruthTableData>(values.value.map((row: TruthTableCell[]) => [...row]))
let isUpdatingFromState = false

// Watch for local changes and notify DockView
watch(tableValues, (newVal) => {
  console.log('[KVDiagramPanel] Local tableValues changed:', newVal);
  if (!stateManager.state.truthTable) return

  if (isUpdatingFromState) {
    isUpdatingFromState = false
    console.log('[KVDiagramPanel] Skipping update (isUpdatingFromState)');
    return
  }

  console.log('[KVDiagramPanel] Calling updateTruthTable');
  Object.assign(stateManager.state.truthTable.values, newVal);
  updateTruthTable()
}, { deep: true })

// Watch for external changes from state (use getter so watcher tracks the computed ref)
watch(() => values.value, (newVal) => {
  console.log('[KVPanel] state.value.values changed:', newVal);
  if (!newVal) return
  isUpdatingFromState = true
  tableValues.value = newVal.map((row: TruthTableCell[]) => [...row])
}, { deep: true })

watch(() => selectedFunctionType.value, (functionType) => {
  if (!stateManager.state.truthTable) return
  stateManager.state.truthTable.functionType = functionType;
})

watch(() => selectedOutputIndex.value, (ouputIndex) => {
  if (!stateManager.state.truthTable) return
  stateManager.state.truthTable.outputVariableIndex = ouputIndex;
})

const currentFormula = computed(() => {
  const outputVar = outputVars.value[selectedOutputIndex.value];
  if (!outputVar) {
    return Formula.empty;
  }

  return formulas.value[outputVar]?.[selectedFunctionType.value];
});

const projectLatex = computed(() => {
  const expressions: string[] = [];

  for (let i = 0; i < outputVars.value.length; i++) {
    const expr = getLatexExpression(i);
    expressions.push(`$$${expr}$$`);
  }

  return expressions.join('\n\n');
});

function getLatexExpression(outputVariableIndex: number) {
  const varName = outputVars.value[outputVariableIndex];
  if (!varName || !currentFormula.value?.terms.length) return `f(${varName}) = ...`;

  const terms = currentFormula.value.terms.map(term => {
    if (term.literals.length === 0) return '1';

    if (currentFormula.value?.type === FunctionType.DNF) {
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

  const result = currentFormula.value.type === FunctionType.DNF ? terms.join(' + ') : terms.join('');
  return `f(${varName}) = ${result}`;
}
</script>
