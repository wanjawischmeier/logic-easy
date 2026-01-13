import { Minimizer, type QMCResult } from './minimizer';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject';
import type { FunctionType, Formula, Literal, Term } from '@/utility/types';
import type { Operation } from 'logi.js';

// Message types for worker communication
export interface WorkerRequest {
    id: number;
    truthTable: TruthTableState;
}

export interface WorkerResponse {
    id: number;
    qmcResult: QMCResult | undefined;
    couplingTermLatex: string | undefined;
    selectedFormula: Formula | undefined;
}

/**
 * Helper to parse a single literal (VAR or NOT(VAR))
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
function flattenCouplingTermsToFormula(
    expression: Operation,
    functionType: FunctionType
): Formula {
    const terms: Term[] = [];

    // Check for constant expressions (tautology '1' or contradiction '0')
    if ((expression as any).value === 1 || ((expression as any).name === '1')) {
        return {
            type: functionType,
            terms: [{ literals: [{ variable: '1', negated: false }] }]
        };
    }
    if ((expression as any).value === 0 || ((expression as any).name === '0')) {
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
function analyzeExpressions(exprs: Operation[], isCNF: boolean): { constantTerms: string[], variablePositions: string[][] } {
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

/**
 * Extract variable letters from a LaTeX term for sorting (remove \bar{} notation)
 */
function getTermSortKey(term: string): string {
    return term.replace(/\\bar\{([a-z])\}/g, '$1');
}

function getCouplingTermLatex(
    qmcResult: QMCResult,
    functionType: FunctionType,
    inputVars: string[]
): string {
    const formType = functionType === 'DNF' ? 'DMF' : 'CMF';
    const signature = `f_{${formType}}(${inputVars.join(', ')}) = `;

    if (qmcResult.expressions.length === 0) {
        return signature + '0';
    }

    const firstExpr = qmcResult.expressions[0];
    if ((firstExpr as any).value === 1 || (firstExpr as any).name === '1') {
        return signature + '1';
    }
    if ((firstExpr as any).value === 0 || (firstExpr as any).name === '0') {
        return signature + '0';
    }

    const isCNF = functionType === 'CNF';
    const { constantTerms, variablePositions } = analyzeExpressions(qmcResult.expressions, isCNF);

    if (variablePositions.length === 0) {
        const termJoiner = isCNF ? '' : ' + ';
        return signature + constantTerms.sort((a, b) =>
            getTermSortKey(a).localeCompare(getTermSortKey(b))
        ).join(termJoiner);
    }

    const partsWithKeys: Array<{ sortKey: string, latex: string }> = [];

    for (const term of constantTerms) {
        partsWithKeys.push({ sortKey: getTermSortKey(term), latex: term });
    }

    for (const variations of variablePositions) {
        const uniqueVars = Array.from(new Set(variations));
        const matrixRows = uniqueVars.join(' \\\\ ');
        const latex = `\\left\\{ \\begin{matrix} ${matrixRows} \\end{matrix} \\right\\}`;
        partsWithKeys.push({ sortKey: getTermSortKey(uniqueVars[0] || ''), latex });
    }

    partsWithKeys.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const termJoiner = isCNF ? '' : ' + ';
    return signature + partsWithKeys.map(p => p.latex).join(termJoiner);
}

// Web Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, truthTable } = e.data;

    console.log('[TruthTableWorker] Processing request:', id);

    try {
        const qmcResult = await Minimizer.runQMC(truthTable);

        let couplingTermLatex: string | undefined;
        let selectedFormula: Formula | undefined;

        if (qmcResult) {
            couplingTermLatex = getCouplingTermLatex(
                qmcResult,
                truthTable.functionType,
                truthTable.inputVars
            );

            if (qmcResult.expressions && qmcResult.expressions.length > 0) {
                selectedFormula = flattenCouplingTermsToFormula(
                    qmcResult.expressions[0]!,
                    truthTable.functionType
                );
            } else {
                selectedFormula = {
                    type: truthTable.functionType,
                    terms: [{ literals: [{ variable: '0', negated: false }] }]
                };
            }
        }

        const response: WorkerResponse = {
            id,
            qmcResult,
            couplingTermLatex,
            selectedFormula
        };

        self.postMessage(response);
    } catch (error) {
        console.error('[TruthTableWorker] Error processing request:', error);
        // Send back empty response on error
        const response: WorkerResponse = {
            id,
            qmcResult: undefined,
            couplingTermLatex: undefined,
            selectedFormula: undefined
        };
        self.postMessage(response);
    }
};
