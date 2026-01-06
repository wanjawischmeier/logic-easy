import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { ProjectLifecycleManager } from '@/projects/projectLifecycle'
import type { BaseProjectProps, StoredProject } from '@/projects/Project'
import { projectTypes } from '@/projects/projectRegistry'
import { StateManager, stateManager, type AppState } from '@/projects/stateManager'
import { Toast } from '@/utility/toastService'

/**
 * Handles CRUD operations on projects
 */
export class ProjectOperations {
  constructor(private metadataManager: ProjectMetadataManager, private lifecycle: ProjectLifecycleManager) { }

  /**
   * Create a new project
   */
  async create<TProps extends BaseProjectProps>(name: string, projectType: string, props?: TProps, onCreated?: (project: StoredProject) => void): Promise<StoredProject> {
    // Enforce project limit before creating
    this.metadataManager.enforceLimit()

    const project: StoredProject = {
      id: Date.now(),
      name,
      lastModified: Date.now(),
      projectType,
      props: props || { name },
      state: StateManager.defaultState
    }

    // Initialize project state using the static createState method BEFORE saving
    const projectTypeInfo = projectTypes[projectType]
    if (projectTypeInfo?.projectClass) {
      projectTypeInfo.projectClass.createState(project.props)
      project.state = {
        ...project.state,
        ...stateManager.state
      }
    }

    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified,
      projectType: project.projectType,
    })

    // Open the created project
    const opened = this.lifecycle.open(project.id)
    if (!opened) {
      throw new Error(`Failed to open created project: ${this.metadataManager.projectString(project)}`)
    }

    // Call callback after everything is set up
    if (onCreated) {
      onCreated(project)
    }

    return project
  }

  /**
   * Rename a project
   */
  rename(projectId: number, newName: string): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found with id: ${projectId}`)
      Toast.error('Failed to rename project')
      return false
    }

    console.log(`Renaming project: ${project.name} => ${newName} (${project.id})`)
    project.name = newName
    project.lastModified = Date.now()

    stateManager.isSaving.value = true
    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified,
      projectType: project.projectType
    })

    // Brief delay to show the spinner
    setTimeout(() => {
      stateManager.isSaving.value = false
    }, 300)

    return true
  }

  /**
   * Apply new state to project
   */
  updateState(projectId: number, state: AppState): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found with id: ${projectId}`)
      Toast.error('Failed to update project')
      return false
    }

    project.state = state
    project.lastModified = Date.now()

    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified,
      projectType: project.projectType
    })

    console.log('Saved project')
    return true
  }
}
