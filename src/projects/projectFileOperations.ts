import type { StoredProject } from "@/utility/types"
import { ProjectStorage } from "@/projects/projectStorage";

/**
 * File import/export operations for projects
 */
export class ProjectFileOperations {
  /**
   * Download project as .le file
   */
  static download(projectId: number): boolean;
  static download(project: StoredProject): boolean;
  static download(projectOrId: number | StoredProject): boolean {
    let project: StoredProject | null;
    if (typeof projectOrId === 'number') {
      project = ProjectStorage.loadProject(projectOrId)
    } else {
      project = projectOrId
    }

    if (!project) {
      console.warn(`Failed to save: Project with id ${projectOrId} not found`)
      return false
    }

    const dataStr = JSON.stringify(project, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name}.le`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
    return true
  }

  /**
   * Load project from .le file
   */
  static loadFromFile(file: File): Promise<StoredProject> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const project = JSON.parse(content) as StoredProject

          // Validate project structure
          if (!project.id || !project.name || !project.state) {
            throw new Error('Invalid project file format')
          }

          // Update timestamp for imported project (keep original ID)
          const importedProject: StoredProject = {
            ...project,
            lastModified: Date.now()
          }

          resolve(importedProject)
        } catch (error) {
          reject(new Error(`Failed to parse project file: ${error}`))
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read project file'))
      }

      reader.readAsText(file)
    })
  }
}
