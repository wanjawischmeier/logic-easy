export const FunctionType = {
  DNF: 'Disjunctive',
  CNF: 'Conjunctive',
} as const;

export const defaultFunctionType: FunctionType = 'Disjunctive';

export type FunctionType = (typeof FunctionType)[keyof typeof FunctionType];

export const FunctionRepresentation = {
  normal: 'Normal',
  minimal: 'Minimal',
} as const;

export const defaultFunctionRepresentation: FunctionRepresentation = 'Minimal';

export type FunctionRepresentation = (typeof FunctionRepresentation)[keyof typeof FunctionRepresentation];

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
    type: 'Disjunctive' as FunctionType,
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
