import { ref, type Ref } from 'vue'
import { createDefaultAppState, stateManager } from '@/states/stateManager'
import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { Project } from '@/utility/types'

/**
 * Manages current project state (opening, closing, tracking current project)
 */
export class ProjectLifecycleManager {
  private currentProjectId: Ref<number | null>
  private metadataManager: ProjectMetadataManager

  constructor(metadataManager: ProjectMetadataManager) {
    this.metadataManager = metadataManager
    // Start with null - the app will explicitly load the saved project
    this.currentProjectId = ref(null)
  }

  /**
   * Get the saved project ID from storage (if any)
   */
  getSavedProjectId(): number | null {
    return ProjectStorage.loadCurrentProjectId()
  }

  /**
   * Get current project ID
   */
  get currentId(): number | null {
    return this.currentProjectId.value
  }

  /**
   * Get the currently open project info
   */
  get currentInfo() {
    if (!this.currentProjectId.value) {
      return null
    }
    return this.metadataManager.findById(this.currentProjectId.value)
  }

  /**
   * Get the currently open project (full data)
   */
  getCurrent(): Project | null {
    if (!this.currentProjectId.value) {
      return null
    }
    return ProjectStorage.loadProject(this.currentProjectId.value)
  }

  /**
   * Set the current project ID
   */
  private setCurrentId(projectId: number): void {
    this.currentProjectId.value = projectId
    ProjectStorage.saveCurrentProjectId(projectId)
  }

  /**
   * Clear the current project ID (for forcing reactivity)
   */
  clearCurrentId(): void {
    this.currentProjectId.value = null
  }

  private clearState(): void {
    Object.keys(stateManager.state).forEach(
      key => delete (
        stateManager.state as Record<string, unknown>
      )[key]
    )
  }

  /**
   * Set the current project (without opening)
   */
  setCurrent(projectId: number): boolean {
    const projectInfo = this.metadataManager.findById(projectId)
    if (!projectInfo) {
      console.error(`Project not found with id: ${projectId}`)
      return false
    }

    this.setCurrentId(projectId)
    return true
  }

  /**
   * Open a project by ID (loads state into stateManager)
   */
  open(projectId: number): Project | null {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) return null

    // Clear the state first
    this.clearState()

    // Clear the ID first to force reactivity, then set it
    this.currentProjectId.value = null
    this.setCurrentId(projectId)

    // Assign new project state
    Object.assign(stateManager.state, project.state)
    if (!stateManager.state.panelStates) {
      stateManager.state.panelStates = {}
    }

    return project
  }

  /**
   * Close the current project
   */
  close(): void {
    const projectInfo = this.currentInfo
    if (!projectInfo) return

    console.log(`Closing project: ${this.metadataManager.projectString(projectInfo)}`)
    this.currentProjectId.value = null
    ProjectStorage.saveCurrentProjectId(null)

    // Clear the state to trigger reactivity updates
    this.clearState()

    // Reset to default empty state structure
    Object.assign(stateManager.state, createDefaultAppState())
  }
}
