import type { TruthTableState } from "@/projects/truth-table/TruthTableProject";
import type { FunctionType, FunctionRepresentation } from "../types";
import { analyzeExpressions } from "./expressionParser";
import type { QMCResult } from "./minimizer";

export function getFunctionSignature(
    functionType: FunctionType,
    functionRepresentation: FunctionRepresentation,
    inputVars: string[]
): string {
    const formType = functionType === 'Disjunctive' ? 'D' : 'C';
    const formRepresentation = functionRepresentation === 'Normal' ? 'N' : 'M';
    return `f_{${formType}${formRepresentation}F}(${inputVars.join(', ')}) = `;
}

/**
 * Generate a binary minterm from a row index
 */
function getBinaryMinterm(rowIdx: number, inputVars: string[]): string {
    const binary = rowIdx.toString(2).padStart(inputVars.length, '0');
    const literals: string[] = [];

    for (let i = 0; i < inputVars.length; i++) {
        const bit = binary[i];
        const variable = inputVars[i]!;
        if (bit === '1') {
            literals.push(variable);
        } else {
            literals.push(`\\bar{${variable}}`);
        }
    }

    return literals.join('');
}

/**
 * Generate a binary maxterm from a row index
 */
function getBinaryMaxterm(rowIdx: number, inputVars: string[]): string {
    const binary = rowIdx.toString(2).padStart(inputVars.length, '0');
    const literals: string[] = [];

    for (let i = 0; i < inputVars.length; i++) {
        const bit = binary[i];
        const variable = inputVars[i]!;
        // Maxterm negates the bits (opposite of minterm)
        if (bit === '0') {
            literals.push(variable);
        } else {
            literals.push(`\\bar{${variable}}`);
        }
    }

    return '(' + literals.join(' + ') + ')';
}


/**
 * Extract variable letters from a LaTeX term for sorting (remove \bar{} notation)
 */
function getTermSortKey(term: string): string {
    return term.replace(/\\bar\{([a-z])\}/g, '$1');
}

/**
 * Get LaTeX for normal form (canonical form without minimization)
 */
function getNormalFormLatex(
    values: TruthTableState['values'],
    functionType: FunctionType,
    inputVars: string[],
    outputVariableIndex: number
): string {
    if (functionType === 'Disjunctive') {
        // DNF: collect all minterms (rows where output is 1)
        const minterms: string[] = [];

        for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
            const row = values[rowIdx];
            if (!row) continue;
            const outputValue = row[outputVariableIndex];
            if (outputValue === 1) {
                minterms.push(getBinaryMinterm(rowIdx, inputVars));
            }
        }

        if (minterms.length === 0) {
            return '0'; // Contradiction
        }
        if (minterms.length === Math.pow(2, inputVars.length)) {
            return '1'; // Tautology
        }

        return minterms.join(' + ');
    } else {
        // CNF: collect all maxterms (rows where output is 0)
        const maxterms: string[] = [];

        for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
            const row = values[rowIdx];
            if (!row) continue;
            const outputValue = row[outputVariableIndex];
            if (outputValue === 0) {
                maxterms.push(getBinaryMaxterm(rowIdx, inputVars));
            }
        }

        if (maxterms.length === 0) {
            return '1'; // Tautology
        }
        if (maxterms.length === Math.pow(2, inputVars.length)) {
            return '0'; // Contradiction
        }

        return maxterms.join('');
    }
}


export function getCouplingTermLatex(
    qmcResult: QMCResult,
    functionType: FunctionType,
    functionRepresentation: FunctionRepresentation,
    inputVars: string[],
    truthTableValues?: TruthTableState['values'],
    outputVariableIndex?: number
): string {
    const signature = getFunctionSignature(functionType, functionRepresentation, inputVars);

    // If normal form requested and values provided, return canonical form
    if (functionRepresentation === 'Normal' && truthTableValues && outputVariableIndex !== undefined) {
        const normalForm = getNormalFormLatex(truthTableValues, functionType, inputVars, outputVariableIndex);
        return signature + normalForm;
    }

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

    const isCNF = functionType === 'Conjunctive';
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
