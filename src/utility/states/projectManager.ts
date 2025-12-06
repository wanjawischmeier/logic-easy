import type { AppState } from './stateManager'
import { ProjectStorage } from './projectStorage'
import { ProjectFileOperations } from './projectFileOperations'
import type { ProjectMetadata, ProjectInfo, Project } from '../types'
import { reactive, ref, type UnwrapNestedRefs, type Ref } from 'vue'

const MAX_PROJECTS = 5

/**
 * Project manager for handling multiple projects
 */
export class ProjectManager {
  private metadata: UnwrapNestedRefs<ProjectMetadata>
  private currentProjectId: Ref<string | null>

  constructor() {
    this.metadata = reactive(ProjectStorage.loadMetadata())
    this.currentProjectId = ref(ProjectStorage.loadCurrentProjectId())
  }

  /**
   * Enforce the 5-project limit by removing the oldest project
   */
  private enforceProjectLimit(): void {
    if (this.metadata.projects.length >= MAX_PROJECTS) {
      // Sort by lastModified (oldest first)
      const sorted = [...this.metadata.projects].sort((a, b) => a.lastModified - b.lastModified)
      const oldestProject = sorted[0]

      if (oldestProject) {
        // Remove the oldest project
        ProjectStorage.removeProject(oldestProject.id)
        this.metadata.projects = this.metadata.projects.filter(p => p.id !== oldestProject.id)

        console.log(`Removed oldest project: ${oldestProject.name} (${oldestProject.id})`)
      }
    }
  }

  /**
   * Update project info in metadata
   */
  private updateProjectInfo(projectInfo: ProjectInfo): void {
    const index = this.metadata.projects.findIndex(p => p.id === projectInfo.id)
    if (index >= 0) {
      this.metadata.projects[index] = projectInfo
    } else {
      this.metadata.projects.push(projectInfo)
    }
    ProjectStorage.saveMetadata(this.metadata)
  }

  /**
   * Create a new project
   */
  createProject(name: string, initialState?: AppState): Project {
    // Enforce project limit before creating
    this.enforceProjectLimit()

    const project: Project = {
      id: `project-${Date.now()}`,
      name,
      lastModified: Date.now(),
      state: initialState || { version: 1 }
    }

    ProjectStorage.saveProject(project)
    this.updateProjectInfo({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })
    this.setCurrentProjectId(project.id)

    return project
  }

  /**
   * Rename a project
   */
  renameProject(projectId: string, newName: string): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found: ${projectId}`)
      return false
    }

    console.log(`Renaming project: ${project.name} => ${newName}`)
    project.name = newName
    project.lastModified = Date.now()

    ProjectStorage.saveProject(project)
    this.updateProjectInfo({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    return true
  }

  /**
   * Get list of all available projects
   */
  listProjects(): ProjectInfo[] {
    // Return sorted by last modified (most recent first)
    return [...this.metadata.projects].sort((a, b) => b.lastModified - a.lastModified)
  }

  /**
   * Get the currently open project info
   */
  getCurrentProjectInfo(): ProjectInfo | null {
    if (!this.currentProjectId.value) {
      return null
    }
    return this.metadata.projects.find(p => p.id === this.currentProjectId.value) || null
  }

  /**
   * Get the currently open project (full data)
   */
  getCurrentProject(): Project | null {
    if (!this.currentProjectId.value) {
      return null
    }
    return ProjectStorage.loadProject(this.currentProjectId.value)
  }

  /**
   * Set the current project ID
   */
  private setCurrentProjectId(projectId: string): void {
    this.currentProjectId.value = projectId
    ProjectStorage.saveCurrentProjectId(projectId)
  }

  /**
   * Set the current project
   */
  setCurrentProject(projectId: string): boolean {
    const projectInfo = this.metadata.projects.find(p => p.id === projectId)
    if (!projectInfo) {
      console.error(`Project not found: ${projectId}`)
      return false
    }

    this.setCurrentProjectId(projectId)
    return true
  }

  /**
   * Close the current project
   */
  closeCurrentProject(): void {
    const projectInfo = this.getCurrentProjectInfo()
    if (!projectInfo) return;

    console.log(`Closing project: ${projectInfo.name}`)
    this.currentProjectId.value = null
    ProjectStorage.saveCurrentProjectId(null)
  }

  /**
   * Get project state by ID
   */
  getProjectState(projectId: string): AppState | null {
    const project = ProjectStorage.loadProject(projectId)
    return project ? project.state : null
  }

  /**
   * Update project state by ID
   */
  updateProjectState(projectId: string, state: AppState): boolean {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found: ${projectId}`)
      return false
    }

    project.state = state
    project.lastModified = Date.now()

    ProjectStorage.saveProject(project)
    this.updateProjectInfo({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    return true
  }

  /**
   * Download project as .le file
   */
  downloadProject(projectId: string): void {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.error(`Project not found: ${projectId}`)
      return
    }

    ProjectFileOperations.downloadProject(project)
  }

  /**
   * Load project from .le file
   */
  async loadProjectFromFile(file: File): Promise<Project> {
    // Parse the file
    const importedProject = await ProjectFileOperations.loadProjectFromFile(file)

    // Enforce project limit before loading
    this.enforceProjectLimit()

    // Save the imported project
    ProjectStorage.saveProject(importedProject)
    this.updateProjectInfo({
      id: importedProject.id,
      name: importedProject.name,
      lastModified: importedProject.lastModified
    })
    this.setCurrentProjectId(importedProject.id)

    return importedProject
  }

  /**
   * Delete a project
   */
  deleteProject(projectId: string): boolean {
    const projectInfo = this.metadata.projects.find(p => p.id === projectId)
    if (!projectInfo) {
      console.error(`Project not found: ${projectId}`)
      return false
    }

    ProjectStorage.removeProject(projectId)
    this.metadata.projects = this.metadata.projects.filter(p => p.id !== projectId)
    ProjectStorage.saveMetadata(this.metadata)

    // If this was the current project, clear it
    if (this.currentProjectId.value === projectId) {
      this.currentProjectId.value = null
      ProjectStorage.saveCurrentProjectId(null)
    }

    return true
  }
}

/**
 * Singleton instance
 */
export const projectManager = new ProjectManager()
