<script setup lang="ts">
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import { minifyTruthTable } from '@/utility/espresso'
import { interpretMinifiedTable, type Formula } from '@/utility/truthTableInterpreter'
import type { TruthTableData } from '@/utility/types'
import { dockComponents } from '@/components/dockRegistry'
import { stateManager } from '@/utility/stateManager'

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

  const updateTruthTable = async (newValues: TruthTableData) => {
    stateManager.state.truthTable.values = newValues

    // Calculate formulas for each output variable
    const formulas: Record<string, Record<string, Formula>> = {}

    for (let outputIdx = 0; outputIdx < stateManager.state.truthTable.outputVars.length; outputIdx++) {
      const outputVar = stateManager.state.truthTable.outputVars[outputIdx]
      if (!outputVar) continue

      // Extract single output column
      const singleOutputValues = newValues.map(row => [row[outputIdx]]) as TruthTableData

      // 1. DNF: Minify ON-set
      const minifiedDNF = await minifyTruthTable(
        stateManager.state.truthTable.inputVars,
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
        stateManager.state.truthTable.inputVars,
        [outputVar],
        invertedValues
      )

      const castMinifiedDNF = minifiedDNF as unknown as TruthTableData
      const castMinifiedCNF = minifiedCNF as unknown as TruthTableData

      formulas[outputVar] = {
        DNF: interpretMinifiedTable(castMinifiedDNF, 'DNF', stateManager.state.truthTable.inputVars),
        CNF: interpretMinifiedTable(castMinifiedCNF, 'CNF', stateManager.state.truthTable.inputVars)
      }
    }

    stateManager.state.truthTable.formulas = formulas
  }

  // Initial calculation
  updateTruthTable(stateManager.state.truthTable.values)

    // expose shared params for dynamic panels
    ; (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams = {
      state: stateManager.state.truthTable,
      updateTruthTable,
    };

  event.api.addPanel({
    id: 'panel_1',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable
    },
  })

  event.api.addPanel({
    id: 'panel_kv',
    component: 'kv-diagram',
    title: 'KV Diagram',
    position: { referencePanel: 'panel_1', direction: 'right' },
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-1">
    <div class="h-[30px]">
      <DockViewHeader />
    </div>

    <div class="h-px bg-surface-2"></div>

    <div class="flex-1 min-h-0">
      <dockview-vue class="dockview-theme-abyss w-full h-[calc(100vh-30px)]" :components="componentsForDockview"
        @ready="onReady" />
    </div>
  </div>
</template>
