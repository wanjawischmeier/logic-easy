import { type Component } from "vue";
import type { ProjectClass } from "./Project";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

export interface ProjectTypeInfo {
  propsComponent: Component;
  // Optional runtime class reference (set via registerProjectClass)
  projectClass?: ProjectClass;
}

// Registry of all project types
export const projectTypes: Record<string, ProjectTypeInfo> = {};
export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType(key: ProjectType): ProjectTypeInfo {
  const type = projectTypes[key];
  if (!type) throw new Error(`Unknown project type: ${key}`);
  return type;
}

// Register the runtime class with the project registry to avoid direct import cycles
export function registerProject(key: ProjectType, info: ProjectTypeInfo) {
  projectTypes[key] = info;
}
