import type { Operation } from "logi.js";
import type { Formula, FunctionType, Literal, Term } from "../types";
import type { TruthTableData } from "@/projects/truth-table/TruthTableProject";

/**
 * Detects if a truth table represents a tautology (all 1s/don't cares) or contradiction (all 0s/don't cares)
 * @param values Truth table data
 * @param outputIndex Index of the output column to check
 * @returns 'tautology' if all values are 1 or '-', 'contradiction' if all are 0 or '-', null otherwise
 */
export function detectTautologyOrContradiction(
    values: TruthTableData,
    outputIndex: number
): 'tautology' | 'contradiction' | null {
    if (values.length === 0) return null;

    let hasOne = false;
    let hasZero = false;

    for (const row of values) {
        const cell = row[outputIndex];
        if (cell === 1) hasOne = true;
        if (cell === 0) hasZero = true;

        // If we have both 1s and 0s, it's neither
        if (hasOne && hasZero) return null;
    }

    // All are 1s or don't cares
    if (hasOne && !hasZero) return 'tautology';

    // All are 0s or don't cares
    if (hasZero && !hasOne) return 'contradiction';

    // All are don't cares (treat as contradiction for simplicity)
    return 'contradiction';
}

/**
 * Parses a single literal (VAR or NOT(VAR))
 */
function parseLiteral(expression: Operation): Literal | null {
    // Handle NOT
    if ((expression as any).priority === 15) {
        const inner = (expression as any).args?.[0];
        if (inner && (inner as any).name !== undefined) {
            return {
                variable: (inner as any).name.toLowerCase(),
                negated: true
            };
        }
    }

    // Handle VAR
    if ((expression as any).name !== undefined) {
        return {
            variable: (expression as any).name.toLowerCase(),
            negated: false
        };
    }

    return null;
}

/**
 * Convert QMC expression to Formula, choosing first option when there are multiple
 */
export function flattenCouplingTermsToFormula(
    expression: Operation,
    functionType: FunctionType
): Formula {
    const terms: Term[] = [];

    // Check for constant expressions (tautology '1' or contradiction '0')
    if ((expression as any).name === '1') {
        return {
            type: functionType,
            terms: [{ literals: [{ variable: '1', negated: false }] }]
        };
    }
    if ((expression as any).name === '0') {
        return {
            type: functionType,
            terms: [{ literals: [{ variable: '0', negated: false }] }]
        };
    }

    if (functionType === 'CNF') {
        // CNF: AND of OR clauses
        if ((expression as any).priority === 8) {
            const args = (expression as any).args as Operation[];
            for (const clauseOp of args) {
                const literals: Literal[] = [];
                if ((clauseOp as any).priority === 6) {
                    const orArgs = (clauseOp as any).args as Operation[];
                    for (const lit of orArgs) {
                        const literal = parseLiteral(lit);
                        if (literal) literals.push(literal);
                    }
                } else {
                    const literal = parseLiteral(clauseOp);
                    if (literal) literals.push(literal);
                }
                if (literals.length > 0) {
                    terms.push({ literals });
                }
            }
        } else if ((expression as any).priority === 6) {
            const literals: Literal[] = [];
            const args = (expression as any).args as Operation[];
            for (const lit of args) {
                const literal = parseLiteral(lit);
                if (literal) literals.push(literal);
            }
            if (literals.length > 0) {
                terms.push({ literals });
            }
        } else {
            const literal = parseLiteral(expression);
            if (literal) {
                terms.push({ literals: [literal] });
            }
        }
    } else {
        // DNF: OR of AND terms
        if ((expression as any).priority === 6) {
            const args = (expression as any).args as Operation[];
            for (const termOp of args) {
                const literals: Literal[] = [];
                if ((termOp as any).priority === 8) {
                    const andArgs = (termOp as any).args as Operation[];
                    for (const lit of andArgs) {
                        const literal = parseLiteral(lit);
                        if (literal) literals.push(literal);
                    }
                } else {
                    const literal = parseLiteral(termOp);
                    if (literal) literals.push(literal);
                }
                if (literals.length > 0) {
                    terms.push({ literals });
                }
            }
        } else if ((expression as any).priority === 8) {
            const literals: Literal[] = [];
            const args = (expression as any).args as Operation[];
            for (const lit of args) {
                const literal = parseLiteral(lit);
                if (literal) literals.push(literal);
            }
            if (literals.length > 0) {
                terms.push({ literals });
            }
        } else {
            const literal = parseLiteral(expression);
            if (literal) {
                terms.push({ literals: [literal] });
            }
        }
    }

    console.log('[qmcExpressionToFormula] Input:', expression, 'Output terms:', terms);
    return {
        type: functionType,
        terms: terms
    };
}

/**
 * Convert Operation to custom LaTeX string (lowercase variables, no operators)
 */
function operationToLatex(op: Operation, isCNF: boolean = false): string {
    if ((op as any).name !== undefined) {
        return (op as any).name.toLowerCase();
    }

    if ((op as any).priority === 15) {
        const inner = (op as any).args[0];
        return `\\bar{${operationToLatex(inner, isCNF)}}`;
    }

    if ((op as any).priority === 8) {
        const args = (op as any).args as Operation[];
        if (isCNF) {
            return args.map(arg => operationToLatex(arg, isCNF)).join('');
        } else {
            return args.map(arg => operationToLatex(arg, isCNF)).join('');
        }
    }

    if ((op as any).priority === 6) {
        const args = (op as any).args as Operation[];
        if (isCNF) {
            const sum = args.map(arg => operationToLatex(arg, isCNF)).join(' + ');
            return args.length > 1 ? `(${sum})` : sum;
        } else {
            return args.map(arg => operationToLatex(arg, isCNF)).join(' + ');
        }
    }

    return '';
}

/**
 * Parse an expression into individual terms
 */
function getTerms(expr: Operation, isCNF: boolean): string[] {
    const latex = operationToLatex(expr, isCNF);
    if (isCNF) {
        const matches = latex.match(/\([^)]+\)|[^()\s]+/g) || [];
        return matches.map(t => t.trim());
    } else {
        return latex.split(' + ').map(t => t.trim());
    }
}

/**
 * Analyze expressions to find common terms and variable positions
 */
export function analyzeExpressions(exprs: Operation[], isCNF: boolean): { constantTerms: string[], variablePositions: string[][] } {
    if (exprs.length === 0) return { constantTerms: [], variablePositions: [] };
    if (exprs.length === 1) return { constantTerms: getTerms(exprs[0]!, isCNF), variablePositions: [] };

    const allTerms = exprs.map(expr => getTerms(expr, isCNF));
    const maxLength = Math.max(...allTerms.map(t => t.length));

    const paddedTerms = allTerms.map(terms => {
        const padded = [...terms];
        while (padded.length < maxLength) padded.push('');
        return padded;
    });

    const constantTerms: string[] = [];
    const variablePositions: string[][] = [];

    for (let pos = 0; pos < maxLength; pos++) {
        const termsAtPos = paddedTerms.map(terms => terms[pos]!).filter(t => t !== '');
        const uniqueTerms = Array.from(new Set(termsAtPos));

        if (uniqueTerms.length === 1) {
            constantTerms.push(uniqueTerms[0]!);
        } else if (uniqueTerms.length > 1) {
            variablePositions.push(termsAtPos);
        }
    }

    return { constantTerms, variablePositions };
}