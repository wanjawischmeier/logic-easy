import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { Project } from '@/utility/types'
import type { BaseProjectProps } from '@/projects/Project'

/**
 * Handles CRUD operations on projects
 */
export class ProjectOperations {
  constructor(private metadataManager: ProjectMetadataManager) { }

  /**
   * Create a new project
   */
  create(name: string, projectType: string = 'truth-table', props?: Record<string, unknown>): Project {
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
