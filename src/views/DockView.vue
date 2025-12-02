<script setup lang="ts">
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue'
import TruthTablePanel from '@/panels/TruthTablePanel.vue'
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue'
import { reactive } from 'vue'
import { minifyTruthTable } from '@/utility/espresso'
import { interpretMinifiedTable, type Formula } from '@/utility/truthTableInterpreter'
import type { TruthTableData } from '@/components/TruthTable.vue'

const dockComponents = {
  'truth-table': TruthTablePanel,
  'kv-diagram': KVDiagramPanel,
  'espresso-testing-panel': EspressoTestingPanel,
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)

  const inputVars = ['a', 'b', 'c']
  const outputVars = ['x', 'y']

  const truthTableState = reactive({
    inputVars,
    outputVars,
    values: [
      [1, 0], [1, 0], [1, 0], [1, 1],
      [0, 1], [0, 0], ['-', 1], [1, 1],
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
  <div class="flex flex-col h-screen">
    <div class="h-[50px]">
      <DockViewHeader />
    </div>

    <div class="flex-1 min-h-0">
      <dockview-vue class="dockview-theme-abyss w-full h-[calc(100vh-50px)]" :components="dockComponents"
        @ready="onReady" />
    </div>
  </div>
</template>
