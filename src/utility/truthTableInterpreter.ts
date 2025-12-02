import type { TruthTableData } from "@/components/TruthTable.vue";

export type TruthTableCell = 0 | 1 | '-';
export type FormulaType = 'DNF' | 'CNF';

export interface Literal {
  variable: string;
  negated: boolean;
}

export interface Term {
  literals: Literal[];
}

export interface Formula {
  type: FormulaType;
  terms: Term[];
}

/**
 * Interprets a minified truth table into a logical function (list of terms).
 * @param data Rows of the minified truth table
 * @param inputVars List of input variable names
 */
export function interpretMinifiedTable(
  data: TruthTableData,
  formulaType: FormulaType,
  inputVars: string[]
): Formula {
  const terms: Term[] = [];
  const numInputs = inputVars.length;

  // We assume the first column after inputs is the output we care about.
  const outputColIndex = numInputs;

  for (const row of data) {
    if (row.length <= outputColIndex) continue;

    const outputVal = row[outputColIndex];

    // Espresso output for a cover usually has '1' in the output column for the covered terms.
    // We process all rows that are part of the cover.
    if (outputVal !== 1) continue;

    const literals: Literal[] = [];
    for (let i = 0; i < numInputs; i++) {
      const val = row[i];
      const variable = inputVars[i];
      if (!variable) continue;

      if (formulaType === 'DNF') {
        // DNF (Sum of Products): 1 -> var, 0 -> !var
        if (val === 1) {
          literals.push({ variable, negated: false });
        } else if (val === 0) {
          literals.push({ variable, negated: true });
        }
      } else {
        // CNF (Product of Sums):
        // Input data is minified !F (OFF-set).
        // Row represents term T in !F.
        // We want clause C = !T.
        // 1 in T -> var in T -> !var in C
        // 0 in T -> !var in T -> var in C
        if (val === 1) {
          literals.push({ variable, negated: true });
        } else if (val === 0) {
          literals.push({ variable, negated: false });
        }
      }
    }
    terms.push({ literals });
  }

  // Sort terms to ensure consistent order (e.g. !a before b)
  terms.sort((a, b) => compareTerms(a, b, inputVars));
  console.log({ 'minified ': formulaType, terms });
  return { type: formulaType, terms };
}

function compareTerms(t1: Term, t2: Term, inputVars: string[]): number {
  for (const variable of inputVars) {
    const v1 = getVariableValue(t1, variable);
    const v2 = getVariableValue(t2, variable);
    if (v1 !== v2) {
      return v1 - v2;
    }
  }
  return 0;
}

function getVariableValue(term: Term, variable: string): number {
  const literal = term.literals.find(l => l.variable === variable);
  if (!literal) return 2; // Missing
  return literal.negated ? 0 : 1;
}
