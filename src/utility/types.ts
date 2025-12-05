export const FunctionType = {
  DNF: 'DNF',
  CNF: 'CNF',
  default: 'DNF'
} as const;

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
