import { computed, ref, watch, type Ref, type ShallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { popupService } from '@/utility/popupService'
import { loadingService } from '@/utility/loadingService'
import { projectManager } from '@/projects/projectManager'
import AboutPopup from '@/components/popups/AboutPopup.vue'
import type { DockviewApi } from 'dockview-vue'

const getProjectIdFromRoute = (value: unknown): number | null => {
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (Array.isArray(value) && value.length > 0) {
    const parsed = Number(value[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const isAboutPopupOpen = () => {
  const current = popupService.current.value
  return !!current && 'component' in current && current.component === AboutPopup
}

export function useDockViewRouting() {
  const route = useRoute()
  const router = useRouter()

  const routeProjectId = computed(() => getProjectIdFromRoute(route?.params?.projectId))

  const pendingInitialProjectId = ref<number | null>(routeProjectId.value)
  const isRouteInitiatedProjectChange = ref(false)

  const handleProjectOpenFailure = () => {
    isRouteInitiatedProjectChange.value = false
    pendingInitialProjectId.value = null
    loadingService.hide()
    projectManager.closeCurrentProject()

    if (route.name !== 'home') {
      router?.replace({ name: 'home' })
    }
  }

  const setupRouteSync = (params: {
    dockviewApi: ShallowRef<DockviewApi | null>
    hasPanels: Ref<boolean>
    isRestoringLayout: Ref<boolean>
    isInitializingProject: Ref<boolean>
  }) => {
    const { dockviewApi, hasPanels, isRestoringLayout, isInitializingProject } = params

    watch(
      () => route?.fullPath,
      () => {
        const projectIdFromRoute = routeProjectId.value

        if (route?.name === 'about') {
          if (!isAboutPopupOpen()) {
            popupService.open({ component: AboutPopup })
          }
        } else if (isAboutPopupOpen()) {
          popupService.close()
        }

        if (projectIdFromRoute !== null) {
          if (!dockviewApi.value) {
            pendingInitialProjectId.value = projectIdFromRoute
            isInitializingProject.value = true
            hasPanels.value = true
            loadingService.show('Opening project...')
            return
          }

          if (projectManager.currentProjectInfo?.id !== projectIdFromRoute) {
            isRouteInitiatedProjectChange.value = true
            projectManager.openProject(projectIdFromRoute, handleProjectOpenFailure)
          }
          return
        }

        if (route?.name === 'home' && projectManager.currentProjectInfo?.id !== undefined) {
          if (!isRestoringLayout.value && !isInitializingProject.value) {
            isRouteInitiatedProjectChange.value = true
            projectManager.closeCurrentProject()
          }
        }
      },
      { immediate: true },
    )

    watch(
      () => projectManager.currentProjectInfo?.id,
      (newId) => {
        if (isRouteInitiatedProjectChange.value) {
          if ((newId ?? null) === routeProjectId.value) {
            isRouteInitiatedProjectChange.value = false
          }
          if (!newId && route.name === 'home' && routeProjectId.value === null) {
            isRouteInitiatedProjectChange.value = false
          }
          return
        }

        if (newId) {
          if (route.name !== 'project' || routeProjectId.value !== newId) {
            router?.replace({ name: 'project', params: { projectId: newId } })
          }
          return
        }

        if (route.name === 'project') {
          router?.replace({ name: 'home' })
        }
      },
    )

    watch(
      () => popupService.current.value,
      (current) => {
        if (route.name === 'about' && !current) {
          const currentId = projectManager.currentProjectInfo?.id
          router?.replace(
            currentId ? { name: 'project', params: { projectId: currentId } } : { name: 'home' },
          )
        }
      },
    )
  }

  return {
    routeProjectId,
    pendingInitialProjectId,
    setupRouteSync,
    handleProjectOpenFailure,
  }
}
