<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent, DockviewApi } from 'dockview-vue'
import { updateTruthTable } from '@/utility/truthTableInterpreter'
import { dockComponents } from '@/components/dockRegistry'
import { stateManager } from '@/utility/stateManager'
import GettingStartedView from './GettingStartedView.vue'
import { popupService } from '@/utility/popupService'

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
const dockviewApi = ref<DockviewApi | null>(null)
let layoutChangeDisposable: { dispose?: () => void } | null = null
let panelDisposable: { dispose?: () => void } | null = null

const hasPanels = ref(true)
const LAYOUT_STORAGE_KEY = 'dockview_layout'

const loadDefaultLayout = (api: DockviewApi) => {
  api.addPanel({
    id: 'panel_1',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable
    },
  })

  api.addPanel({
    id: 'panel_kv',
    component: 'kv-diagram',
    title: 'KV Diagram',
    position: { referencePanel: 'panel_1', direction: 'right' },
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable,
    },
  })
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)
  dockviewApi.value = event.api

    // Expose dockview API and shared panel params so HeaderMenuBar can add panels
    ; (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api = event.api as unknown as DockviewApiMinimal;


  // Initial calculation
  updateTruthTable(stateManager.state.truthTable.values)

    // expose shared params for dynamic panels
    ; (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams = {
      state: stateManager.state.truthTable,
      updateTruthTable,
    };

  // Try to load saved layout
  let success = false
  const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)

  if (savedLayout) {
    try {
      const layout = JSON.parse(savedLayout)
      event.api.fromJSON(layout)
      success = true
      console.log('Loaded layout from localStorage')

      // Update all panel params to use current state reference
      // This ensures restored panels don't use stale state from localStorage
      event.api.panels.forEach(panel => {
        panel.api.updateParameters({
          state: stateManager.state.truthTable,
          updateTruthTable,
        })
      })
    } catch (err) {
      console.error('Failed to load layout from localStorage:', err)
    }
  }

  // Load default layout if loading failed
  if (!success) {
    loadDefaultLayout(event.api)
  }

  // Track panel count
  const updatePanelCount = () => {
    hasPanels.value = event.api.panels.length > 0
  }

  updatePanelCount()

  // Listen for panel additions and removals
  panelDisposable = event.api.onDidAddPanel(() => updatePanelCount())
  const removeDisposable = event.api.onDidRemovePanel(() => updatePanelCount())

  const originalPanelDispose = panelDisposable.dispose
  panelDisposable.dispose = () => {
    originalPanelDispose?.()
    removeDisposable.dispose()
  }

  // Setup auto-save on layout changes
  layoutChangeDisposable = event.api.onDidLayoutChange(() => {
    try {
      const layout = event.api.toJSON()

      // Remove state and updateTruthTable from panel params before saving
      // We only want to save the layout structure, not the actual state data
      if (layout.panels && 'panels' in layout.panels) {
        const panels = layout.panels as { panels?: Array<{ params?: Record<string, unknown> }> };
        panels.panels?.forEach(panel => {
          if (panel.params) {
            delete panel.params.state
            delete panel.params.updateTruthTable
          }
        })
      }

      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
      console.log('Layout saved to localStorage')
    } catch (err) {
      console.error('Failed to save layout to localStorage:', err)
    }
  })
}

onBeforeUnmount(() => {
  layoutChangeDisposable?.dispose?.()
  panelDisposable?.dispose?.()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-1">
    <div class="h-[35px]">
      <DockViewHeader />
    </div>

    <div class="h-px bg-surface-2"></div>

    <div class="flex-1 min-h-0 relative">
      <dockview-vue class="dockview-theme-abyss w-full" :class="hasPanels ? 'h-[calc(100vh-36px)]' : 'h-0'"
        :components="componentsForDockview" :disableAutoFocus="true" @ready="onReady" />

      <GettingStartedView v-if="!hasPanels"></GettingStartedView>

      <!-- Popup System -->
      <component v-if="popupService.current.value" :is="popupService.current.value.component"
        v-bind="popupService.current.value.props" />
    </div>
  </div>
</template>
