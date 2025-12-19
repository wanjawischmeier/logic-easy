import type { AppState } from '../states/stateManager'
import type { ProjectInfo, Project } from '../utility/types'
import { ProjectMetadataManager } from './projectMetadata'
import { ProjectLifecycleManager } from './projectLifecycle'
import { ProjectOperations } from './projectOperations'
import { ProjectImportExport } from './projectImportExport'

/**
 * Orchestrates all project-related operations
 */
export class ProjectManager {
  private metadata: ProjectMetadataManager
  private lifecycle: ProjectLifecycleManager
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

  openProject(projectId: number): Project | null {
    return this.lifecycle.open(projectId)
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

  createProject(name: string): Project | null {
    const project = this.operations.create(name)
    const opened = this.lifecycle.open(project.id)
    if (!opened) {
      console.error(`Failed to open created project: ${this.projectString(project)}`)
      return null
    }
    return project
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

    this.importExport.download(projectId)
  }

  async loadProjectFromFile(file: File): Promise<Project> {
    const project = await this.importExport.importFromFile(file)
    // Open the imported project to trigger state loading and watch
    this.lifecycle.open(project.id)
    return project
  }
}

export const projectManager = new ProjectManager()
