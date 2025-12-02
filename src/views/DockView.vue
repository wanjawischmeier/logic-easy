<script setup lang="ts">
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import { reactive } from 'vue'
import { minifyTruthTable } from '@/utility/espresso'
import { interpretMinifiedTable, type Formula } from '@/utility/truthTableInterpreter'
import type { TruthTableData } from '@/components/TruthTable.vue'
import { dockComponents } from '@/components/dockRegistry'

type DockviewApiMinimal = {
  addPanel: (opts: {
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: unknown;
  }) => void;
};

const componentsForDockview = dockComponents;

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)

    // Expose dockview API and shared panel params so HeaderMenuBar can add panels
    ; (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api = event.api as unknown as DockviewApiMinimal;

  // We'll expose shared params (state + updateTruthTable) so dynamically added
  // panels receive the same params as the initial ones.
  // Define below after truthTableState & updateTruthTable are created.

  const inputVars = ['a', 'b', 'c', 'd']
  const outputVars = ['x', 'y']

  const truthTableState = reactive({
    inputVars,
    outputVars,
    values: [
      [1, 0], [1, 0], [1, 0], [1, 1],
      [1, 1], [1, 0], ['-', 1], [0, 1],
      [0, 0], [1, 0], [1, 0], [1, 1],
      ['-', 1], [0, 0], ['-', 1], [0, 1],
    ] as TruthTableData,
    minifiedValues: [] as TruthTableData,
    formulas: {} as Record<string, Record<string, Formula>>
  })

  const updateTruthTable = async (newValues: TruthTableData) => {
    truthTableState.values = newValues

    // Calculate formulas for each output variable
    const formulas: Record<string, Record<string, Formula>> = {}

    for (let outputIdx = 0; outputIdx < truthTableState.outputVars.length; outputIdx++) {
      const outputVar = truthTableState.outputVars[outputIdx]
      if (!outputVar) continue

      // Extract single output column
      const singleOutputValues = newValues.map(row => [row[outputIdx]]) as TruthTableData

      // 1. DNF: Minify ON-set
      const minifiedDNF = await minifyTruthTable(
        truthTableState.inputVars,
        [outputVar],
        singleOutputValues
      )

      // 2. CNF: Minify OFF-set (invert output)
      const invertedValues = singleOutputValues.map(row => {
        const val = row[0]
        if (val === 1) return [0]
        if (val === 0) return [1]
        return [val]
      }) as TruthTableData

      const minifiedCNF = await minifyTruthTable(
        truthTableState.inputVars,
        [outputVar],
        invertedValues
      )

      const castMinifiedDNF = minifiedDNF as unknown as TruthTableData
      const castMinifiedCNF = minifiedCNF as unknown as TruthTableData

      formulas[outputVar] = {
        DNF: interpretMinifiedTable(castMinifiedDNF, 'DNF', truthTableState.inputVars),
        CNF: interpretMinifiedTable(castMinifiedCNF, 'CNF', truthTableState.inputVars)
      }
    }

    truthTableState.formulas = formulas
  }

  // Initial calculation
  updateTruthTable(truthTableState.values)

    // expose shared params for dynamic panels
    ; (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams = {
      state: truthTableState,
      updateTruthTable,
    };

  event.api.addPanel({
    id: 'panel_1',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      state: truthTableState,
      updateTruthTable
    },
  })

  event.api.addPanel({
    id: 'panel_kv',
    component: 'kv-diagram',
    title: 'KV Diagram',
    position: { referencePanel: 'panel_1', direction: 'right' },
    params: {
      state: truthTableState,
      updateTruthTable
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-screen bg-[#1c1c2a]">
    <div class="h-[30px]">
      <DockViewHeader />
    </div>

    <div class="h-px bg-[#2b2b4a]"></div>

    <div class="flex-1 min-h-0">
      <dockview-vue class="dockview-theme-abyss w-full h-[calc(100vh-30px)]" :components="componentsForDockview"
        @ready="onReady" />
    </div>
  </div>
</template>
