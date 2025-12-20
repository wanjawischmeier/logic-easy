import type { AppState } from '@/states/stateManager'
import type { ProjectInfo, Project } from '@/utility/types'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import { ProjectLifecycleManager } from '@/projects/projectLifecycle'
import { ProjectOperations } from '@/projects/projectOperations'
import { ProjectImportExport } from '@/projects/projectImportExport'
import { loadingService } from '@/utility/loadingService'
import { ProjectFileOperations } from '@/projects/projectFileOperations'

/**
 * Orchestrates all project-related operations
 */
export class ProjectManager {
  private metadata: ProjectMetadataManager
  public lifecycle: ProjectLifecycleManager
  private operations: ProjectOperations
  private importExport: ProjectImportExport

  constructor() {
    this.metadata = new ProjectMetadataManager()
    this.lifecycle = new ProjectLifecycleManager(this.metadata)
    this.operations = new ProjectOperations(this.metadata)
    this.importExport = new ProjectImportExport(this.metadata)
  }

  public projectString(project: Project | ProjectInfo): string {
    return this.metadata.projectString(project)
  }

  // === Current Project ===

  /**
   * Get the project ID that should be initialized on page load
   * Returns null if no project is saved
   */
  getPendingInitialProjectId(): number | null {
    return this.lifecycle.getSavedProjectId()
  }

  openProject(projectId: number): void {
    loadingService.show('Opening project...')
    // Add a small delay to ensure spinner is visible
    setTimeout(() => {
      try {
        this.lifecycle.open(projectId)
        // Don't hide loading screen here - let the layout restoration handle it
      } catch (error) {
        console.error('Failed to open project:', error)
        loadingService.hide()
      }
    }, 100)
  }

  closeCurrentProject(): void {
    this.lifecycle.close()
  }

  setCurrentProject(projectId: number): boolean {
    return this.lifecycle.setCurrent(projectId)
  }

  getCurrentProject(): Project | null {
    return this.lifecycle.getCurrent()
  }

  get currentProjectInfo(): ProjectInfo | null {
    return this.lifecycle.currentInfo
  }

  // === Project CRUD ===

  createProject(name: string, onCreated?: (project: Project) => void): void {
    loadingService.show('Creating project...')

    setTimeout(() => {
      try {
        const project = this.operations.create(name)
        const opened = this.lifecycle.open(project.id)
        if (!opened) {
          console.error(`Failed to open created project: ${this.projectString(project)}`)
          loadingService.hide()
          return
        }
        // Call the callback after project is opened
        if (onCreated) {
          onCreated(project)
        }
        // Don't hide loading screen here - let the layout restoration handle it
      } catch (error) {
        console.error('Failed to create project:', error)
        loadingService.hide()
      }
    }, 100)
  }

  renameProject(projectId: number, newName: string): boolean {
    return this.operations.rename(projectId, newName)
  }

  updateProjectState(projectId: number, state: AppState): boolean {
    return this.operations.updateState(projectId, state)
  }

  deleteProject(projectId: number): boolean {
    return this.operations.delete(projectId)
  }

  listProjects(): ProjectInfo[] {
    return this.metadata.list()
  }

  // === Import/Export ===

  downloadProject(projectId?: number): void {
    if (!projectId) {
      const projectInfo = this.lifecycle.currentInfo
      if (!projectInfo) {
        console.warn(`Failed to save: No project open`)
        return
      }
      projectId = projectInfo.id
    }

    ProjectFileOperations.download(projectId)
  }

  async loadProjectFromFile(file: File): Promise<Project> {
    loadingService.show('Loading project from file...')
    // Add a small delay to ensure spinner is visible
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const project = await this.importExport.importFromFile(file)
      // Open the imported project to trigger state loading and watch
      this.lifecycle.open(project.id)
      // Don't hide loading screen here - let the layout restoration handle it
      return project
    } catch (error) {
      console.error('Failed to load project from file:', error)
      loadingService.hide()
      throw error
    }
  }
}

export const projectManager = new ProjectManager()
