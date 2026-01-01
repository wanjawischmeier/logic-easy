import { ProjectMetadataManager } from '@/projects/projectMetadata'
import { ProjectLifecycleManager } from '@/projects/projectLifecycle'
import { ProjectOperations } from '@/projects/projectOperations'
import { ProjectImportExport } from '@/projects/projectImportExport'
import { loadingService } from '@/utility/loadingService'
import { ProjectFileOperations } from '@/projects/projectFileOperations'
import type { BaseProjectProps, ProjectInfo, StoredProject } from '@/projects/Project'
import { dockviewService } from '@/utility/dockview/service'
import { getDockviewApi } from '@/utility/dockview/integration'
import { stateManager, type AppState } from '@/projects/stateManager'
import { projectTypes, type ProjectType } from './projectRegistry'
import { Toast } from '@/utility/toastService'

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
    this.operations = new ProjectOperations(this.metadata, this.lifecycle)
    this.importExport = new ProjectImportExport(this.metadata)
  }

  public projectString(project: StoredProject | ProjectInfo): string {
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
          const project = this.lifecycle.open(projectId)
          if (!project) {
            Toast.error('Failed to open project')
            loadingService.hide()
          }
        } catch (error) {
          console.error('Failed to open project:', error)
          Toast.error('Failed to open project');
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
      Toast.error('Failed to load project');
    }
  }

  async loadProjectFromFile(file: File): Promise<StoredProject> {
    loadingService.show('Loading project from file...')
    // Add a small delay to ensure spinner is visible
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const project = await this.importExport.importFromFile(file)
      // Open the imported project to trigger state loading and watch
      this.openProject(project.id)
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
    const currentInfo = this.currentProjectInfo;
    if (!currentInfo) {
      console.warn('No current project to save');
      return;
    }

    // Get the state directly from the state manager
    const state = stateManager.state;

    this.updateProjectState(currentInfo.id, state);
  }

  getCurrentProject(): StoredProject | null {
    return this.lifecycle.getCurrent()
  }

  get currentProjectId(): number | null {
    return this.lifecycle.currentId
  }

  get currentProjectInfo(): ProjectInfo | null {
    return this.lifecycle.currentInfo
  }

  get currentProjectClass() {
    const currentInfo = this.currentProjectInfo
    if (!currentInfo) return null

    const storedProject = this.getCurrentProject()
    if (!storedProject) return null

    const projectType = projectTypes[storedProject.projectType]
    return projectType?.projectClass || null
  }

  get currentProjectProps() {
    const storedProject = this.getCurrentProject()
    return storedProject?.props || null
  }

  // === Project CRUD ===

  createProject<TProps extends BaseProjectProps>(name: string, projectType: ProjectType, props?: TProps, onCreated?: (project: StoredProject) => void): void {
    loadingService.show('Creating project...')

    setTimeout(async () => {
      try {
        await this.operations.create(name, projectType, props, onCreated)
        // Don't hide loading screen here - let the layout restoration handle it
      } catch (error) {
        console.error('Failed to create project:', error)
        Toast.error('Failed to create project');
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

  listProjects(): ProjectInfo[] {
    return this.metadata.list()
  }

  // === Import/Export ===

  downloadProject(projectId?: number): void {
    if (!projectId) {
      const currentId = this.lifecycle.currentId
      if (!currentId) {
        console.warn(`Failed to save: No project open`)
        return
      }
      projectId = currentId
    }

    ProjectFileOperations.download(projectId)
  }
}

export const projectManager = new ProjectManager()
