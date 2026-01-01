import { reactive, type UnwrapNestedRefs } from 'vue'
import { ProjectStorage } from '@/projects/projectStorage'
import type { ProjectMetadata, ProjectInfo, StoredProject } from './Project'

const MAX_PROJECTS = 5

/**
 * Handles project metadata management
 */
export class ProjectMetadataManager {
  private metadata: UnwrapNestedRefs<ProjectMetadata>

  constructor() {
    this.metadata = reactive(ProjectStorage.loadMetadata())

    // If metadata is empty, scan localStorage for projects and rebuild it
    if (this.metadata.projects.length === 0) {
      this.rebuildMetadataFromStorage()
    }
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
  findById(projectId: number): ProjectInfo | null {
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
  remove(projectId: number): void {
    this.metadata.projects = this.metadata.projects.filter(p => p.id !== projectId)
    ProjectStorage.saveMetadata(this.metadata)
  }

  /**
   * Enforce project limit by removing the oldest project (if necessary)
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
  projectString(project: StoredProject | ProjectInfo): string {
    return `${project.name} (id=${project.id})`
  }

  /**
   * Rebuild metadata by scanning all projects in localStorage
   */
  private rebuildMetadataFromStorage(): void {
    const projectIds = ProjectStorage.getAllProjectIds()

    if (projectIds.length === 0) {
      return
    }

    console.warn(`No metadata found: Rebuilding metadata from ${projectIds.length} projects in localStorage`)

    const projectInfos: ProjectInfo[] = []
    for (const projectId of projectIds) {
      const project = ProjectStorage.loadProject(projectId)
      if (project) {
        projectInfos.push({
          id: project.id,
          name: project.name,
          lastModified: project.lastModified,
          projectType: project.projectType
        })
      }
    }

    this.metadata.projects = projectInfos
    ProjectStorage.saveMetadata(this.metadata)
  }
}
