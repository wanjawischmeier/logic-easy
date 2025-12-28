import { markRaw } from "vue";
import type { TruthTableProps } from "./truth-table/TruthTableProject";
import TruthTablePropsComponent from "@/projects/truth-table/TruthTablePropsComponent.vue";
import type { Project as ProjectClass, BaseProjectProps, BaseProjectState } from "./Project";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationFunction = () => ValidationResult;

export interface ProjectTypeInfo<TProps extends BaseProjectProps = BaseProjectProps, TState extends BaseProjectState = BaseProjectState> {
  propsComponent: any;
  defaultProps: TProps;
  createInstance: (props: TProps, state?: TState) => Promise<ProjectClass<TProps, TState>>;
}

// Registry of all project types
export const projectTypes = {
  'truth-table': {
    propsComponent: markRaw(TruthTablePropsComponent),
    defaultProps: {
      name: '',
      inputVariableCount: 2,
      outputVariableCount: 1,
    } as TruthTableProps,
    createInstance: async (props: TruthTableProps, state?: any) => {
      const { TruthTableProject } = await import('./truth-table/TruthTableProject');
      return new TruthTableProject(props, state);
    }
  },
} as const satisfies Record<string, ProjectTypeInfo<any, any>>;

export type ProjectType = keyof typeof projectTypes;

// Helper to get project type
export function getProjectType(key: ProjectType): (typeof projectTypes)[typeof key] {
  const type = projectTypes[key];
  if (!type) throw new Error(`Unknown project type: ${key}`);
  return type;
}
