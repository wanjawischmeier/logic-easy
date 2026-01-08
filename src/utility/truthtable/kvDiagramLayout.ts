// Used for 2-variable columns/rows.
export const grayCode2 = ['00', '01', '11', '10'];

// Used for single-variable rows/columns.
export const grayCode1 = ['0', '1'];

/**
 * Determine which input variables appear on the left side of the K-V diagram.
 *
 * @param variables Full ordered list of variables (e.g. ['A','B','C','D'])
 * @returns Array of variable names assigned to the left (rows).
 */
export function getLeftVariables(variables: string[]): string[] {
  const count = variables.length;
  if (count === 2) return [variables[0]!]; // A
  if (count === 3) return [variables[0]!]; // A
  if (count === 4) return [variables[0]!, variables[1]!]; // AB
  return [];
}

/**
 * Determine which input variables appear on the top of the K-V diagram.
 *
 * @param variables Full ordered list of variables
 * @returns Array of variable names assigned to the top (columns).
 */
export function getTopVariables(variables: string[]): string[] {
  const count = variables.length;
  if (count === 2) return [variables[1]!]; // B
  if (count === 3) return [variables[1]!, variables[2]!]; // BC
  if (count === 4) return [variables[2]!, variables[3]!]; // CD
  return [];
}

/**
 * Get row Gray code sequences for the given variable count.
 *
 * @param variableCount Number of input variables
 * @returns Array of binary codes for rows.
 */
export function getRowCodes(variableCount: number): string[] {
  if (variableCount === 2) return grayCode1; // A: 0, 1
  if (variableCount === 3) return grayCode1; // A: 0, 1
  if (variableCount === 4) return grayCode2; // AB: 00, 01, 11, 10
  return [];
}

/**
 * Get column Gray code sequences for the given variable count.
 *
 * @param variableCount Number of input variables
 * @returns Array of binary codes for columns.
 */
export function getColCodes(variableCount: number): string[] {
  if (variableCount === 2) return grayCode1; // B: 0, 1
  if (variableCount === 3) return grayCode2; // BC: 00, 01, 11, 10
  if (variableCount === 4) return grayCode2; // CD: 00, 01, 11, 10
  return [];
}

/**
 * Combine a row code and column code into the full binary string for a cell.
 *
 * @param rowCode - Binary string for the row variables.
 * @param colCode - Binary string for the column variables.
 * @returns Concatenated binary string.
 */
export function getBinaryString(rowCode: string, colCode: string): string {
  return rowCode + colCode;
}
