import { ProjectStorage } from '@/projects/projectStorage'
import { ProjectFileOperations } from '@/projects/projectFileOperations'
import { ProjectMetadataManager } from '@/projects/projectMetadata'
import type { StoredProject } from '@/utility/types'
import type { BaseProjectProps } from '@/projects/Project'

/**
 * Handles import/export operations for projects
 */
export class ProjectImportExport {
  constructor(private metadataManager: ProjectMetadataManager) { }
  /**
   * Load and save project from .le file (without opening it)
   */
  async importFromFile(file: File): Promise<StoredProject> {
    // Parse the file
    const importedProject = await ProjectFileOperations.loadFromFile(file)

    // Check if a project with this ID already exists
    const existingProject = ProjectStorage.loadProject(importedProject.id)

    if (existingProject) {
      // Update existing project
      console.log(`Updating existing project: ${this.metadataManager.projectString(importedProject)}`)
      existingProject.state = importedProject.state
      existingProject.name = importedProject.name
      existingProject.lastModified = Date.now()

      ProjectStorage.saveProject(existingProject)
      this.metadataManager.update({
        id: existingProject.id,
        name: existingProject.name,
        lastModified: existingProject.lastModified
      })

      return existingProject
    }

    // Enforce project limit before loading new project
    this.metadataManager.enforceLimit()

    // Save the imported project as new
    console.log(`Importing new project: ${this.metadataManager.projectString(importedProject)}`)
    ProjectStorage.saveProject(importedProject)
    this.metadataManager.update({
      id: importedProject.id,
      name: importedProject.name,
      lastModified: importedProject.lastModified
    })

    return importedProject
  }
}
