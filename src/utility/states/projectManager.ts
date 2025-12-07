import { createDefaultAppState, stateManager, type AppState } from './stateManager'
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

  openProject(projectId: string): Project | null {
    const project = ProjectStorage.loadProject(projectId)
    if (!project) return null

    projectManager.setCurrentProjectId(projectId)

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
   * Create a new project
   */
  createProject(name: string): Project | null {
    // Enforce project limit before creating
    projectManager.enforceProjectLimit()

    let project: Project | null = {
      id: `${Date.now()}`,
      name,
      lastModified: Date.now(),
      state: createDefaultAppState()
    }

    ProjectStorage.saveProject(project)
    projectManager.updateProjectInfo({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    project = projectManager.openProject(project.id)
    if (project) {
      return project
    } else {
      console.error(`Failed to create project: ${name}`)
      return null
    }
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
    projectManager.updateProjectInfo({
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
    return [...projectManager.metadata.projects].sort((a, b) => b.lastModified - a.lastModified)
  }

  /**
   * Get the currently open project info
   */
  get currentProjectInfo(): ProjectInfo | null {
    if (!projectManager.currentProjectId.value) {
      return null
    }
    return projectManager.metadata.projects.find(p => p.id === projectManager.currentProjectId.value) || null
  }

  /**
   * Get the currently open project (full data)
   */
  getCurrentProject(): Project | null {
    if (!projectManager.currentProjectId.value) {
      return null
    }
    return ProjectStorage.loadProject(projectManager.currentProjectId.value)
  }

  /**
   * Set the current project ID
   */
  private setCurrentProjectId(projectId: string): void {
    projectManager.currentProjectId.value = projectId
    ProjectStorage.saveCurrentProjectId(projectId)
  }

  /**
   * Set the current project
   */
  setCurrentProject(projectId: string): boolean {
    const projectInfo = projectManager.metadata.projects.find(p => p.id === projectId)
    if (!projectInfo) {
      console.error(`Project not found: ${projectId}`)
      return false
    }

    projectManager.setCurrentProjectId(projectId)
    return true
  }

  /**
   * Close the current project
   */
  closeCurrentProject(): void {
    const projectInfo = projectManager.currentProjectInfo
    if (!projectInfo) return;

    console.log(`Closing project: ${projectInfo.name}`)
    projectManager.currentProjectId.value = null
    ProjectStorage.saveCurrentProjectId(null)
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
    projectManager.updateProjectInfo({
      id: project.id,
      name: project.name,
      lastModified: project.lastModified
    })

    return true
  }

  /**
   * Download project as .le file
   */
  downloadProject(projectId?: string): void {
    if (!projectId) {
      const projectInfo = projectManager.currentProjectInfo
      if (!projectInfo) {
        console.warn(`Failed to save: No project open`)
        return
      }

      projectId = projectInfo.id
    }

    const project = ProjectStorage.loadProject(projectId)
    if (!project) {
      console.warn(`Failed to save: Project with id ${projectId} not found`)
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

    // Check if a project with this ID already exists
    const existingProject = ProjectStorage.loadProject(importedProject.id)

    if (existingProject) {
      // Update existing project
      console.log(`Updating existing project: ${importedProject.name} (${importedProject.id})`)
      existingProject.state = importedProject.state
      existingProject.name = importedProject.name
      existingProject.lastModified = Date.now()

      ProjectStorage.saveProject(existingProject)
      projectManager.updateProjectInfo({
        id: existingProject.id,
        name: existingProject.name,
        lastModified: existingProject.lastModified
      })
      projectManager.setCurrentProjectId(existingProject.id)

      return existingProject
    }

    // Enforce project limit before loading new project
    projectManager.enforceProjectLimit()

    // Save the imported project as new
    console.log(`Importing new project: ${importedProject.name} (${importedProject.id})`)
    ProjectStorage.saveProject(importedProject)
    projectManager.updateProjectInfo({
      id: importedProject.id,
      name: importedProject.name,
      lastModified: importedProject.lastModified
    })
    projectManager.setCurrentProjectId(importedProject.id)

    return importedProject
  }
}

export const projectManager = new ProjectManager()
