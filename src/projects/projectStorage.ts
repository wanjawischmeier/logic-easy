import type { ProjectMetadata, Project } from "../utility/types"

const PROJECT_METADATA_KEY = 'logic-easy-projects-metadata'
const PROJECT_KEY_PREFIX = 'logic-easy-project-'
const CURRENT_PROJECT_KEY = 'logic-easy-current-project'

/**
 * Low-level storage operations for projects
 */
export class ProjectStorage {
  /**
   * Generate a project storage key
   */
  static getProjectKey(projectId: number): string {
    return `${PROJECT_KEY_PREFIX}${projectId}`
  }

  /**
   * Load project metadata from localStorage
   */
  static loadMetadata(): ProjectMetadata {
    try {
      const stored = localStorage.getItem(PROJECT_METADATA_KEY)
      if (!stored) {
        return { projects: [] }
      }
      return JSON.parse(stored) as ProjectMetadata
    } catch (error) {
      console.error('Failed to load project metadata:', error)
      return { projects: [] }
    }
  }

  /**
   * Save project metadata to localStorage
   */
  static saveMetadata(metadata: ProjectMetadata): void {
    try {
      localStorage.setItem(PROJECT_METADATA_KEY, JSON.stringify(metadata))
    } catch (error) {
      console.error('Failed to save project metadata:', error)
    }
  }

  /**
   * Load the current project ID from localStorage
   */
  static loadCurrentProjectId(): number | null {
    try {
      const stored = localStorage.getItem(CURRENT_PROJECT_KEY)
      return stored ? parseInt(stored, 10) : null
    } catch (error) {
      console.error('Failed to load current project ID:', error)
      return null
    }
  }

  /**
   * Save the current project ID to localStorage
   */
  static saveCurrentProjectId(projectId: number | null): void {
    try {
      if (projectId !== null) {
        localStorage.setItem(CURRENT_PROJECT_KEY, projectId.toString())
      } else {
        localStorage.removeItem(CURRENT_PROJECT_KEY)
      }
    } catch (error) {
      console.error('Failed to save current project ID:', error)
    }
  }

  /**
   * Load a project's full data from localStorage
   */
  static loadProject(projectId: number): Project | null {
    try {
      const key = this.getProjectKey(projectId)
      const stored = localStorage.getItem(key)
      if (!stored) {
        return null
      }
      return JSON.parse(stored) as Project
    } catch (error) {
      console.error(`Failed to load project ${projectId}:`, error)
      return null
    }
  }

  /**
   * Save a project's full data to localStorage
   */
  static saveProject(project: Project): void {
    try {
      const key = this.getProjectKey(project.id)
      localStorage.setItem(key, JSON.stringify(project))
    } catch (error) {
      console.error(`Failed to save project ${project.id}:`, error)
    }
  }

  /**
   * Remove a project from localStorage
   */
  static removeProject(projectId: number): void {
    try {
      const key = this.getProjectKey(projectId)
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Failed to remove project ${projectId}:`, error)
    }
  }
}
