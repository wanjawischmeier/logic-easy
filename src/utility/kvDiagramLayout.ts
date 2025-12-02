export const grayCode2 = ['00', '01', '11', '10'];
export const grayCode1 = ['0', '1'];

export function getLeftVariables(variables: string[]): string[] {
  const count = variables.length;
  if (count === 2) return [variables[0]!]; // A
  if (count === 3) return [variables[0]!]; // A
  if (count === 4) return [variables[0]!, variables[1]!]; // AB
  return [];
}

export function getTopVariables(variables: string[]): string[] {
  const count = variables.length;
  if (count === 2) return [variables[1]!]; // B
  if (count === 3) return [variables[1]!, variables[2]!]; // BC
  if (count === 4) return [variables[2]!, variables[3]!]; // CD
  return [];
}

export function getRowCodes(variableCount: number): string[] {
  if (variableCount === 2) return grayCode1; // A: 0, 1
  if (variableCount === 3) return grayCode1; // A: 0, 1
  if (variableCount === 4) return grayCode2; // AB: 00, 01, 11, 10
  return [];
}

export function getColCodes(variableCount: number): string[] {
  if (variableCount === 2) return grayCode1; // B: 0, 1
  if (variableCount === 3) return grayCode2; // BC: 00, 01, 11, 10
  if (variableCount === 4) return grayCode2; // CD: 00, 01, 11, 10
  return [];
}

export function getBinaryString(rowCode: string, colCode: string): string {
  return rowCode + colCode;
}
