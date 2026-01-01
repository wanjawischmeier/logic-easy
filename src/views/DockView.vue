<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import type { DockviewReadyEvent, DockviewApi, SerializedDockview } from 'dockview-vue'
import DockViewHeader from '@/components/DockViewHeader.vue'
import { updateTruthTable } from '@/utility/truthtable/interpreter'
import { dockComponents } from '@/router/dockRegistry'
import { stateManager } from '@/projects/stateManager'
import { projectManager } from '@/projects/projectManager'
import GettingStartedView from './GettingStartedView.vue'
import { popupService } from '@/utility/popupService'
import ProjectCreationPopup from '@/components/popups/ProjectCreationPopup.vue'
import LoadingScreen from '@/components/LoadingScreen.vue'
import { loadingService } from '@/utility/loadingService'
import { dockviewService } from '@/utility/dockview/service'
import type { BaseProjectProps } from '@/projects/Project'

const componentsForDockview = dockComponents;
const dockviewApi = ref<DockviewApi | null>(null)
let panelDisposable: { dispose?: () => void } | null = null
let layoutChangeDisposable: { dispose?: () => void } | null = null

// Initialize pending project ID immediately
let pendingInitialProjectId: number | null = projectManager.getPendingInitialProjectId()
let isInitializingProject = pendingInitialProjectId !== null
let isRestoringLayout = false
const hasPanels = ref(pendingInitialProjectId !== null)

if (pendingInitialProjectId !== null) {
  console.log('Pending project to load on page load:', pendingInitialProjectId)
  loadingService.show('Loading page...')
} else {
  // No project to load, ensure loading screen is hidden
  loadingService.hide()
}

const restoreLayout = async (api: DockviewApi, isProjectChange = false) => {
  // Set flag to prevent premature project close during restoration
  isRestoringLayout = true

  // Await to ensure state is ready before panels mount
  const truthTableState = stateManager.state.truthTable
  if (truthTableState?.values) {
    await updateTruthTable(truthTableState.values)
  }

  // Clear existing panels only when switching projects
  if (isProjectChange) {
    const panelIds = api.panels.map(p => p.id)
    panelIds.forEach(id => {
      const panel = api.panels.find(p => p.id === id)
      if (panel) api.removePanel(panel)
    })
  }

  // Try to load saved layout from project state
  const savedLayout = stateManager.state.dockviewLayout

  if (savedLayout) {
    try {
      api.fromJSON(savedLayout as SerializedDockview)
      console.log('Loaded layout from project state')

      // Check if any panels were restored
      if (api.panels.length === 0) {
        console.log('No panels in saved layout, restoring default layout')
        const projectClass = projectManager.currentProjectClass
        const props = projectManager.currentProjectProps
        if (projectClass && props) {
          projectClass.restoreDefaultPanelLayout(props)
        }
      }
    } catch (err) {
      console.error('Failed to load layout from project state:', err)
      console.warn('Falling back to default layout')
      const projectClass = projectManager.currentProjectClass
      const props = projectManager.currentProjectProps
      if (projectClass && props) {
        projectClass.restoreDefaultPanelLayout(props)
      }
    }
  } else {
    // No saved layout, load default
    console.log('No saved layout, loading default')
    const projectClass = projectManager.currentProjectClass
    const props = projectManager.currentProjectProps
    if (projectClass && props) {
      projectClass.restoreDefaultPanelLayout(props)
    }
  }

  // Clear flag after restoration is complete
  isRestoringLayout = false
}

const onReady = (event: DockviewReadyEvent) => {
  dockviewApi.value = event.api;

  // Register dockview API and minimize function with service
  dockviewService.registerApi(event.api);
  dockviewService.registerMinimize(() => {
    hasPanels.value = false
  })

  // Check if there's a pending project to initialize
  if (pendingInitialProjectId !== null) {
    const projectIdToLoad = pendingInitialProjectId
    pendingInitialProjectId = null

    console.log('Dockview ready, loading pending project:', projectIdToLoad)
    loadingService.show('Opening project...')

    setTimeout(() => {
      try {
        projectManager.lifecycle.open(projectIdToLoad)
        // Layout restoration will be handled by the watch below
      } catch (error) {
        console.error('Failed to open project on page load:', error)
        loadingService.hide()
        isInitializingProject = false
      }
    }, 100)
  }

  // Watch for project changes and restore layout
  // This handles both initial load and subsequent project opens
  watch(
    () => projectManager.currentProjectInfo,
    (newProjectInfo, oldProjectInfo) => {
      // Trigger when project changes or opens (null -> ID)
      if (newProjectInfo?.id && newProjectInfo?.id !== oldProjectInfo?.id && event.api) {
        const isProjectChange = oldProjectInfo?.id !== null && oldProjectInfo?.id !== undefined
        console.log(isProjectChange ? `Project changed to: ${projectManager.projectString(newProjectInfo)}` : `Initial project loaded: ${projectManager.projectString(newProjectInfo)}`)

        restoreLayout(event.api, isProjectChange).then(() => {
          // Hide loading screen after layout is fully restored
          setTimeout(() => {
            loadingService.hide()
            isInitializingProject = false
          }, 100)
        }).catch(err => {
          console.error('Failed to restore layout:', err)
          loadingService.hide()
          isInitializingProject = false
        })
      }
    }
  )

  // Track panel count
  const updatePanelCount = () => {
    const panelCount = event.api.panels.length
    hasPanels.value = panelCount > 0

    // Close project when all panels are closed and we are not restoring a layout or initializing
    if (panelCount === 0 && !isRestoringLayout && !isInitializingProject) {
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

  // Setup auto-save on layout changes (resize, move, add/remove panels)
  layoutChangeDisposable = event.api.onDidLayoutChange(() => {
    // Skip saving during layout restoration to avoid overwriting with partial state
    if (isRestoringLayout || isInitializingProject) {
      return
    }

    try {
      const layout = event.api.toJSON()
      stateManager.state.dockviewLayout = layout
      console.log('Layout saved to project state')
    } catch (err) {
      console.error('Failed to save layout:', err)
    }
  })
}

const handleProjectCreate = (props: Record<string, unknown>) => {
  const popup = popupService.current.value
  if (!popup || !popupService.isProjectCreation) return

  if ('onProjectCreate' in popup) {
    popup.onProjectCreate(props as BaseProjectProps)
  }
  popupService.close()
}

const onKeydown = (e: KeyboardEvent) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey  // Windows/Linux ctrl, macOS cmd

  if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
    e.preventDefault()
    projectManager.downloadProject()
  }

  if (isCtrlOrCmd && e.key.toLowerCase() === 'o') {
    e.preventDefault()
    stateManager.openFile()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  layoutChangeDisposable?.dispose?.()
  panelDisposable?.dispose?.()
  dockviewService.unregister()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-1">
    <div class="h-[39px]">
      <DockViewHeader />
    </div>

    <div class="h-px bg-surface-2"></div>

    <div class="flex-1 min-h-0 relative">
      <dockview-vue class="dockview-theme-abyss w-full" :class="hasPanels ? 'h-[calc(100vh-40px)]' : 'h-0'"
        :components="componentsForDockview" :disableAutoFocus="true" @ready="onReady" />

      <GettingStartedView v-if="!hasPanels"></GettingStartedView>

      <!-- Loading Screen -->
      <LoadingScreen />

      <!-- Popup System -->
      <template v-if="popupService.current.value">
        <!-- Generic Popup -->
        <component v-if="!popupService.isProjectCreation && 'component' in popupService.current.value"
          :is="popupService.current.value.component" v-bind="popupService.current.value.props" />

        <!-- Project Creation Popup -->
        <ProjectCreationPopup
          v-if="popupService.isProjectCreation && 'projectPropsComponent' in popupService.current.value" :visible="true"
          :initial-props="popupService.current.value.initialProps" @close="popupService.close"
          @create="handleProjectCreate" v-slot="slotProps">
          <component :is="popupService.current.value.projectPropsComponent" :model-value="slotProps.modelValue"
            @update:model-value="slotProps['onUpdate:modelValue']"
            :register-validation="slotProps.registerValidation" />
        </ProjectCreationPopup>
      </template>
    </div>
  </div>
</template>
