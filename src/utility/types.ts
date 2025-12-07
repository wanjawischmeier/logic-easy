import type { AppState } from "./states/stateManager";

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

export type TruthTableCell = 0 | 1 | '-';
export type TruthTableData = TruthTableCell[][];

export interface ListEntry {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export type ListEntries = ListEntry[];

export interface FsmState {
  id: string;
  name: string;
  initial: boolean;
  final: boolean;
}

export interface Fsmtransition {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface FsmExport {
  states: FsmState[];
  transitions: Fsmtransition[];
}


/**
 * Project information (without the full state)
 */
export interface ProjectInfo {
  id: string
  name: string
  lastModified: number
}

/**
 * Full project data including state
 */
export interface Project extends ProjectInfo {
  state: AppState
}

/**
 * Metadata stored in localStorage to track all projects
 */
export interface ProjectMetadata {
  projects: ProjectInfo[]
}
