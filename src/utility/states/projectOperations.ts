import { ProjectStorage } from './projectStorage'
import { ProjectMetadataManager } from './projectMetadata'
import { createDefaultAppState, type AppState } from './stateManager'
import type { Project } from '../types'

/**
 * Handles CRUD operations on projects (create, rename, update, delete)
 */
export class ProjectOperations {
    constructor(private metadataManager: ProjectMetadataManager) { }

    /**
     * Create a new project
     */
    create(name: string): Project {
        // Enforce project limit before creating
        this.metadataManager.enforceLimit()

        const project: Project = {
            id: `${Date.now()}`,
            name,
            lastModified: Date.now(),
            state: createDefaultAppState()
        }

        ProjectStorage.saveProject(project)
        this.metadataManager.update({
            id: project.id,
            name: project.name,
            lastModified: project.lastModified
        })

        return project
    }

    /**
     * Rename a project
     */
    rename(projectId: string, newName: string): boolean {
        const project = ProjectStorage.loadProject(projectId)
        if (!project) {
            console.error(`Project not found with id: ${projectId}`)
            return false
        }

        console.log(`Renaming project: ${project.name} => ${newName} (${project.id})`)
        project.name = newName
        project.lastModified = Date.now()

        ProjectStorage.saveProject(project)
        this.metadataManager.update({
            id: project.id,
            name: project.name,
            lastModified: project.lastModified
        })

        return true
    }

    /**
     * Update project state by ID
     */
    updateState(projectId: string, state: AppState): boolean {
        const project = ProjectStorage.loadProject(projectId)
        if (!project) {
            console.error(`Project not found with id: ${projectId}`)
            return false
        }

        project.state = state
        project.lastModified = Date.now()

        ProjectStorage.saveProject(project)
        this.metadataManager.update({
            id: project.id,
            name: project.name,
            lastModified: project.lastModified
        })

        return true
    }

    /**
     * Delete a project
     */
    delete(projectId: string): boolean {
        const project = ProjectStorage.loadProject(projectId)
        if (!project) {
            console.error(`Project not found with id: ${projectId}`)
            return false
        }

        ProjectStorage.removeProject(projectId)
        this.metadataManager.remove(projectId)

        console.log(`Deleted project: ${this.metadataManager.projectString(project)}`)
        return true
    }
}
