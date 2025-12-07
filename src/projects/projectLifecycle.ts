import { ref, type Ref } from 'vue'
import { stateManager } from '../states/stateManager'
import { ProjectStorage } from './projectStorage'
import { ProjectMetadataManager } from './projectMetadata'
import type { Project } from '../utility/types'

/**
 * Manages current project state (opening, closing, tracking current project)
 */
export class ProjectLifecycleManager {
  private currentProjectId: Ref<string | null>
  private metadataManager: ProjectMetadataManager

  constructor(metadataManager: ProjectMetadataManager) {
    this.metadataManager = metadataManager
    this.currentProjectId = ref(ProjectStorage.loadCurrentProjectId())
  }

  /**
   * Get current project ID
   */
  get currentId(): string | null {
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
  private setCurrentId(projectId: string): void {
    this.currentProjectId.value = projectId
    ProjectStorage.saveCurrentProjectId(projectId)
  }

  /**
   * Set the current project (without opening)
   */
  setCurrent(projectId: string): boolean {
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
  open(projectId: string): Project | null {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) return null

    this.setCurrentId(projectId)

    // Clear existing state
    Object.keys(stateManager.state).forEach(
      key => delete (
        stateManager.state as Record<string, unknown>
      )[key]
    )

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
  }
}
