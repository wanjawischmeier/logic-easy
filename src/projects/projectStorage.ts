import { Toast } from "@/utility/toastService"
import type { ProjectMetadata, StoredProject } from "./Project"

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
      Toast.error('Failed to load project metadata')
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
      Toast.error('Failed to save project metadata')
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
      Toast.error('Failed to load current project id')
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
      Toast.error('Failed to save current project id')
    }
  }

  /**
   * Load a project's full data from localStorage
   */
  static loadProject(projectId: number): StoredProject | null {
    try {
      const key = this.getProjectKey(projectId)
      const stored = localStorage.getItem(key)
      if (!stored) {
        return null
      }
      return JSON.parse(stored) as StoredProject
    } catch (error) {
      console.error(`Failed to load project ${projectId}:`, error)
      Toast.error('Failed to load project')
      return null
    }
  }

  /**
   * Save a project's full data to localStorage
   */
  static saveProject(project: StoredProject): void {
    try {
      const key = this.getProjectKey(project.id)
      localStorage.setItem(key, JSON.stringify(project))
    } catch (error) {
      console.error(`Failed to save project ${project.id}:`, error)
      Toast.error('Failed to save project')
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
      Toast.error('Failed to remove project')
    }
  }

  /**
   * Scan localStorage for all projects and return their IDs
   */
  static getAllProjectIds(): number[] {
    const projectIds: number[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(PROJECT_KEY_PREFIX)) {
          const idStr = key.substring(PROJECT_KEY_PREFIX.length)
          const id = parseInt(idStr, 10)
          if (!isNaN(id)) {
            projectIds.push(id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan projects in localStorage:', error)
      Toast.error('Failed to scan projects')
    }
    return projectIds
  }
}
