import { markRaw } from "vue";
import type { TruthTableProps } from "./truth-table/TruthTableProject";
import TruthTablePropsComponent from "@/projects/truth-table/TruthTablePropsComponent.vue";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

export interface ProjectTypeInfo {
  propsComponent: any;
  defaultProps: Record<string, unknown>;
}

// Registry of all project types
export const projectTypes: Record<string, ProjectTypeInfo> = {
  'truth-table': {
    propsComponent: markRaw(TruthTablePropsComponent),
    defaultProps: {
      name: '',
      inputVariableCount: 2,
      outputVariableCount: 1,
    } as TruthTableProps,
  },
} as const;

export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType(key: ProjectType): ProjectTypeInfo {
  const type = projectTypes[key];
  if (!type) throw new Error(`Unknown project type: ${key}`);
  return type;
}
