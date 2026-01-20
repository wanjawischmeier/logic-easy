import type { Component } from "vue";
import type { ProjectType } from "./projectRegistry";
import type { AppState } from "@/projects/stateManager";

/**
 * Props define what is needed to initialize a project state
 */
export interface BaseProjectProps {
    name: string;
    [key: string]: unknown;
}

/**
 * Abstract base class for project types
 */
export abstract class Project {
    /**
     * Get default props for this project type
     */
    static get defaultProps(): BaseProjectProps {
        throw new Error('defaultProps must be implemented by subclass')
    }

    /**
     * Restore the default panel layout for this project type
     * @param props The project props
     */
    static restoreDefaultPanelLayout(props: BaseProjectProps): void {
        throw new Error('restoreDefaultPanelLayout must be implemented by subclass')
    }

    /**
     * Initialize/create the state for this project type in the AppState
     * @param state The AppState object to initialize
     * @param props The project props
     */
    static createState(props: BaseProjectProps): void {
        throw new Error('createState must be implemented by subclass')
    }

    /**
     * Create a composable hook for accessing project state
     */
    static useState() {
        // Subclasses override this to provide convenient computed properties
        throw new Error('useState must be implemented by subclass')
    }

    /**
     * @param state The AppState that is to be validated
     * @returns True if the AppState is valid for this project class
     */
    static validateState(state: AppState): boolean {
        throw new Error('validateState must be implemented by subclass')
    }
}

/**
 * Type for the Project class (static methods only)
 */
export interface ProjectClass {
    readonly defaultProps: BaseProjectProps;
    restoreDefaultPanelLayout(props: BaseProjectProps): void;
    createState(props: BaseProjectProps): void;
    useState(): any;
    validateState(state: AppState): boolean;
}

/**
 * Properties needed to register a project type
 */
export interface ProjectTypeDefinition {
    propsComponent: Component;
    projectClass: ProjectClass;
}

/**
 * Basic project information
 */
export interface ProjectInfo {
    id: number
    name: string
    lastModified: number
    projectType: ProjectType
}

/**
 * Full project data as stored in localStorage
 */
export interface StoredProject extends ProjectInfo {
    projectType: ProjectType
    props: BaseProjectProps
    state: AppState
}

/**
 * Metadata stored in localStorage to track all projects
 */
export interface ProjectMetadata {
    projects: ProjectInfo[]
}
