import type { Term } from './truthTableInterpreter';

function getTermColor(index: number): string {
  const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
  return `hsla(${hue}, 70%, 50%, 0.4)`;
}

function isCovered(
  term: Term,
  rowCode: string,
  colCode: string,
  mode: string,
  inputVars: string[]
): boolean {
  const binaryString = rowCode + colCode;

  if (mode === 'DNF') {
    // DNF: Term is a product (AND of literals).
    // Covers cells where all literals are true.
    for (const literal of term.literals) {
      const varIndex = inputVars.indexOf(literal.variable);
      if (varIndex === -1) continue;

      const bit = binaryString[varIndex];
      // literal A (negated=false) requires bit '1'
      // literal !A (negated=true) requires bit '0'
      if (!literal.negated && bit !== '1') return false;
      if (literal.negated && bit !== '0') return false;
    }
    return mode === 'DNF';
  } else {
    // CNF: Term is a sum (OR of literals) - a clause.
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

function inferHighlightFromCoverage(
  terms: Term[],
  rows: string[],
  cols: string[],
  rIdx: number,
  cIdx: number,
  rowCode: string,
  colCode: string,
  mode: string,
  inputVars: string[]
): Highlight[] {
  const highlights: Highlight[] = [];
  const pad = '8px';

  terms.forEach((term, index) => {
    const covered = isCovered(term, rowCode, colCode, mode, inputVars);
    const isCNF = mode === 'CNF';
    if (covered === isCNF) return

    const color = getTermColor(index);

    const topRow = rows[(rIdx - 1 + rows.length) % rows.length]!;
    const bottomRow = rows[(rIdx + 1) % rows.length]!;
    const leftCol = cols[(cIdx - 1 + cols.length) % cols.length]!;
    const rightCol = cols[(cIdx + 1) % cols.length]!;

    const hasTop = isCovered(term, topRow, colCode, mode, inputVars) !== isCNF;
    const hasBottom = isCovered(term, bottomRow, colCode, mode, inputVars) !== isCNF;
    const hasLeft = isCovered(term, rowCode, leftCol, mode, inputVars) !== isCNF;
    const hasRight = isCovered(term, rowCode, rightCol, mode, inputVars) !== isCNF;

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

export interface Highlight {
  style: Record<string, string>;
}

export function calculateHighlights(
  rIdx: number,
  cIdx: number,
  rows: string[],
  cols: string[],
  terms: Term[],
  mode: string,
  inputVars: string[]
): Highlight[] {
  const rowCode = rows[rIdx];
  const colCode = cols[cIdx];

  if (!rowCode || !colCode) return [];

  if (mode === 'CNF') {
    // CNF: For a CNF formula to be FALSE, at least one clause must be FALSE
    // A clause (sum) is FALSE when ALL its literals are false
    // So we highlight cells where at least one clause is completely false
    const anyClauseFalse = terms.some(term => {
      return !isCovered(term, rowCode, colCode, mode, inputVars);
    });

    if (!anyClauseFalse) return []; // Cell doesn't contribute to making formula false

  }

  return inferHighlightFromCoverage(
    terms, rows, cols,
    rIdx, cIdx, rowCode, colCode,
    mode, inputVars
  );
}
