import type { FsmState, FsmNode, FsmTransition } from './FsmTypes'
import {
  // keep expand/fill centralized in transition utils
  expandInputs,
  fillMissingTransitions,
} from '@/utility/fsm/EditorSync/editorTransitionUtils'
import { calcBinaryID, calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import { nextFreeStateName, sanitizeStateName } from '@/utility/fsm/EditorSync/fsmStateTableUtils'

interface EditorExportState {
  id?: number
  name?: string
  initial?: boolean
  color?: string
  x?: number
  y?: number
  moore_output?: string
}

interface EditorExportTransition {
  id?: number
  from?: number
  to?: number
  toBinaryId?: string
  input?: string
  output?: string
  mealy_output?: string
  groupId?: number
}

interface EditorExportPayload {
  states?: EditorExportState[]
  transitions?: EditorExportTransition[]
}

const sanitizeEditorBits = (value: unknown, fallbackLength: number): string => {
  const normalized = String(value ?? '')
    .replace(/-/g, 'x')
    .replace(/[^01x]/g, '')
    .trim()
  // Clamp to the allowed bit width (just to be sure) and fallback to a string of 'x' if the result is empty
  return normalized.length === 0 ? 'x'.repeat(fallbackLength) : normalized.slice(0, fallbackLength)
}

// Canonical name, duplicate or missing names fall back to the smallest free "q<number>"
function reserveImportedName(requested: string | undefined, usedNames: Set<string>): string {
  const sanitized = sanitizeStateName(String(requested ?? '')).trim()
  if (sanitized && !usedNames.has(sanitized.toLowerCase())) {
    usedNames.add(sanitized.toLowerCase())
    return sanitized
  }

  const freeName = nextFreeStateName(usedNames)
  usedNames.add(freeName.toLowerCase())
  return freeName
}

function remapEditorNodes(incomingStates: EditorExportState[], s: FsmState) {
  const isMoore = s.fsmModel === 'moore'
  // Clamp to at least 1 bit so sanitizeEditorBits never pads to zero width
  const outputBits = Math.max(1, s.outputBitCount ?? 1)
  const sorted = [...incomingStates]
    .filter((st) => Number.isFinite(st?.id))
    .sort((a, b) => Number(a.id) - Number(b.id))

  const idMap = new Map<number, number>()
  sorted.forEach((st, idx) => idMap.set(Number(st.id), idx))

  const firstInitial = sorted.find((st) => !!st?.initial)
  // missing initial flag is not sanitized
  const initialOldId = firstInitial ? Number(firstInitial.id) : -1

  const usedNames = new Set<string>()
  const nodes: FsmNode[] = sorted.map((incomingState, index) => {
    const previousId = Number(incomingState.id)
    return {
      nodeId: index,
      name: reserveImportedName(incomingState.name, usedNames),
      isInitial: previousId === initialOldId,
      color: typeof incomingState.color === 'string' ? incomingState.color : undefined,
      editorCoordX: typeof incomingState.x === 'number' ? incomingState.x : undefined,
      editorCoordY: typeof incomingState.y === 'number' ? incomingState.y : undefined,
      mooreOutput: isMoore
        ? normalizeBits(
            sanitizeEditorBits(incomingState.moore_output, outputBits),
            outputBits,
            'x',
            'right',
          )
        : undefined,
    }
  })

  return { nodes, idMap }
}

export function importEditorPayload(raw: EditorExportPayload, state: FsmState) {
  // Clamp to at least 1 bit: a 0 bit count would leave an empty transition matrix
  const inputBits = Math.max(1, state.inputBitCount ?? 1)
  const outputBits = Math.max(1, state.outputBitCount ?? 1)
  const isMoore = state.fsmModel === 'moore'
  // states/transitions must be arrays, otherwise reduce/forEach below would throw a TypeError
  const incomingStates = Array.isArray(raw?.states) ? raw.states : []
  const incomingTransitions = Array.isArray(raw?.transitions) ? raw.transitions : []
  const maxIncomingStateId = incomingStates.reduce((max, entry) => {
    return Number.isFinite(entry?.id) ? Math.max(max, Number(entry.id)) : max
  }, -1)
  const targetBits = calcBitNumber(maxIncomingStateId + 1)

  const { nodes, idMap } = remapEditorNodes(incomingStates, state)
  const nodeBitCount = calcBitNumber(nodes.length)

  const rawExpanded: FsmTransition[] = []
  incomingTransitions.forEach((incomingTransition) => {
    if (!incomingTransition || typeof incomingTransition !== 'object') return
    const remappedFrom = idMap.get(Number(incomingTransition.from))
    if (remappedFrom === undefined) return

    const pattern = normalizeBits(
      sanitizeEditorBits(incomingTransition.input, inputBits),
      inputBits,
      'x',
      'right',
    )
    // normalize the output bits to the expected width, replacing any '-' with 'x' and clamping to the allowed bit width
    const outputBitsString = normalizeBits(
      sanitizeEditorBits(incomingTransition.mealy_output || incomingTransition.output, outputBits),
      outputBits,
      'x',
      'right',
    )
    const remappedTo = idMap.get(Number(incomingTransition.to))
    const concreteBits =
      remappedTo !== undefined ? calcBinaryID(remappedTo, nodeBitCount) : 'x'.repeat(nodeBitCount)

    let normalizedtoBinaryId: string
    let concreteToNodeId = -1
    let danglingTarget = false
    if (incomingTransition.toBinaryId) {
      const rawIncoming = String(incomingTransition.toBinaryId).replace(/-/g, 'x')
      const patternBits = Math.max(targetBits, rawIncoming.length)
      const rawPattern = sanitizeEditorBits(incomingTransition.toBinaryId, patternBits)
      const normalizedPattern = normalizeBits(rawPattern, patternBits, 'x', 'left')
      const remappedPatterns: string[] = []
      let unmappedTarget = false
      expandInputs(normalizedPattern).forEach((concreteOriginal) => {
        const originalState = incomingStates.find(
          (s) =>
            Number.isFinite(s?.id) && calcBinaryID(Number(s.id), patternBits) === concreteOriginal,
        )
        if (!originalState) {
          unmappedTarget = true
          return
        }
        const remappedNode = idMap.get(Number(originalState.id))
        if (remappedNode === undefined) {
          unmappedTarget = true
          return
        }
        remappedPatterns.push(calcBinaryID(remappedNode, nodeBitCount))
      })

      if (/^x+$/.test(normalizedPattern)) {
        // An all-x pattern keeps every next state allowed (for minimization)
        normalizedtoBinaryId = 'x'.repeat(nodeBitCount)
      } else if (unmappedTarget || remappedPatterns.length === 0) {
        // A dangling or incomplete pattern stays dangling so validateFsm locks the editor
        normalizedtoBinaryId = normalizedPattern
        danglingTarget = true
      } else {
        const merged = Array.from({ length: nodeBitCount }, (_, index) => {
          const bits = new Set(remappedPatterns.map((p) => p.charAt(index)))
          return bits.size === 1 ? [...bits][0] : 'x'
        }).join('')
        const covered = expandInputs(merged)
        const intended = new Set(remappedPatterns)
        // do not allow a pattern that covers more states than the user intended
        if (covered.length !== intended.size || !covered.every((bits) => intended.has(bits))) {
          normalizedtoBinaryId = 'x'.repeat(nodeBitCount)
          danglingTarget = true
        } else {
          normalizedtoBinaryId = merged
        }
      }
    } else {
      // If the editor payload has no toBinaryId, use the remapped target if it exists
      normalizedtoBinaryId = concreteBits
      danglingTarget = remappedTo === undefined
    }

    if (!danglingTarget && /^[01]+$/.test(normalizedtoBinaryId)) {
      concreteToNodeId =
        nodes.find((node) => calcBinaryID(node.nodeId, nodeBitCount) === normalizedtoBinaryId)
          ?.nodeId ?? -1
    }

    expandInputs(pattern).forEach((concreteInput) => {
      rawExpanded.push({
        transitionId: 0,
        groupId: Number.isFinite(incomingTransition.groupId)
          ? Number(incomingTransition.groupId)
          : Number.isFinite(incomingTransition.id)
            ? Number(incomingTransition.id)
            : undefined,
        fromNodeId: remappedFrom,
        toNodeId: concreteToNodeId,
        toBinaryId: concreteToNodeId >= 0 ? undefined : normalizedtoBinaryId,
        removedTarget: danglingTarget || undefined,
        input: concreteInput,
        mealyOutput: !isMoore ? outputBitsString : undefined,
      })
    })
  })

  const transitions = fillMissingTransitions(nodes, rawExpanded, inputBits, outputBits, isMoore)

  const names = new Map(nodes.map((node) => [node.nodeId, node.name]))
  const previousNames = new Map(state.nodes.map((node) => [node.nodeId, node.name]))
  const rowKey = (from: number, input: string, lookup: Map<number, string> = names) =>
    `${lookup.get(from) ?? from}|${input}`
  const providedTargets = new Set(
    rawExpanded.filter((t) => t.toNodeId >= 0).map((t) => rowKey(t.fromNodeId, t.input)),
  )
  const previouslyRemoved = new Set(
    (state.transitions ?? [])
      .filter((transition) => transition.removedTarget)
      .map((transition) => rowKey(transition.fromNodeId, transition.input, previousNames)),
  )
  transitions.forEach((transition) => {
    if (transition.toNodeId >= 0 || transition.removedTarget) return
    const key = rowKey(transition.fromNodeId, transition.input)
    // Only a target the payload really resolves clears the marker, a don't care row keeps it
    if (providedTargets.has(key)) return
    if (previouslyRemoved.has(key)) transition.removedTarget = true
  })

  return { nodes, transitions }
}

export default importEditorPayload
