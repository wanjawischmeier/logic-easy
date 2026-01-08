import { type Term, FunctionType } from "@/utility/types";

const CELL_PADDING = '6px'

interface TermColor {
  border: string
  fill: string
}

/**
 * Generate a semi-transparent HSLA color string for a term index.
 *
 * @param indexIndex of the term to generate a color for.
 * @returns HSLA color string (e.g. "hsla(120, 70%, 50%, 0.4)").
 */
function getTermColor(index: number): TermColor {
  const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
  return {
    border: `hsla(${hue}, 70%, 50%, 0.6)`,
    fill: `hsla(${hue}, 70%, 50%, 0.25)`
  }
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
 * Pre-calculate coverage for all cells and terms.
 *
 * @param terms Array of terms to evaluate.
 * @param rows All row binary codes.
 * @param cols All column binary codes.
 * @param functionType DNF or CNF mode.
 * @param inputVars Ordered list of input variable names.
 * @returns 3D array of coverage
 */
function calculateAllCoverage(
  terms: Term[],
  rows: string[],
  cols: string[],
  functionType: FunctionType,
  inputVars: string[]
): boolean[][][] {
  const coverage: boolean[][][] = [];

  terms.forEach((term, termIndex) => {
    coverage[termIndex] = [];
    rows.forEach((rowCode, rowIndex) => {
      coverage[termIndex]![rowIndex] = [];
      cols.forEach((colCode, colIndex) => {
        coverage[termIndex]![rowIndex]![colIndex] = isCovered(term, rowCode, colCode, functionType, inputVars);
      });
    });
  });

  return coverage;
}

/**
 * Compute css style for a given coverage scenario.
 * Puts borders on all egdes that do not have a neighbor.
 */
function getStyleFromCoverage(color: TermColor, hasTop: boolean, hasBottom: boolean, hasLeft: boolean, hasRight: boolean) {
  return {
    backgroundColor: color.fill,
    top: hasTop ? '0' : CELL_PADDING,
    bottom: hasBottom ? '0' : CELL_PADDING,
    left: hasLeft ? '0' : CELL_PADDING,
    right: hasRight ? '0' : CELL_PADDING,
    'border-top': hasTop ? '' : `solid ${color.border}`,
    'border-bottom': hasBottom ? '' : `solid ${color.border}`,
    'border-left': hasLeft ? '' : `solid ${color.border}`,
    'border-right': hasRight ? '' : `solid ${color.border}`,
  }
}

/**
 * Create a highlight for a cell that is part of a full coverage, with borders on edges.
 */
function createFullCoverageHighlight(
  rowIndex: number,
  colIndex: number,
  rowCount: number,
  colCount: number,
  color: TermColor
): Highlight {
  const isTopEdge = rowIndex === 0;
  const isBottomEdge = rowIndex === rowCount - 1;
  const isLeftEdge = colIndex === 0;
  const isRightEdge = colIndex === colCount - 1;

  return {
    style: getStyleFromCoverage(color, !isTopEdge, !isBottomEdge, !isLeftEdge, !isRightEdge)
  };
}

/**
 * Check if an entire row is covered by a term.
 */
function isEntireRowCovered(
  coverage: boolean[][][],
  termIndex: number,
  rowIndex: number,
  colCount: number,
  isCNF: boolean
): boolean {
  for (let ci = 0; ci < colCount; ci++) {
    if (coverage[termIndex]?.[rowIndex]?.[ci] === isCNF) {
      return false;
    }
  }
  return true;
}

/**
 * Check if an entire column is covered by a term.
 */
function isEntireColCovered(
  coverage: boolean[][][],
  termIndex: number,
  colIndex: number,
  rowCount: number,
  isCNF: boolean
): boolean {
  for (let ri = 0; ri < rowCount; ri++) {
    if (coverage[termIndex]?.[ri]?.[colIndex] === isCNF) {
      return false;
    }
  }
  return true;
}

/**
 * Infer visual highlight regions for a single cell by checking adjacency coverage for each term.
 *
 * Produces an array of Highlight objects describing background color and which cell edges
 * should be flush (no padding) to indicate grouping across neighboring cells.
 *
 * @param terms Array of terms (DNF or CNF) to consider.
 * @param coverage Pre-calculated coverage map [termIndex][rowIndex][colIndex].
 * @param rows All row binary codes.
 * @param cols All column binary codes.
 * @param rowIndexRow index of the current cell.
 * @param colIndexColumn index of the current cell.
 * @param functionType DNF or CNF mode.
 * @returns Array of Highlight descriptors for the cell.
 */
function inferHighlightFromCoverage(
  terms: Term[],
  coverage: boolean[][][],
  rows: string[],
  cols: string[],
  rowIndex: number,
  colIndex: number,
  functionType: FunctionType
): Highlight[] {
  const highlights: Highlight[] = [];
  const isCNF = functionType === FunctionType.CNF;

  terms.forEach((term, index) => {
    const covered = coverage[index]?.[rowIndex]?.[colIndex];
    if (covered === undefined || covered === isCNF) return

    const color = getTermColor(index);

    const topRowIndex = (rowIndex - 1 + rows.length) % rows.length;
    const bottomRowIndex = (rowIndex + 1) % rows.length;
    const leftColIndex = (colIndex - 1 + cols.length) % cols.length;
    const rightColIndex = (colIndex + 1) % cols.length;

    let hasTop = coverage[index]?.[topRowIndex]?.[colIndex] !== isCNF;
    let hasBottom = coverage[index]?.[bottomRowIndex]?.[colIndex] !== isCNF;
    let hasLeft = coverage[index]?.[rowIndex]?.[leftColIndex] !== isCNF;
    let hasRight = coverage[index]?.[rowIndex]?.[rightColIndex] !== isCNF;

    // Check edge cases: if entire row/column is covered, show outer borders
    if (rowIndex === 0 && isEntireColCovered(coverage, index, colIndex, rows.length, isCNF)) {
      hasTop = false;
    }
    if (rowIndex === rows.length - 1 && isEntireColCovered(coverage, index, colIndex, rows.length, isCNF)) {
      hasBottom = false;
    }
    if (colIndex === 0 && isEntireRowCovered(coverage, index, rowIndex, cols.length, isCNF)) {
      hasLeft = false;
    }
    if (colIndex === cols.length - 1 && isEntireRowCovered(coverage, index, rowIndex, cols.length, isCNF)) {
      hasRight = false;
    }

    highlights.push({
      style: getStyleFromCoverage(color, hasTop, hasBottom, hasLeft, hasRight)
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
      return [createFullCoverageHighlight(rowIndex, colIndex, rowCodes.length, colCodes.length, getTermColor(0))];
    }
    // DNF constant 0 (contradiction): highlight no cells
    if (isConstant0) {
      return [];
    }
  } else {
    // CNF mode
    // CNF constant 0 (contradiction): highlight all cells
    if (isConstant0) {
      return [createFullCoverageHighlight(rowIndex, colIndex, rowCodes.length, colCodes.length, getTermColor(0))];
    }
    // CNF constant 1 (tautology): highlight no cells
    if (isConstant1) {
      return [];
    }

    // Pre-calculate coverage for CNF check
    const coverage = calculateAllCoverage(terms, rowCodes, colCodes, functionType, inputVars);

    // CNF: For a CNF formula to be FALSE, at least one clause must be FALSE
    // A clause (sum) is FALSE when ALL its literals are false
    // So we highlight cells where at least one clause is completely false
    const anyClauseFalse = terms.some((_, termIndex) => {
      return !coverage[termIndex]?.[rowIndex]?.[colIndex];
    });

    if (!anyClauseFalse) return []; // Cell doesn't contribute to making formula false
  }

  // Pre-calculate coverage for all cells once
  const coverage = calculateAllCoverage(terms, rowCodes, colCodes, functionType, inputVars);

  return inferHighlightFromCoverage(
    terms, coverage, rowCodes, colCodes,
    rowIndex, colIndex, functionType
  );
}
