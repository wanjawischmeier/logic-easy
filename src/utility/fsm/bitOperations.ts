export type Bit = '0' | '1' | 'x'

/**
 * calculate amount of bits needed for each binary statenode ID.
 * @param idsCount
 * @returns
 */
export function calcBitNumber(idsCount?: number): number {
  const length = idsCount ?? 0
  return length <= 1 ? 1 : Math.ceil(Math.log2(length))
}

/**
 * calculate binary IDs of state nodes
 * @param id
 * @param bitCount
 * @returns
 */
export function calcBinaryID(id: number, bitCount: number): string {
  return Number(id).toString(2).padStart(bitCount, '0')
}

/**
 * normalizes string to fixed length.
 */
export function normalizeBits(
  val: string | undefined,
  len: number,
  fill: Bit = 'x',
  align: 'left' | 'right' = 'left',
): string {
  const s = (val ?? '').replace(/-/g, 'x')
  if (s.length >= len) {
    return align === 'left' ? s.slice(-len) : s.slice(0, len)
  }
  return align === 'left' ? s.padStart(len, fill) : s.padEnd(len, fill)
}

/**
 * universal bit toggler 0 -> 1 -> x -> 0
 * @param str
 * @param index
 * @param length
 * @returns
 */
export function toggleBitInString(str: string, index: number, length: number): string {
  const normalized = normalizeBits(str, length)
  const chars = normalized.split('')
  const b = chars[index]
  chars[index] = b === '0' ? '1' : b === '1' ? 'x' : '0'
  return chars.join('')
}
