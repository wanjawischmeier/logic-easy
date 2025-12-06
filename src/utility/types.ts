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

