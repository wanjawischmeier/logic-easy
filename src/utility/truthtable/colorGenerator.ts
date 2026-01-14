import type { Formula } from "../types";

export interface TermColor {
    border: string
    fill: string
}

/**
 * Generate a semi-transparent HSLA color string for a term index using golden angle.
 *
 * @param index Index of the term to generate a color for.
 * @returns TermColor object with border and fill colors.
 */
export function generateTermColor(index: number): TermColor {
    const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
    return {
        border: `hsla(${hue}, 70%, 50%, 1)`,
        fill: `hsla(${hue}, 70%, 50%, 0.25)`
    };
}

/**
 * Map formula terms to prime implicant colors by matching their structure.
 * Returns an array of colors for each formula term based on which PI it came from.
 */
export function mapFormulaTermsToPIColors(
    formula: Formula,
    pis: any[],
    piColors: TermColor[],
    inputVars: string[]
): TermColor[] {
    return formula.terms.map((term, termIdx) => {
        // Find matching prime implicant by comparing literals
        const piIdx = pis.findIndex((pi, idx) => {
            const piTerm = pi.term as string;
            if (!piTerm) return false;

            // Count non-don't-care bits in PI
            const nonDontCareBits = piTerm.replace(/-/g, '').length;

            // Check if term has same number of literals as PI has non-don't-care bits
            if (term.literals.length !== nonDontCareBits) {
                return false;
            }

            // Check if all literals in the formula term match the PI
            const allMatch = term.literals.every(literal => {
                const varIdx = inputVars.indexOf(literal.variable);
                if (varIdx === -1) return false;

                const bitValue = piTerm[varIdx];
                if (bitValue === '-') return false;

                // For DNF: literal 'a' means bit='1', literal '!a' means bit='0'
                const matches = (!literal.negated && bitValue === '1') || (literal.negated && bitValue === '0');
                return matches;
            });

            return allMatch;
        });

        if (piIdx >= 0 && piColors[piIdx]) {
            return piColors[piIdx]!;
        }

        throw new Error(`No matching PI color found for formula term ${termIdx}`);
    });
}