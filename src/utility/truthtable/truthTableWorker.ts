import { Minimizer, type QMCResult } from './minimizer';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject';
import type { FunctionType, Formula } from '@/utility/types';
import { generateTermColor, mapFormulaTermsToPIColors, type TermColor } from './colorGenerator';
import { analyzeExpressions, detectTautologyOrContradiction, flattenCouplingTermsToFormula } from './expressionParser';

// Message types for worker communication
export interface WorkerRequest {
    id: number;
    truthTable: TruthTableState;
}

export interface WorkerResponse {
    id: number;
    qmcResults: Record<string, QMCResult | undefined>;
    formulas: Record<string, Formula | undefined>;
    couplingTermLatex: string | undefined;
    selectedFormula: Formula | undefined;
    formulaTermColors: TermColor[] | undefined;
}

/**
 * Creates a QMC result for edge cases (tautology/contradiction)
 */
function createEdgeCaseResult(
    type: 'tautology' | 'contradiction',
    functionType: FunctionType,
    inputVars: string[]
): { qmcResult: QMCResult; formula: Formula; couplingTermLatex: string } {
    const isDNF = functionType === 'DNF';
    const formType = isDNF ? 'DMF' : 'CMF';
    const signature = `f_{${formType}}(${inputVars.join(', ')}) = `;

    let constant: '0' | '1';

    if (type === 'tautology') {
        // Tautology: all 1s/don't cares
        // DNF: f = 1
        // CNF: f = 1
        constant = '1';
    } else {
        // Contradiction: all 0s/don't cares
        // DNF: f = 0
        // CNF: f = 0
        constant = '0';
    }

    const formula: Formula = {
        type: functionType,
        terms: [{ literals: [{ variable: constant, negated: false }] }]
    };

    // Create a default color for the edge case (used for highlighting all cells in KV diagram)
    const defaultColor: TermColor = {
        border: 'hsla(210, 100%, 50%, 0.8)',
        fill: 'hsla(210, 100%, 50%, 0.3)'
    };

    const qmcResult: QMCResult = {
        iterations: [],
        minterms: [],
        pis: [],
        chart: null,
        expressions: [{ name: constant } as any],
        termColors: [defaultColor]
    };

    const couplingTermLatex = signature + constant;

    return { qmcResult, formula, couplingTermLatex };
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
    if ((firstExpr as any).name === '1') {
        return signature + '1';
    }
    if ((firstExpr as any).name === '0') {
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
    const currentOutputVar = truthTable.outputVars[truthTable.outputVariableIndex];
    if (!currentOutputVar) return

    console.log('[TruthTableWorker] Processing request:', id);

    try {
        // Early detection of tautology/contradiction for current output variable
        const edgeCase = detectTautologyOrContradiction(
            truthTable.values,
            truthTable.outputVariableIndex
        );

        if (edgeCase !== null) {
            console.log('[TruthTableWorker] Detected edge case:', edgeCase);

            // Create edge case results for all output variables
            const qmcResults: Record<string, QMCResult | undefined> = {};
            const formulas: Record<string, Formula | undefined> = {};

            for (const outputVar of truthTable.outputVars) {
                const outputIndex = truthTable.outputVars.indexOf(outputVar);
                const outputEdgeCase = detectTautologyOrContradiction(
                    truthTable.values,
                    outputIndex
                );

                if (outputEdgeCase !== null) {
                    const edgeResult = createEdgeCaseResult(
                        outputEdgeCase,
                        truthTable.functionType,
                        truthTable.inputVars
                    );
                    qmcResults[outputVar] = edgeResult.qmcResult;
                    formulas[outputVar] = edgeResult.formula;
                } else {
                    // This output variable is not an edge case, run QMC normally
                    const modifiedTruthTable = {
                        ...truthTable,
                        outputVariableIndex: outputIndex
                    };
                    const result = await Minimizer.runQMC(modifiedTruthTable);
                    qmcResults[outputVar] = result;

                    if (result && result.expressions && result.expressions.length > 0) {
                        formulas[outputVar] = flattenCouplingTermsToFormula(
                            result.expressions[0]!,
                            truthTable.functionType
                        );
                    } else {
                        formulas[outputVar] = {
                            type: truthTable.functionType,
                            terms: [{ literals: [{ variable: '0', negated: false }] }]
                        };
                    }
                }
            }

            // Get the selected output variable's data
            const currentEdgeResult = createEdgeCaseResult(
                edgeCase,
                truthTable.functionType,
                truthTable.inputVars
            );

            const response: WorkerResponse = {
                id,
                qmcResults,
                formulas,
                couplingTermLatex: currentEdgeResult.couplingTermLatex,
                selectedFormula: currentEdgeResult.formula,
                formulaTermColors: currentEdgeResult.qmcResult.termColors
            };

            self.postMessage(response);
            return;
        }

        // Process all output variables in parallel
        const qmcPromises = truthTable.outputVars.map(async (outputVar, index) => {
            // Create a modified truth table state for this output variable
            const modifiedTruthTable = {
                ...truthTable,
                outputVariableIndex: index
            };

            const result = await Minimizer.runQMC(modifiedTruthTable);

            // Generate colors for each prime implicant based on their term string
            // This ensures consistent coloring between QMC chart and KV diagram
            // Preserve existing colors by matching PI term strings for temporal consistency
            if (result && result.pis) {
                // Get existing QMC result for this output variable to preserve colors
                const existingQmcResult = truthTable.qmcResult;
                const existingPIs = existingQmcResult?.pis || [];
                const existingColors = existingQmcResult?.termColors || [];

                // Build a map of term string -> color from existing results
                const termColorMap = new Map<string, TermColor>();

                existingPIs.forEach((pi: any, idx: number) => {
                    const color = existingColors[idx]
                    if (pi.term && color) {
                        termColorMap.set(pi.term, color);
                    }
                });

                // Accumulate all colors as we generate new ones
                const allColors = Array.from(termColorMap.values());

                result.termColors = result.pis.map((pi: any) => {
                    // Try to reuse color for this term string if it existed before
                    const existingColor = termColorMap.get(pi.term);
                    if (existingColor) {
                        return existingColor;
                    }

                    // Generate a new color that's maximally different from all colors (including newly generated ones)
                    const newColor = generateTermColor(allColors);
                    allColors.push(newColor); // Add to accumulator for next iteration
                    return newColor;
                });
            }

            return { outputVar, result };
        });

        const qmcResultsArray = await Promise.all(qmcPromises);

        // Build records from results
        const qmcResults: Record<string, QMCResult | undefined> = {};
        const formulas: Record<string, Formula | undefined> = {};

        for (const { outputVar, result } of qmcResultsArray) {
            qmcResults[outputVar] = result;

            if (result && result.expressions && result.expressions.length > 0) {
                formulas[outputVar] = flattenCouplingTermsToFormula(
                    result.expressions[0]!,
                    truthTable.functionType
                );
            } else {
                formulas[outputVar] = {
                    type: truthTable.functionType,
                    terms: [{ literals: [{ variable: '0', negated: false }] }]
                };
            }
        }

        // Get the selected output variable's data
        const currentQmcResult = qmcResults[currentOutputVar];
        let couplingTermLatex: string | undefined;
        let selectedFormula: Formula | undefined;
        let formulaTermColors: TermColor[] | undefined;

        if (currentQmcResult) {
            couplingTermLatex = getCouplingTermLatex(
                currentQmcResult,
                truthTable.functionType,
                truthTable.inputVars
            );
            selectedFormula = formulas[currentOutputVar];

            // Map formula terms to prime implicant colors
            if (selectedFormula && currentQmcResult.pis && currentQmcResult.termColors) {
                formulaTermColors = mapFormulaTermsToPIColors(
                    selectedFormula,
                    currentQmcResult.pis,
                    currentQmcResult.termColors,
                    truthTable.inputVars
                );
            }
        }

        const response: WorkerResponse = {
            id,
            qmcResults,
            formulas,
            couplingTermLatex,
            selectedFormula,
            formulaTermColors
        };

        self.postMessage(response);
    } catch (error) {
        console.error('[TruthTableWorker] Error processing request:', error);
        // Send back empty response on error
        const response: WorkerResponse = {
            id,
            qmcResults: {},
            formulas: {},
            couplingTermLatex: undefined,
            selectedFormula: undefined,
            formulaTermColors: undefined
        };
        self.postMessage(response);
    }
};
