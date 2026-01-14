import { Minimizer, type QMCResult } from './minimizer';
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject';
import type { FunctionType, Formula, Literal, Term } from '@/utility/types';
import type { Operation } from 'logi.js';
import { generateTermColor, mapFormulaTermsToPIColors, type TermColor } from './colorGenerator';
import { analyzeExpressions, flattenCouplingTermsToFormula } from './expressionParser';

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

    console.log('[TruthTableWorker] Processing request:', id);

    try {
        // Process all output variables in parallel
        const currentOutputVar = truthTable.outputVars[truthTable.outputVariableIndex];
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

                result.termColors = result.pis.map((pi: any) => {
                    // Try to reuse color for this term string if it existed before
                    const existingColor = termColorMap.get(pi.term);
                    if (existingColor) {
                        return existingColor;
                    }

                    // Generate a new color with a random index if not
                    const randomIndex = Math.floor(Math.random() * 10000);
                    return generateTermColor(randomIndex);
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
        const currentQmcResult = qmcResults[currentOutputVar!];
        let couplingTermLatex: string | undefined;
        let selectedFormula: Formula | undefined;
        let formulaTermColors: TermColor[] | undefined;

        if (currentQmcResult) {
            couplingTermLatex = getCouplingTermLatex(
                currentQmcResult,
                truthTable.functionType,
                truthTable.inputVars
            );
            selectedFormula = formulas[currentOutputVar!];

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
