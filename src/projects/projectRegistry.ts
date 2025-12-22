import { type Component, markRaw } from "vue";
import { type TruthTableProps, TruthTableProject } from "./truth-table/TruthTableProject";
import TruthTablePropsComponent from "@/projects/truth-table/TruthTablePropsComponent.vue";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

export interface BaseProjectProps {
  name: string;
  [key: string]: unknown;
}

export interface Project<P extends BaseProjectProps = BaseProjectProps> {
  type: string;
  props: P;
  restoreDefaultPanelLayout(props: P): void;
  create(props: P): void;
}

export interface ProjectTypeDefinition<TProps extends BaseProjectProps = BaseProjectProps> {
  type: string;
  propsComponent: Component;
  defaultPropsFactory: () => TProps;
  factory: (props: TProps) => Project<TProps>;
}

// Registry of all project types
export const projectTypes = {
  'truth-table': {
    type: 'truth-table',
    propsComponent: markRaw(TruthTablePropsComponent),
    defaultPropsFactory: TruthTableProject.defaultProps,
    factory: (props: TruthTableProps) => new TruthTableProject(props)
  } satisfies ProjectTypeDefinition<TruthTableProps>,
} as const;

export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType<K extends ProjectType>(key: K): typeof projectTypes[K] {
  return projectTypes[key];
}
