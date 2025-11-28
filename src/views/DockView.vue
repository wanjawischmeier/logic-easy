<script setup lang="ts">
import BasicPanel from '../panels/BasicPanel.vue'
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue'

const dockComponents = {
  'basic-panel': BasicPanel,
  'espresso-testing-panel': EspressoTestingPanel,
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)
  event.api.addPanel({
    id: 'panel_1',
    component: 'basic-panel',
    title: 'Panel 1',
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
