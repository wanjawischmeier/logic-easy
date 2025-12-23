import { markRaw } from "vue";
import { type TruthTableProps, TruthTableProject } from "./truth-table/TruthTableProject";
import TruthTablePropsComponent from "@/projects/truth-table/TruthTablePropsComponent.vue";
import type { ProjectTypeDefinition } from "./Project";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

// Registry of all project types
export const projectTypes = {
  'truth-table': {
    propsComponent: markRaw(TruthTablePropsComponent),
    projectClass: TruthTableProject
  } satisfies ProjectTypeDefinition<TruthTableProps>,
} as const;

export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType<K extends ProjectType>(key: K): typeof projectTypes[K] {
  return projectTypes[key];
}
