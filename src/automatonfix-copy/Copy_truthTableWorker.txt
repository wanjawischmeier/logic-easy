import { Minimizer, type QMCResult } from './minimizer';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject';
import type { Formula } from '@/utility/types';
import { mapFormulaTermsToPIColors, type TermColor } from './colorGenerator';
import { detectTautologyOrContradiction, flattenCouplingTermsToFormula } from './expressionParser';
import { getCouplingTermLatex } from './latexGenerator';
import { createEdgeCaseResult, mapResultColorsByPiTerm } from './qmcResultUtils';

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

async function runMinimization(truthTable: TruthTableState, index: number): Promise<QMCResult | undefined> {
    // Create a modified truth table state for this output variable
    const modifiedTruthTable = {
        ...truthTable,
        outputVariableIndex: index
    };

    return await Minimizer.runQMC(modifiedTruthTable);
}

// Web Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, truthTable } = e.data;
    if (!truthTable) return

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
                        truthTable.functionRepresentation,
                        truthTable.inputVars
                    );
                    qmcResults[outputVar] = edgeResult.qmcResult;
                    formulas[outputVar] = edgeResult.formula;
                } else {
                    // This output variable is not an edge case, run QMC normally
                    const result = await runMinimization(truthTable, outputIndex);
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
                truthTable.functionRepresentation,
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
            const result = await runMinimization(truthTable, index)
            if (!result || !result.pis) {
                return { outputVar, result }
            }

            result.termColors = mapResultColorsByPiTerm(truthTable.qmcResult, result)
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
                truthTable.functionRepresentation,
                truthTable.inputVars,
                truthTable.values,
                truthTable.outputVariableIndex
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
