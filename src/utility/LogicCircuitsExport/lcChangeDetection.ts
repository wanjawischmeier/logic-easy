import type { LCFile } from './LCFile'

const coordsKey = (block: string | undefined) =>
  block
    ?.match(/\{([^}]*)\}/g)
    ?.map((s) =>
      s
        .slice(1, -1)
        .split(',')
        .slice(1, 3)
        .map((v) => v.trim().slice(0, -1))
        .join(''),
    )
    .join('')

const labels = (block: string) =>
  block.match(/\{[^}]+\}/g)?.map((s) => s.slice(1, -1).split(',')[4] ?? '') ?? []

const count = (s: string | undefined, re: RegExp) => (s?.match(re) ?? []).length

// change detection for .lc files/strings
export function hasSignificantChanges(newLC: string, current: LCFile): boolean {
  const blocks = newLC.match(/\[([^\]]*)\]/g)

  // elements
  const newElems = blocks?.[1]
  const lastElems = current.elements.toString()
  if (count(newElems, /i/g) !== count(lastElems, /i/g)) return true
  if (count(newElems, /n/g) !== count(lastElems, /n/g)) return true
  if (coordsKey(newElems) !== coordsKey(lastElems)) return true

  // nodes
  const newNodes = blocks?.[2]
  const lastNodes = current.nodes.toString()
  if (count(newNodes, /{/g) !== count(lastNodes, /{/g)) return true
  if (count(newNodes, /\d+,\d+/g) !== count(lastNodes, /\d+,\d+/g)) return true

  // connections
  if (count(blocks?.[3], /{/g) !== count(current.connections.toString(), /{/g)) return true

  // text labels
  const newLabels = labels(blocks?.[4] ?? '')
  const lastLabels = labels(current.texts.toString())
  if (newLabels.join(',') !== lastLabels.join(',')) return true

  return false
}
