import type { Project } from "../types"

/**
 * File import/export operations for projects
 */
export class ProjectFileOperations {
  /**
   * Download project as .le file
   */
  static downloadProject(project: Project): void {
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
  }

  /**
   * Load project from .le file
   */
  static loadProjectFromFile(file: File): Promise<Project> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const project = JSON.parse(content) as Project

          // Validate project structure
          if (!project.id || !project.name || !project.state) {
            throw new Error('Invalid project file format')
          }

          // Generate new ID and update timestamp for imported project
          const importedProject: Project = {
            ...project,
            id: `project-${Date.now()}`,
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
