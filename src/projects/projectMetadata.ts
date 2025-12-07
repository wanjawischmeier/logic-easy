import { reactive, type UnwrapNestedRefs } from 'vue'
import { ProjectStorage } from './projectStorage'
import type { ProjectMetadata, ProjectInfo, Project } from '../utility/types'

const MAX_PROJECTS = 5

/**
 * Handles project metadata management
 */
export class ProjectMetadataManager {
  private metadata: UnwrapNestedRefs<ProjectMetadata>

  constructor() {
    this.metadata = reactive(ProjectStorage.loadMetadata())
  }

  /**
   * Get all projects metadata
   */
  get all(): ProjectMetadata {
    return this.metadata
  }

  /**
   * Get list of all available projects sorted by last modified
   */
  list(): ProjectInfo[] {
    return [...this.metadata.projects].sort((a, b) => b.lastModified - a.lastModified)
  }

  /**
   * Find project info by ID
   */
  findById(projectId: string): ProjectInfo | null {
    return this.metadata.projects.find(p => p.id === projectId) || null
  }

  /**
   * Update project info in metadata
   */
  update(projectInfo: ProjectInfo): void {
    const index = this.metadata.projects.findIndex(p => p.id === projectInfo.id)
    if (index >= 0) {
      this.metadata.projects[index] = projectInfo
    } else {
      this.metadata.projects.push(projectInfo)
    }
    ProjectStorage.saveMetadata(this.metadata)
  }

  /**
   * Remove project from metadata
   */
  remove(projectId: string): void {
    this.metadata.projects = this.metadata.projects.filter(p => p.id !== projectId)
    ProjectStorage.saveMetadata(this.metadata)
  }

  /**
   * Enforce the 5-project limit by removing the oldest project
   */
  enforceLimit(): void {
    if (this.metadata.projects.length >= MAX_PROJECTS) {
      // Sort by lastModified (oldest first)
      const sorted = [...this.metadata.projects].sort((a, b) => a.lastModified - b.lastModified)
      const oldestProject = sorted[0]

      if (oldestProject) {
        // Remove the oldest project
        ProjectStorage.removeProject(oldestProject.id)
        this.remove(oldestProject.id)

        console.log(`Removed oldest project: ${this.projectString(oldestProject)}`)
      }
    }
  }

  /**
   * Format project as string for logging
   */
  projectString(project: Project | ProjectInfo): string {
    return `${project.name} (id=${project.id})`
  }
}
