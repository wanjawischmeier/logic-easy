import type { ProjectInfo, Project } from '@/utility/types'
import type { BaseProjectProps } from '@/projects/Project'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import { ProjectLifecycleManager } from '@/projects/projectLifecycle'
import { ProjectOperations } from '@/projects/projectOperations'
import { ProjectImportExport } from '@/projects/projectImportExport'
import { loadingService } from '@/utility/loadingService'
import { ProjectFileOperations } from '@/projects/projectFileOperations'
import { Project as ProjectClass } from '@/projects/Project'
import { dockviewService } from '@/utility/dockview/service'
import { getDockviewApi } from '@/utility/dockview/integration'

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

  /**
   * Open a project by ID
   */
  openProject(projectId: number): void;
  /**
   * Open a project using a file picker dialog
   */
  openProject(): Promise<void>;
  openProject(projectId?: number): void | Promise<void> {
    if (projectId !== undefined) {
      // Open by ID
      loadingService.show('Opening project...')
      setTimeout(() => {
        try {
          this.lifecycle.open(projectId)
        } catch (error) {
          console.error('Failed to open project:', error)
          loadingService.hide()
        }
      }, 100)
    } else {
      // Open via file picker
      return this.openProjectFromFile();
    }
  }

  private async openProjectFromFile(): Promise<void> {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.le,.lc'
      input.multiple = false
      input.style.display = 'none'
      document.body.appendChild(input)

      const file: File | null = await new Promise((resolve) => {
        input.addEventListener('change', () => {
          resolve(input.files && input.files[0] ? input.files[0] : null)
        }, { once: true })
        input.click()
      })

      document.body.removeChild(input)

      if (!file) return

      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'le') {
        await this.loadProjectFromFile(file)
      } else {
        alert('Opening of LogicCircuits projects not supported yet')
      }
    } catch (error) {
      console.error(`Failed to load project from file: ${error}`)
    }
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

  closeCurrentProject(): void {
    // Immediately minimize the dock view to avoid flash
    dockviewService.minimize()

    // A bit odd, but this ensures a smooth animation and avoids a flickering of the empty dock view
    setTimeout(() => {
      const api = getDockviewApi()
      if (!api) {
        console.warn('Dockview API not available, closing project directly')
        this.lifecycle.close()
        return
      }

      // Close all panels - will automatically trigger lifecycle.close()
      const panelIds = api.panels.map(p => p.id)
      panelIds.forEach(id => {
        const panel = api.panels.find(p => p.id === id)
        if (panel) {
          api.removePanel(panel)
        }
      })

      // If no panels to close, close project directly
      if (panelIds.length === 0) {
        this.lifecycle.close()
      }
    }, 100)
  }

  saveCurrentProject(): void {
    const currentProject = ProjectClass.currentProject;
    const currentInfo = this.currentProjectInfo;
    if (!currentProject || !currentInfo) {
      console.warn('No current project to save');
      return;
    }

    // Get the state directly from the current project instance
    const state = currentProject.state || {};

    this.updateProjectState(currentInfo.id, state);
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

  createProject(name: string, projectType: string = 'truth-table', props?: Record<string, unknown>, onCreated?: (project: Project) => void): void {
    loadingService.show('Creating project...')

    setTimeout(async () => {
      try {
        const project = this.operations.create(name, projectType, props)
        const opened = this.lifecycle.open(project.id)
        if (!opened) {
          console.error(`Failed to open created project: ${this.projectString(project)}`)
          loadingService.hide()
          return
        }

        // Call create() on the project instance to initialize state
        const projectInstance = ProjectClass.currentProject
        if (projectInstance && typeof projectInstance.create === 'function') {
          await projectInstance.create()
          console.log('[ProjectManager.createProject] Called create() on project instance')
        }

        // Call the callback after project is created and initialized
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

  updateProjectState(projectId: number, state: Record<string, unknown>): boolean {
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
}

export const projectManager = new ProjectManager()
