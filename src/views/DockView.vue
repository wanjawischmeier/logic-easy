<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent, DockviewApi } from 'dockview-vue'
import { updateTruthTable } from '@/utility/truthTableInterpreter'
import { dockComponents } from '@/components/dockRegistry'
import { stateManager } from '@/utility/states/stateManager'
import { projectManager } from '@/utility/states/projectManager'
import GettingStartedView from './GettingStartedView.vue'
import { popupService } from '@/utility/popupService'
import ProjectCreationPopup from '@/components/popups/ProjectCreationPopup.vue'

type DockviewApiMinimal = {
  addPanel: (opts: {
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: unknown;
  }) => void;
  panels: Array<{
    id: string;
    api: {
      setActive: () => void;
    };
  }>;
};

const componentsForDockview = dockComponents;
const dockviewApi = ref<DockviewApi | null>(null)
let layoutChangeDisposable: { dispose?: () => void } | null = null
let panelDisposable: { dispose?: () => void } | null = null

const hasPanels = ref(true)
const LAYOUT_STORAGE_KEY = 'dockview_layout'

const loadDefaultLayout = (api: DockviewApi) => {
  api.addPanel({
    id: 'truth-table',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      state: stateManager.state!.truthTable,
      updateTruthTable
    },
  })

  api.addPanel({
    id: 'kv-diagram',
    component: 'kv-diagram',
    title: 'KV Diagram',
    position: { referencePanel: 'truth-table', direction: 'right' },
    params: {
      state: stateManager.state!.truthTable,
      updateTruthTable,
    },
  })
}

const onReady = (event: DockviewReadyEvent) => {
  dockviewApi.value = event.api

    // Expose dockview API and shared panel params so HeaderMenuBar can add panels
    ; (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api = event.api as unknown as DockviewApiMinimal;

  // Initial calculation
  if (stateManager.state!.truthTable) {
    updateTruthTable(stateManager.state!.truthTable.values)
  }

  // Try to load saved layout
  const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)

  if (savedLayout) {
    try {
      const layout = JSON.parse(savedLayout)
      event.api.fromJSON(layout)
      console.log('Loaded layout from localStorage')

      // Check if any panels were restored
      if (event.api.panels.length === 0 && stateManager.state.truthTable) {
        console.log('No panels in saved layout, restoring default layout')
        loadDefaultLayout(event.api)
      } else {
        // Update all panel params to use current state reference
        event.api.panels.forEach(panel => {
          panel.api.updateParameters({
            state: stateManager.state!.truthTable,
            updateTruthTable,
          })
        })
      }
    } catch (err) {
      console.error('Failed to load layout from localStorage:', err)
      console.warn('Falling back to default layout')
      loadDefaultLayout(event.api)
    }
  }

  // Track panel count
  const updatePanelCount = () => {
    const panelCount = event.api.panels.length
    hasPanels.value = panelCount > 0

    // Close project when all panels are closed
    if (panelCount === 0) {
      projectManager.closeCurrentProject()
    }
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

const popupProps = ref<Record<string, unknown>>({})

const handleProjectCreate = (projectName: string) => {
  const popup = popupService.current.value
  if (!popup || !popupService.isProjectCreation) return

  if ('onProjectCreate' in popup) {
    popup.onProjectCreate(projectName, popupProps.value)
  }
  popupService.close()
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
      <template v-if="popupService.current.value">
        <!-- Generic Popup -->
        <component v-if="!popupService.isProjectCreation && 'component' in popupService.current.value"
          :is="popupService.current.value.component" v-bind="popupService.current.value.props" />

        <!-- Project Creation Popup -->
        <ProjectCreationPopup
          v-if="popupService.isProjectCreation && 'projectPropsComponent' in popupService.current.value" :visible="true"
          @close="popupService.close" @create="handleProjectCreate">
          <component :is="popupService.current.value.projectPropsComponent" v-model:input-count="popupProps.inputCount"
            v-model:output-count="popupProps.outputCount" />
        </ProjectCreationPopup>
      </template>
    </div>
  </div>
</template>
