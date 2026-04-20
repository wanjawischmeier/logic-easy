import {
  getBinaryString,
  getLeftVariables,
  getTopVariables,
} from '@/utility/truthtable/kvDiagramLayout'

export interface KVDiagramAxisVariables {
  left: string[]
  top: string[]
}

export function resolveAxisVariables(inputVars: string[]): KVDiagramAxisVariables {
  const count = inputVars.length
  const defaultLeft = getLeftVariables(inputVars)
  const defaultTop = getTopVariables(inputVars)

  if (count !== 3) {
    return { left: defaultLeft, top: defaultTop }
  }

  const groups = new Map<string, string[]>()
  for (const variableName of inputVars) {
    const key = getVariableGroupKey(variableName)
    const existing = groups.get(key)
    if (existing) existing.push(variableName)
    else groups.set(key, [variableName])
  }

  let pairGroup: string[] | null = null
  let singleGroup: string[] | null = null

  for (const group of groups.values()) {
    if (group.length === 2) pairGroup = group
    if (group.length === 1) singleGroup = group
  }

  if (!pairGroup || !singleGroup) {
    return { left: defaultLeft, top: defaultTop }
  }

  // For 3 variables, keep the one-bit axis on the left and the two grouped vars on top.
  return { left: [...singleGroup], top: [...pairGroup] }
}

export function getRowIndexFromCodes(
  rowCode: string,
  colCode: string,
  axisOrderedVariables: string[],
  sourceVariables: string[],
): number {
  const binaryString = getBinaryString(rowCode, colCode)

  if (
    axisOrderedVariables.length !== sourceVariables.length ||
    binaryString.length !== sourceVariables.length
  ) {
    const fallback = parseInt(binaryString, 2)
    return Number.isNaN(fallback) ? -1 : fallback
  }

  const bitByVariable = new Map<string, string>()
  axisOrderedVariables.forEach((variableName, index) => {
    const bit = binaryString.charAt(index)
    bitByVariable.set(variableName, bit)
  })

  const sourceOrderBits = sourceVariables.map(
    (variableName) => bitByVariable.get(variableName) ?? '0',
  )
  const mapped = parseInt(sourceOrderBits.join(''), 2)
  return Number.isNaN(mapped) ? -1 : mapped
}

export function formatVariableForLatex(variableName: string): string {
  const normalized = variableName.replace(/\s+/g, '')

  const nextStateMatch = /^([A-Za-z])_(\d+)\^(?:\(n\+1\)|n\+1)$/i.exec(normalized)
  if (nextStateMatch) {
    const symbol = nextStateMatch[1]!.toUpperCase()
    const index = nextStateMatch[2]!
    return `${symbol}_{${index}}^{(n+1)}`
  }

  const currentStateMatch = /^([A-Za-z])_(\d+)\^n$/i.exec(normalized)
  if (currentStateMatch) {
    const symbol = currentStateMatch[1]!.toUpperCase()
    const index = currentStateMatch[2]!
    return `${symbol}_{${index}}^{n}`
  }

  return variableName
}

export function formatGroupedVariablesForLatex(variableNames: string[]): string {
  if (variableNames.length === 0) return ''

  // Keep old branch behavior for normal truth-table variables (a,b,c,...)
  const hasAutomatonStyleVariables = variableNames.some((name) => /_[0-9]+\^/.test(name))
  if (!hasAutomatonStyleVariables) {
    return variableNames.map(formatVariableForLatex).join('')
  }

  const grouped: Array<{ key: string; entries: string[] }> = []

  for (const variableName of variableNames) {
    const key = getVariableGroupKey(variableName)
    const existingGroup = grouped.find((group) => group.key === key)

    if (existingGroup) {
      existingGroup.entries.push(variableName)
      continue
    }

    grouped.push({ key, entries: [variableName] })
  }

  return grouped
    .map((group) => group.entries.map(formatVariableForLatex).join(''))
    .join('\\;')
}

export function getVariableGroupKey(variableName: string): string {
  const normalized = variableName.replace(/\s+/g, '')
  const match = /^([A-Za-z])_\d+\^/.exec(normalized)
  return match?.[1]?.toUpperCase() ?? normalized
}
