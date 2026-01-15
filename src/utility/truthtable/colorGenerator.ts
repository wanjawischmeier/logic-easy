import type { Formula } from "../types";

export interface TermColor {
    border: string
    fill: string
}

const NUM_COLOR_CANDIDATES = 100

/**
 * Generate a semi-transparent HSLA color string for a term using golden angle.
 * If existing colors are provided, picks the hue most different from them.
 *
 * @param existingColors Optional array of existing colors to avoid similarity with.
 * @returns TermColor object with border and fill colors.
 */
export function generateTermColor(existingColors: TermColor[] = []): TermColor {
    let hue: number;

    if (existingColors.length === 0) {
        // No existing colors, use random hue
        hue = Math.random() * 360;
    } else {
        // Extract hues from existing colors
        const existingHues = existingColors.map(color => {
            const match = color.border.match(/hsla\((\d+\.?\d*),/);
            return match ? parseFloat(match[1]!) : 0;
        });

        // Try multiple candidate hues and pick the one with maximum minimum distance
        let bestHue = 0;
        let maxMinDistance = 0;

        for (let i = 0; i < NUM_COLOR_CANDIDATES; i++) {
            const candidateHue = (i * 360) / NUM_COLOR_CANDIDATES;

            // Find minimum distance to any existing hue
            const minDistance = Math.min(...existingHues.map(existingHue => {
                // Calculate angular distance (0-180 degrees)
                let diff = Math.abs(candidateHue - existingHue);
                if (diff > 180) diff = 360 - diff;
                return diff;
            }));

            if (minDistance > maxMinDistance) {
                maxMinDistance = minDistance;
                bestHue = candidateHue;
            }
        }

        hue = bestHue;
    }

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
    const isCNF = formula.type === 'CNF';

    return formula.terms.map((term, termIdx) => {
        // Handle constant terms (0 or 1) - just generate a color for them
        if (term.literals.length === 1) {
            const literal = term.literals[0];
            if (literal?.variable === '0' || literal?.variable === '1') {
                // For constants, just use the first color or generate one
                return piColors[0] || generateTermColor([]);
            }
        }

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
                // For CNF: after De Morgan, literal 'a' means bit='0', literal '!a' means bit='1'
                // (because CNF clauses represent maxterms where the output is 0)
                const matches = isCNF
                    ? ((!literal.negated && bitValue === '0') || (literal.negated && bitValue === '1'))
                    : ((!literal.negated && bitValue === '1') || (literal.negated && bitValue === '0'));
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