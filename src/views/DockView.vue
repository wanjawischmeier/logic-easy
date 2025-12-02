<script setup lang="ts">
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue'
import TruthTablePanel from '@/panels/TruthTablePanel.vue'
import { reactive } from 'vue'
import { minifyTruthTable } from '@/utility/espresso'
import { interpretMinifiedTable, type Formula } from '@/utility/truthTableInterpreter'
import type { TruthTableData } from '@/components/TruthTable.vue'

const dockComponents = {
  'truth-table': TruthTablePanel,
  'espresso-testing-panel': EspressoTestingPanel,
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)

  const inputVars = ['a', 'b', 'c']
  const outputVars = ['x']

  const truthTableState = reactive({
    inputVars,
    outputVars,
    values: [
      [1], [1], [1], [1],
      [0], [0], ['-'], [1],
    ] as TruthTableData,
    minifiedValues: [] as TruthTableData,
    formulas: {} as Record<string, Formula>
  })

  const updateTruthTable = async (newValues: TruthTableData) => {
    truthTableState.values = newValues

    // 1. DNF: Minify ON-set (original values)
    const minifiedDNF = await minifyTruthTable(
      truthTableState.inputVars,
      truthTableState.outputVars,
      newValues
    )

    // 2. CNF: Minify OFF-set (invert outputs)
    const numInputs = truthTableState.inputVars.length
    const invertedValues = newValues.map(row => {
      return row.map((val, idx) => {
        if (idx < numInputs) return val // Input column
        // Output column
        if (val === 1) return 0
        if (val === 0) return 1
        return val // '-'
      })
    }) as TruthTableData

    const minifiedCNF = await minifyTruthTable(
      truthTableState.inputVars,
      truthTableState.outputVars,
      invertedValues
    )

    const castMinifiedDNF = minifiedDNF as unknown as TruthTableData
    const castMinifiedCNF = minifiedCNF as unknown as TruthTableData

    truthTableState.minifiedValues = castMinifiedDNF

    truthTableState.formulas = {
      DNF: interpretMinifiedTable(castMinifiedDNF, 'DNF', truthTableState.inputVars),
      CNF: interpretMinifiedTable(castMinifiedCNF, 'CNF', truthTableState.inputVars)
    }
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
    id: 'panel_2',
    component: 'espresso-testing-panel',
    title: 'Espresso Panel',
    position: { referencePanel: 'panel_1', direction: 'right' },
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
