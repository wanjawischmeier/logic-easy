<script setup lang="ts">
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue'
import TruthTablePanel from '@/panels/TruthTablePanel.vue'

const dockComponents = {
  'truth-table': TruthTablePanel,
  'espresso-testing-panel': EspressoTestingPanel,
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)
  // Example variables and values
  const inputVars = ['a', 'b', 'c']
  const outputVars = ['Q']
  // 2^3 = 8 rows, 1 output column
  const values = [
    [0],
    [0],
    [0],
    [0],
    [0],
    [0],
    [0],
    [0],
  ]
  event.api.addPanel({
    id: 'panel_1',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      inputVars,
      outputVars,
      values,
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
