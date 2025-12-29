import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { Project } from '@/utility/types'
import type { ProjectLifecycleManager } from '@/projects/projectLifecycle'
import { Project as ProjectClass } from '@/projects/Project'

/**
 * Handles CRUD operations on projects
 */
export class ProjectOperations {
  constructor(private metadataManager: ProjectMetadataManager, private lifecycle: ProjectLifecycleManager) { }

  /**
   * Create a new project
   */
  async create(name: string, projectType: string = 'truth-table', props?: Record<string, unknown>, onCreated?: (project: Project) => void): Promise<Project> {
    // Enforce project limit before creating
    this.metadataManager.enforceLimit()

    const project: Project = {
      id: Date.now(),
      name,
      lastModified: Date.now(),
      projectType,
      props: props || { name },
      state: {}
    }

    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    // Open the created project (will set current project instance)
    const opened = this.lifecycle.open(project.id)
    if (!opened) {
      throw new Error(`Failed to open created project: ${this.metadataManager.projectString(project)}`)
    }

    // Initialize project state on the project instance if available
    if (ProjectClass.currentProject) {
      await ProjectClass.currentProject.createState()
      // Save the initialized state
      const state = ProjectClass.currentProject.state || {}
      this.updateState(project.id, state)
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
      return false
    }

    console.log(`Renaming project: ${project.name} => ${newName} (${project.id})`)
    project.name = newName
    project.lastModified = Date.now()

    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    return true
  }

  /**
   * Apply new state to project
   */
  updateState(projectId: number, state: Record<string, unknown>): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found with id: ${projectId}`)
      return false
    }

    project.state = state
    project.lastModified = Date.now()

    ProjectStorage.saveProject(project)
    this.metadataManager.update({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    return true
  }

  /**
   * Delete a project
   */
  delete(projectId: number): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found with id: ${projectId}`)
      return false
    }

    ProjectStorage.removeProject(projectId)
    this.metadataManager.remove(projectId)

    console.log(`Deleted project: ${this.metadataManager.projectString(project)}`)
    return true
  }
}
