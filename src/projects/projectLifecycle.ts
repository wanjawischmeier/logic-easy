import { ref, type Ref } from 'vue'
import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { Project } from '@/utility/types'
import { Project as ProjectClass, type BaseProjectState } from '@/projects/Project'
import { loadingService } from '@/utility/loadingService'
import { stateManager } from '@/states/stateManager'
import { projectTypes } from '@/projects/projectRegistry'

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
  async open(projectId: number): Promise<Project | null> {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) return null

    console.log('[ProjectLifecycle.open] Loaded project from storage:', {
      projectId,
      projectType: project.projectType,
      hasState: !!project.state,
      stateKeys: project.state ? Object.keys(project.state) : [],
      sampleState: project.state
    })

    // Validate that project type exists in registry
    const projectTypeInfo = projectTypes[project.projectType as keyof typeof projectTypes]
    if (!projectTypeInfo) {
      console.error(`No project type registered: ${project.projectType}`)
      loadingService.hide()
      return null
    }

    // Check if state is empty (newly created project that hasn't been initialized)
    const hasState = project.state && Object.keys(project.state).length > 0
    if (!hasState) {
      console.warn('[ProjectLifecycle.open] Project has empty state - may need initialization')
    }

    // Clear the state first
    this.clearState()

    // Clear the ID first to force reactivity, then set it
    this.currentProjectId.value = null
    this.setCurrentId(projectId)

    // Assign the project state to stateManager
    Object.assign(stateManager.state, project.state)
    console.log('[ProjectLifecycle.open] After assigning to stateManager:', {
      stateManagerKeys: Object.keys(stateManager.state),
      stateManagerState: stateManager.state
    })

    // Create the Project instance using the factory from registry
    // Pass stateManager.state so the instance uses the same reactive object
    const projectInstance = await projectTypeInfo.createInstance(project.props as any, stateManager.state as any)
    ProjectClass.currentProject = projectInstance
    console.log('[ProjectLifecycle.open] Created project instance:', {
      hasInstance: !!projectInstance,
      instanceState: projectInstance.state,
      instanceStateKeys: projectInstance.state ? Object.keys(projectInstance.state) : []
    })

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
    ProjectClass.currentProject = null

    // Clear the state to trigger reactivity updates
    this.clearState()
  }
}
