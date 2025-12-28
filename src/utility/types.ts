export const FunctionType = {
  DNF: 'DNF',
  CNF: 'CNF',
} as const;

export const defaultFunctionType: FunctionType = 'DNF';

export type FunctionType = (typeof FunctionType)[keyof typeof FunctionType];

export interface Literal {
  variable: string;
  negated: boolean;
}

export interface Term {
  literals: Literal[];
}

export interface Formula {
  type: FunctionType;
  terms: Term[];
}

export const Formula = {
  empty: ({
    type: 'DNF' as FunctionType,
    terms: []
  })
};

export interface ListEntry {
  label: string;
  action: () => void;
  disabled?: boolean;
  subtitle?: string;
}

export type ListEntries = ListEntry[];


/**
 * Project information (without the full state)
 */
export interface ProjectInfo {
  id: number
  name: string
  lastModified: number
}

/**
 * Full project data as stored in localStorage
 */
export interface Project extends ProjectInfo {
  projectType: string
  props: Record<string, unknown>
  state: Record<string, unknown>
}

/**
 * Metadata stored in localStorage to track all projects
 */
export interface ProjectMetadata {
  projects: ProjectInfo[]
}
