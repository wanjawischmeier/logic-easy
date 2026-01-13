<template>
  <div class="h-full text-on-surface flex flex-col p-2 overflow-hidden">

    <div class="w-full flex flex-wrap-reverse text-sm justify-end items-center gap-2">
      <SettingsButton :input-vars="inputVars" :output-vars="outputVars" :selected-output-index="outputVariableIndex"
        :selected-function-type="functionType" :input-selection="inputSelection"
        :custom-setting-slot-labels="{ 'show-formula': 'Show formula' }">
        <template #show-formula>
          <div class="flex gap-2 items-center" @click.stop>
            <Checkbox v-model="showFormula" />
            <div class="text-xs min-w-25">
              <span v-if="showFormula">Showing respective formula</span>
              <span v-else>Toggle to show formula</span>
            </div>
          </div>
        </template>
      </SettingsButton>

      <DownloadButton :target-ref="screenshotRef" filename="kv" :latex-content="couplingTermLatex" />
    </div>

    <div class="h-full" ref="screenshotRef">
      <!-- Interactive view -->
      <div data-screenshot-ignore class="h-full flex flex-col items-center overflow-auto">

        <KVDiagram :key="`${functionType}-${outputVariableIndex}`" :values="tableValues" :input-vars="inputVars"
          :output-vars="outputVars" :outputVariableIndex="outputVariableIndex" :formulas="formulas"
          :functionType="functionType" :input-selection="inputSelection" @values-changed="tableValues = $event" />

        <FormulaRenderer v-if="couplingTermLatex && showFormula" class="pt-8" :latex-expression="couplingTermLatex" />
        <FormulaRenderer v-if="showFormula" class="pt-8" :latex-expression="getLatexExpression(outputVariableIndex)" />
      </div>

      <!-- Screenshot-only view -->
      <div data-screenshot-only-flex class="hidden flex-row gap-32 items-start justify-center p-8">
        <div v-for="(outputVar, index) in outputVars" :key="`screenshot-${outputVar}-${functionType}`"
          class="flex flex-col items-center gap-4">
          <KVDiagram :values="tableValues" :input-vars="inputVars" :output-vars="outputVars"
            :outputVariableIndex="index" :formulas="formulas" :functionType="functionType"
            :input-selection="inputSelection" @values-changed="tableValues = $event" />

          <FormulaRenderer :latex-expression="couplingTermLatex" v-if="couplingTermLatex">
          </FormulaRenderer>
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
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import Checkbox from '@/components/parts/Checkbox.vue';
import { updateTruthTable } from '@/utility/truthtable/interpreter';
import type { IDockviewPanelProps } from 'dockview-vue';
import { stateManager } from '@/projects/stateManager';
import { TruthTableProject, type TruthTableCell, type TruthTableData } from '@/projects/truth-table/TruthTableProject';
import { getDockviewApi } from '@/utility/dockview/integration';
import { Formula, FunctionType } from '@/utility/types';

interface KVPanelState {
  showFormula: boolean
}

const props = defineProps<Partial<IDockviewPanelProps>>()
const panelState = stateManager.getPanelState<KVPanelState>(props.params.api.id)
const showFormula = ref(panelState?.showFormula ?? true)
const kvDiagramRef = ref<InstanceType<typeof KVDiagram>>()
const screenshotRef = ref<HTMLElement | null>(null)

// Auto-save panel state when values change
stateManager.watchPanelState<KVPanelState>(props.params.api.id, () => ({
  showFormula: showFormula.value
}))

let disposable: { dispose?: () => void } | null = null

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

// Access state from params
const { inputVars, outputVars, values, formulas, outputVariableIndex, functionType, inputSelection, couplingTermLatex } = TruthTableProject.useState()

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

const currentFormula = computed(() => {
  const outputVar = outputVars.value[outputVariableIndex.value];
  if (!outputVar) {
    return Formula.empty;
  }

  return formulas.value[outputVar]?.[functionType.value];
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
