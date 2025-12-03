export const FunctionType = {
  DNF: 'DNF',
  CNF: 'CNF'
} as const;

export type FunctionType = (typeof FunctionType)[keyof typeof FunctionType];

export type TruthTableCell = 0 | 1 | '-';
export type TruthTableData = TruthTableCell[][];
