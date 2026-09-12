import { FunctionType, type Formula, type FunctionRepresentation } from '@/utility/types'
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject'
import { calculateAllCoverage } from './kvDiagramHighlights'
import { defaultColor, type TermColor } from './colorGenerator'
import { formatLatexIdentifier } from './latexGenerator'
import {
  getColCodes,
  getLeftVariables,
  getRowCodes,
  getTopVariables,
  getBinaryString,
} from './kvDiagramLayout'

// packages needed by kv
export const KV_TIKZ_PREAMBLE = String.raw`\usepackage{amsmath}
\usepackage{xcolor}
\usepackage{tikz}
\usetikzlibrary{matrix}
`

interface KVDiagramLatexOptions {
  inputVars: string[]
  inputVarLabels?: string[]
  values: TruthTableData
  outputVariableIndex: number
  functionType: FunctionType
  functionRepresentation: FunctionRepresentation
  selectedFormula?: Formula
  formulaTermColors?: TermColor[]
}

interface Span {
  start: number
  length: number
  wraps: boolean
}

// hsla to rgb color needed by TikZ
function hslaToTikzColor(hsla: string): string {
  const match = hsla.match(/hsla?\((\d+\.?\d*),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%/)
  const hue = parseFloat(match?.[1] ?? '210') / 30
  const saturation = parseFloat(match?.[2] ?? '50') / 100
  const lightness = parseFloat(match?.[3] ?? '50') / 100

  const amplitude = saturation * Math.min(lightness, 1 - lightness)
  const channel = (offset: number) => {
    const k = (offset + hue) % 12
    return Math.round((lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
  }

  return `{rgb,255:red,${channel(0)};green,${channel(8)};blue,${channel(4)}}`
}

// Split a set of covered indices into its maximal cyclically contiguous spans.
function findSpans(covered: boolean[]): Span[] {
  const count = covered.filter(Boolean).length
  if (count === 0) return []
  if (count === covered.length) return [{ start: 0, length: count, wraps: false }]

  const starts = covered.flatMap((isCovered, index) =>
    isCovered && !covered[(index - 1 + covered.length) % covered.length] ? [index] : [],
  )
  return starts.map((start) => {
    let length = 1
    while (covered[(start + length) % covered.length]) length++
    return { start, length, wraps: start + length > covered.length }
  })
}

// maps a row/column position to minterm index used as TikZ node name
function nodeName(rowCodes: string[], colCodes: string[], row: number, col: number): number {
  return parseInt(
    getBinaryString(rowCodes[row % rowCodes.length]!, colCodes[col % colCodes.length]!),
    2,
  )
}

// wraps TikZ path specification in correct group styling
function path(color: string, spec: string): string {
  return `\\draw[rounded corners=3pt, draw=${color}, fill=${color}, fill opacity=0.25, line width=0.6pt] ${spec};`
}

// draws filled box spanning from top left to bottom right node
function rectangle(color: string, topLeft: number, bottomRight: number): string {
  return path(color, `(${topLeft}.north west) rectangle (${bottomRight}.south east)`)
}

// draws the actual group
// when reaching the edges, group borders are drawn so they can be continued on the other side.
function drawGroup(
  rowCodes: string[],
  colCodes: string[],
  rowSpan: Span,
  colSpan: Span,
  color: string,
): string {
  const node = (row: number, col: number) => nodeName(rowCodes, colCodes, row, col)
  const top = rowSpan.start
  const bottom = rowSpan.start + rowSpan.length - 1
  const left = colSpan.start
  const right = colSpan.start + colSpan.length - 1

  if (rowSpan.wraps && colSpan.wraps) {
    const rowParts = [
      [top, rowCodes.length - 1],
      [0, bottom],
    ]
    const colParts = [
      [left, colCodes.length - 1],
      [0, right],
    ]
    return rowParts
      .flatMap(([rowFrom, rowTo]) =>
        colParts.map(([colFrom, colTo]) =>
          rectangle(color, node(rowFrom!, colFrom!), node(rowTo!, colTo!)),
        ),
      )
      .join('\n')
  }

  if (colSpan.wraps) {
    const leftEnd = node(top, right)
    const rightStart = node(bottom, left)
    return [
      path(
        color,
        `(rf.east |- ${leftEnd}.north) -| (${leftEnd}.east) |- (rf.east |- ${rightStart}.south)`,
      ),
      path(
        color,
        `(cf.west |- ${leftEnd}.north) -| (${rightStart}.west) |- (cf.west |- ${rightStart}.south)`,
      ),
    ].join('\n')
  }

  if (rowSpan.wraps) {
    const topEnd = node(bottom, left)
    const bottomStart = node(top, right)
    return [
      path(
        color,
        `(cf.south -| ${topEnd}.west) |- (${topEnd}.south) -| (cf.south -| ${bottomStart}.east)`,
      ),
      path(
        color,
        `(rf.north -| ${topEnd}.west) |- (${bottomStart}.north) -| (rf.north -| ${bottomStart}.east)`,
      ),
    ].join('\n')
  }

  return rectangle(color, node(top, left), node(bottom, right))
}

// one group per formula term
function getGroupCommands(
  options: KVDiagramLatexOptions,
  rowCodes: string[],
  colCodes: string[],
  termColor: (termIndex: number) => string,
): string[] {
  const terms = options.selectedFormula?.terms
  if (options.functionRepresentation !== 'Minimal' || !terms?.length) return []

  const isCNF = options.functionType === FunctionType.CNF

  const constant =
    terms.length === 1 && terms[0]!.literals.length === 1 ? terms[0]!.literals[0]?.variable : null
  if (constant === '0' || constant === '1') {
    if ((constant === '1') === isCNF) return []
    return [
      rectangle(
        termColor(0),
        nodeName(rowCodes, colCodes, 0, 0),
        nodeName(rowCodes, colCodes, rowCodes.length - 1, colCodes.length - 1),
      ),
    ]
  }

  const coverage = calculateAllCoverage(
    terms,
    rowCodes,
    colCodes,
    options.functionType,
    options.inputVars,
  )

  return terms.flatMap((_, termIndex) => {
    const isInGroup = (row: number, col: number) => coverage[termIndex]?.[row]?.[col] !== isCNF
    const rowSpans = findSpans(
      rowCodes.map((_, row) => colCodes.some((_, col) => isInGroup(row, col))),
    )
    const colSpans = findSpans(
      colCodes.map((_, col) => rowCodes.some((_, row) => isInGroup(row, col))),
    )

    return rowSpans.flatMap((rowSpan) =>
      colSpans.map((colSpan) =>
        drawGroup(rowCodes, colCodes, rowSpan, colSpan, termColor(termIndex)),
      ),
    )
  })
}

// builds the kv diagram per output variable
export function getKVDiagramLatex(options: KVDiagramLatexOptions): string {
  const displayVars = options.inputVarLabels ?? options.inputVars
  const rowCodes = getRowCodes(options.inputVars.length)
  const colCodes = getColCodes(options.inputVars.length)
  if (!rowCodes.length || !colCodes.length) return ''

  const termColor = (termIndex: number) =>
    hslaToTikzColor((options.formulaTermColors?.[termIndex] ?? defaultColor).border)
  const groups = getGroupCommands(options, rowCodes, colCodes, termColor)

  // axis labels
  const topLabel = getTopVariables(displayVars)
    .map((v) => formatLatexIdentifier(v))
    .join('\\,')
  const leftLabel = getLeftVariables(displayVars)
    .map((v) => formatLatexIdentifier(v))
    .join('\\,')

  // cell values
  const cellValue = (rowCode: string, colCode: string) =>
    String(
      options.values[parseInt(getBinaryString(rowCode, colCode), 2)]?.[
        options.outputVariableIndex
      ] ?? '-',
    )

  const headerRow = ['', ...colCodes, '|(cf)| \\phantom{00}'].join(' \\& ')

  const bodyRows = rowCodes.map((rowCode) =>
    [
      rowCode,
      ...colCodes.map(
        (colCode) =>
          `|(${parseInt(getBinaryString(rowCode, colCode), 2)})| ${cellValue(rowCode, colCode)}`,
      ),
      '',
    ].join(' \\& '),
  )

  const closingRow = ['|(rf)| \\phantom{00}', ...colCodes.map(() => ''), ''].join(' \\& ')
  const anchor = nodeName(rowCodes, colCodes, rowCodes.length - 1, 0)

  return `\\begin{tikzpicture}[baseline=(current bounding box.north),scale=0.8]
\\draw (0,0) grid (${colCodes.length},${rowCodes.length});
\\draw (0,${rowCodes.length}) -- node [pos=0.7,above right,anchor=south west] {$${topLabel}$} node [pos=0.7,below left,anchor=north east] {$${leftLabel}$} ++(135:1);
\\matrix (mapa) [matrix of nodes,
        column sep={0.8cm,between origins},
        row sep={0.8cm,between origins},
        every node/.style={minimum size=0.3mm},
        anchor=${anchor}.center,
        ampersand replacement=\\&] at (0.5,0.5)
{
${[headerRow, ...bodyRows, closingRow].map((row) => `${row} \\\\`).join('\n')}
};
${groups.join('\n')}
\\end{tikzpicture}`
}

// wrap diagrams into document
export function getKVDiagramDocument(body: string): string {
  return `\\documentclass[varwidth]{standalone}
${KV_TIKZ_PREAMBLE}
\\begin{document}
${body}
\\end{document}
`
}
