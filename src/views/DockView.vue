<script setup lang="ts">
import BasicPanel from '../panels/BasicPanel.vue'
import type { DockviewReadyEvent } from 'dockview-vue'

const dockComponents = {
  'basic-panel': BasicPanel,
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
    component: 'basic-panel',
    title: 'Panel 2',
    position: { referencePanel: 'panel_1', direction: 'right' },
  })
}
</script>

<template>
  <div style="height:100vh;">
    <dockview-vue class="dockview-theme-abyss" style="width:100%; height:100%" :components="dockComponents"
      @ready="onReady">
    </dockview-vue>
  </div>
</template>

<style scoped></style>
