export type BitFill = '0' | '1' | 'x'
export type BitAlign = 'left' | 'right'

export function normalizeBits(
  value: string | undefined,
  length: number,
  fill: BitFill,
  align: BitAlign = 'left',
): string {
  const normalizedLength = Math.max(length, 0)
  if (normalizedLength === 0) return ''

  const source = String(value ?? '')
  if (align === 'left') {
    return source.padStart(normalizedLength, fill).slice(-normalizedLength)
  }
  return source.padEnd(normalizedLength, fill).slice(0, normalizedLength)
}

export function editBits(
  value: string | undefined,
  length: number,
  fill: BitFill,
  align: BitAlign,
  mutate: (chars: string[]) => void,
): string {
  const chars = normalizeBits(value, length, fill, align).split('')
  mutate(chars)
  return chars.join('')
}

export function setBit(value: string, bitIndex: number, bit: BitFill): string {
  if (bitIndex < 0 || bitIndex >= value.length) return value
  const chars = value.split('')
  chars[bitIndex] = bit
  return chars.join('')
}

export function normalizeBinaryBits(value: string | undefined): string {
  const normalized = String(value ?? '').trim()
  if (!/^[01]+$/.test(normalized)) return ''
  return normalized
}
