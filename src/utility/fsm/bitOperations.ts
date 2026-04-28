export function calcBitNumber(idsCount?: number): number {
  // calculate amount of bits needed for each binary statenode ID
  const length = idsCount ?? 0
  return length === 0 ? 1 : Math.ceil(Math.log2(Math.max(length, 1)))
}

export function calcBinaryID(id: number, bitCount: number): string {
  // calculate binary IDs of state nodes
  return Number(id).toString(2).padStart(bitCount, '0')
}
