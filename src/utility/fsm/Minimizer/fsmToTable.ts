import type { TruthTableCell } from '@/projects/truth-table/TruthTableProject'
import { normalizeBits } from '../bitOperations'

export function mapFsmToTableValues(
  rows: { fromBinary: string; input: string; toBinary: string; output: string }[],
  stateBits: number,
  inputBits: number,
  outputBits: number,
): TruthTableCell[][] {
  const rowCount = 1 << (stateBits + inputBits)
  const colCount = stateBits + outputBits

  const values: TruthTableCell[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => '-'),
  )

  for (const row of rows) {
    const s = normalizeBits(row.fromBinary, stateBits, '0', 'left')
    const i = normalizeBits(row.input, inputBits, '0', 'left')
    const rowIndex = parseInt(`${s}${i}`, 2)

    if (isNaN(rowIndex) || rowIndex >= rowCount) continue

    const nextS = normalizeBits(row.toBinary, stateBits, 'x', 'left')
    const out = normalizeBits(row.output, outputBits, 'x', 'right')

    values[rowIndex] = [...nextS.split('').map(toCell), ...out.split('').map(toCell)]
  }

  return values
}

const toCell = (b: string): TruthTableCell => (b === '0' ? 0 : b === '1' ? 1 : '-')
