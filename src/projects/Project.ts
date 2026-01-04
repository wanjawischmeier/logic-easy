import type { Component } from "vue";
import type { ProjectType } from "./projectRegistry";
import type { AppState } from "@/projects/stateManager";

export interface BaseProjectProps {
    name: string;
    [key: string]: unknown;
}

/**
 * Abstract base class for project types
 * Projects are now purely static - no instances are created
 * State is managed through AppState in the state manager
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
     * @param props - The project props
     */
    static restoreDefaultPanelLayout(props: BaseProjectProps): void {
        throw new Error('restoreDefaultPanelLayout must be implemented by subclass')
    }

    /**
     * Initialize/create the state for this project type in the AppState
     * @param state - The AppState object to initialize
     * @param props - The project props
     */
    static createState(props: BaseProjectProps): void {
        throw new Error('createState must be implemented by subclass')
    }

    /**
     * Create a composable hook for accessing project state
     * Subclasses should override this to provide convenient computed properties
     */
    static useState() {
        throw new Error('useState must be implemented by subclass')
    }

    static validateState(state: AppState): boolean {
        throw new Error('validateState must be implemented by subclass')
    }
}

// Type for the Project class (static methods only)
export interface ProjectClass {
    readonly defaultProps: BaseProjectProps;
    restoreDefaultPanelLayout(props: BaseProjectProps): void;
    createState(props: BaseProjectProps): void;
    useState(): any;
    validateState(state: AppState): boolean;
}

export interface ProjectTypeDefinition {
    propsComponent: Component;
    projectClass: ProjectClass;
}


/**
 * Project information (without the full state)
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
