import { type Term, FunctionType } from "@/utility/types";

/**
 * Generate a semi-transparent HSLA color string for a term index.
 *
 * @param indexIndex of the term to generate a color for.
 * @returns HSLA color string (e.g. "hsla(120, 70%, 50%, 0.4)").
 */
function getTermColor(index: number): string {
  const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
  return `hsla(${hue}, 70%, 50%, 0.4)`;
}

/**
 * Determine whether a given term "covers" the cell represented by rowCode+colCode.
 *
 * Behavior differs by mode:
 * - DNF: is covered if all literals evaluate true.
 * - CNF: is covered if at least one literal evaluates true.
 *
 * @param termThe term to evaluate.
 * @param rowCodeBinary string for the row variables.
 * @param colCodeBinary string for the column variables.
 * @param inputVarsOrdered list of input variable names corresponding to bits in rowCode+colCode.
 * @returns true if the term covers the cell under the given mode, false otherwise.
 */
function isCovered(
  term: Term,
  rowCode: string,
  colCode: string,
  functionType: FunctionType,
  inputVars: string[]
): boolean {
  const binaryString = rowCode + colCode;

  if (functionType === FunctionType.DNF) {
    // DNF: Term is a product (AND of literals).
    // Covers cells where all literals are true.

    if (term.literals.length === 1 && term.literals[0]?.variable === '0') {
      return false;
    }
    for (const literal of term.literals) {
      const varIndex = inputVars.indexOf(literal.variable);
      if (varIndex === -1) continue;

      const bit = binaryString[varIndex];
      // literal A (negated=false) requires bit '1'
      // literal !A (negated=true) requires bit '0'
      if (!literal.negated && bit !== '1') return false;
      if (literal.negated && bit !== '0') return false;
    }
    return true;
  } else {
    // CNF: Term is a sum (OR of literals)a clause.
    // Covers cells where at least one literal is true.
    for (const literal of term.literals) {
      const varIndex = inputVars.indexOf(literal.variable);
      if (varIndex === -1) continue;

      const bit = binaryString[varIndex];
      // Literal A (negated=false) is true when bit='1'
      // Literal !A (negated=true) is true when bit='0'
      if (!literal.negated && bit === '1') return true;
      if (literal.negated && bit === '0') return true;
    }
    return false; // No literal was true
  }
}

/**
 * Infer visual highlight regions for a single cell by checking adjacency coverage for each term.
 *
 * Produces an array of Highlight objects describing background color and which cell edges
 * should be flush (no padding) to indicate grouping across neighboring cells.
 *
 * @param terms Array of terms (DNF or CNF) to consider.
 * @param rows All row binary codes.
 * @param cols All column binary codes.
 * @param rowIndexRow index of the current cell.
 * @param colIndexColumn index of the current cell.
 * @param rowCodeBinary code for the current row.
 * @param colCodeBinary code for the current column.
 * @param inputVarsOrdered list of input variable names.
 * @returns Array of Highlight descriptors for the cell.
 */
function inferHighlightFromCoverage(
  terms: Term[],
  rows: string[],
  cols: string[],
  rowIndex: number,
  colIndex: number,
  rowCode: string,
  colCode: string,
  functionType: FunctionType,
  inputVars: string[]
): Highlight[] {
  const highlights: Highlight[] = [];
  const pad = '8px';

  terms.forEach((term, index) => {
    const covered = isCovered(term, rowCode, colCode, functionType, inputVars);
    const isCNF = functionType === FunctionType.CNF;
    if (covered === isCNF) return

    const color = getTermColor(index);

    const topRow = rows[(rowIndex - 1 + rows.length) % rows.length]!;
    const bottomRow = rows[(rowIndex + 1) % rows.length]!;
    const leftCol = cols[(colIndex - 1 + cols.length) % cols.length]!;
    const rightCol = cols[(colIndex + 1) % cols.length]!;

    const hasTop = isCovered(term, topRow, colCode, functionType, inputVars) !== isCNF;
    const hasBottom = isCovered(term, bottomRow, colCode, functionType, inputVars) !== isCNF;
    const hasLeft = isCovered(term, rowCode, leftCol, functionType, inputVars) !== isCNF;
    const hasRight = isCovered(term, rowCode, rightCol, functionType, inputVars) !== isCNF;

    highlights.push({
      style: {
        backgroundColor: color,
        top: hasTop ? '0' : pad,
        bottom: hasBottom ? '0' : pad,
        left: hasLeft ? '0' : pad,
        right: hasRight ? '0' : pad,
      }
    });
  });

  return highlights;
}

/**
 * Describing a visual highlight for a K-V diagram cell.
 *
 * `style`: map of CSS props used to render the highlight region.
 */
export interface Highlight {
  style: Record<string, string>;
}

/**
 * Calculate highlights for a specific cell in the K-V diagram given the current terms.
 *
 * @param rowIndexRow index of the cell to evaluate.
 * @param colIndexColumn index of the cell to evaluate.
 * @param rowCodesAll row binary codes.
 * @param colCodesAll column binary codes.
 * @param inputVarsOrdered list of input variable names.
 * @returns Array of Highlight objects to render for the given cell.
 */
export function calculateHighlights(
  rowIndex: number,
  colIndex: number,
  rowCodes: string[],
  colCodes: string[],
  terms: Term[],
  functionType: FunctionType,
  inputVars: string[]
): Highlight[] {
  const rowCode = rowCodes[rowIndex];
  const colCode = colCodes[colIndex];

  if (!rowCode || !colCode) return [];

  // Check for constant formulas
  const isConstant1 = terms.length === 1 && terms[0]?.literals.length === 1 && terms[0]?.literals[0]?.variable === '1';
  const isConstant0 = terms.length === 1 && terms[0]?.literals.length === 1 && terms[0]?.literals[0]?.variable === '0';

  if (functionType === FunctionType.DNF) {
    // DNF constant 1 (tautology): highlight all cells
    if (isConstant1) {
      return [{
        style: {
          backgroundColor: getTermColor(0),
          top: '0',
          bottom: '0',
          left: '0',
          right: '0',
        }
      }];
    }
    // DNF constant 0 (contradiction): highlight no cells
    if (isConstant0) {
      return [];
    }
  } else {
    // CNF mode
    // CNF constant 0 (contradiction): highlight all cells
    if (isConstant0) {
      return [{
        style: {
          backgroundColor: getTermColor(0),
          top: '0',
          bottom: '0',
          left: '0',
          right: '0',
        }
      }];
    }
    // CNF constant 1 (tautology): highlight no cells
    if (isConstant1) {
      return [];
    }

    // CNF: For a CNF formula to be FALSE, at least one clause must be FALSE
    // A clause (sum) is FALSE when ALL its literals are false
    // So we highlight cells where at least one clause is completely false
    const anyClauseFalse = terms.some(term => {
      return !isCovered(term, rowCode, colCode, functionType, inputVars);
    });

    if (!anyClauseFalse) return []; // Cell doesn't contribute to making formula false
  }

  return inferHighlightFromCoverage(
    terms, rowCodes, colCodes,
    rowIndex, colIndex, rowCode, colCode,
    functionType, inputVars
  );
}
