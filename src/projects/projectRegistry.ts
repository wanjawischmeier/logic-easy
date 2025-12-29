import { type Component } from "vue";
import { TruthTableProject, type TruthTableProps } from "./truth-table/TruthTableProject";
import TruthTablePropsComponent from "@/projects/truth-table/TruthTablePropsComponent.vue";
import type { Project } from "./Project";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

export interface ProjectTypeInfo {
  propsComponent: Component;
  defaultProps: Record<string, unknown>;
  // Kinda ugly, but a direct project class reference would lead to a circular import
  createInstance: (props: any, state?: any) => Project;
}

// Registry of all project types
export const projectTypes: Record<string, ProjectTypeInfo> = {
  'truth-table': {
    propsComponent: TruthTablePropsComponent,
    defaultProps: {
      name: '',
      inputVariableCount: 2,
      outputVariableCount: 1,
    } as TruthTableProps,
    createInstance: (props, state) => {
      return new TruthTableProject(props, state);
    }
  },
} as const;

export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType(key: ProjectType): ProjectTypeInfo {
  const type = projectTypes[key];
  if (!type) throw new Error(`Unknown project type: ${key}`);
  return type;
}
