import type { FsmState } from '@/projects/state-machine/FsmTypes'
import { expandInputs } from './editorTransitionUtils'
import { resolveTransitionTargetNodes } from './fsmStateTableUtils'
import { calcBinaryID, calcBitNumber, normalizeBits } from '../bitOperations'

export type FsmValidity = { valid: true } | { valid: false; reason: string }

function sourceStateName(state: FsmState, transition: FsmState['transitions'][number]): string {
  return (
    state.nodes.find((node) => node.nodeId === transition.fromNodeId)?.name ??
    `q${transition.fromNodeId}`
  )
}

// Show a pattern the way the state table does, with "-" instead of the internal "x"
function displayPattern(pattern: string): string {
  return pattern.replace(/x/gi, '-')
}

// Indexes that can be used as a next state right now, so the message can say what is allowed
function existingIndexes(state: FsmState, bitCount: number, limit = 8): string {
  const indexes = state.nodes.map((node) => calcBinaryID(node.nodeId, bitCount)).sort()
  if (indexes.length === 0) return 'none'
  const shown = indexes.slice(0, limit).join(', ')
  return indexes.length > limit ? `${shown}, …` : shown
}

// What a next state with don't-cares expands to, and which of those indexes no state uses yet
function analyzeTargetPattern(state: FsmState, pattern: string) {
  const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
  const minimumNodeIdBitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
  const nodeIdBitCount = Math.max(minimumNodeIdBitCount, pattern.length)
  const normalizedPattern = normalizeBits(pattern, nodeIdBitCount, 'x', 'left')
  const possibleTargetBits = expandInputs(normalizedPattern)
  const existingTargetBits = new Set(
    state.nodes.map((node) => calcBinaryID(node.nodeId, nodeIdBitCount)),
  )
  const missingTargetBits = possibleTargetBits.filter((bits) => !existingTargetBits.has(bits))
  return { nodeIdBitCount, normalizedPattern, possibleTargetBits, missingTargetBits }
}

export type UnassignedNextStateWarning = { count: number; missing: string[] }

// An all-don't-care next state is unassigned, so it never locks the editor. While the state
// count is not a power of two the pattern still covers indexes that do not exist yet, which
// the table panel reports as a warning instead of an error
export function findUnassignedNextStateWarning(state: FsmState): UnassignedNextStateWarning | null {
  let count = 0
  let missing: string[] = []

  for (const transition of state.transitions ?? []) {
    if (transition.toNodeId >= 0) continue
    const pattern = (transition.toBinaryId ?? '').replace(/-/g, 'x')
    if (!/^x+$/.test(pattern)) continue

    const { missingTargetBits } = analyzeTargetPattern(state, pattern)
    if (missingTargetBits.length === 0) continue

    count += 1
    if (missing.length === 0) missing = missingTargetBits
  }

  return count > 0 ? { count, missing } : null
}

// Validate the automaton and return the first problem so the editor can show a precise reason
export function validateFsm(state: FsmState): FsmValidity {
  const transitions = state.transitions ?? []

  for (const transition of transitions) {
    const targetNodes = resolveTransitionTargetNodes(state, transition)
    const targetPattern = transition.toNodeId >= 0 ? '' : (transition.toBinaryId ?? '')
    const normalizedTargetPattern = targetPattern.replace(/-/g, 'x')

    // A removed target keeps its dead pattern until the user picks a new next state
    if (transition.removedTarget) {
      const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
      const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
      const bitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
      return {
        valid: false,
        reason: `The next state of the transition from "${sourceStateName(state, transition)}" (input ${displayPattern(input)}) points at a state that was removed. Pick an existing state: ${existingIndexes(state, bitCount)}.`,
      }
    }

    // An all-don't-care next state is unassigned: it stays hidden and never locks the editor
    if (transition.toNodeId < 0 && /^x+$/.test(normalizedTargetPattern)) continue

    if (transition.toNodeId < 0) {
      const { nodeIdBitCount, normalizedPattern, possibleTargetBits, missingTargetBits } =
        analyzeTargetPattern(state, normalizedTargetPattern)

      if (missingTargetBits.length > 0) {
        const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
        return {
          valid: false,
          reason: `The next state "${displayPattern(normalizedPattern)}" of the transition from "${sourceStateName(state, transition)}" (input ${displayPattern(input)}) covers the states ${possibleTargetBits.join(', ')}, but there is no state with the index ${missingTargetBits.join(', ')}. A next state may only use "-" when every index it covers exists as a state. Existing indexes: ${existingIndexes(state, nodeIdBitCount)}.`,
        }
      }
    }

    // Rule: every next-state pattern must resolve to an existing state
    if (targetNodes.length === 0) {
      const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
      const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
      const bitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
      return {
        valid: false,
        reason: `The next state "${displayPattern(targetPattern)}" of the transition from "${sourceStateName(state, transition)}" (input ${displayPattern(input)}) does not match any state. Existing indexes: ${existingIndexes(state, bitCount)}.`,
      }
    }

    // Rule: in Moore mode transitions with the same target state must share one output
    if (state.fsmModel === 'moore') {
      const outputBits = state.outputBitCount ?? 1
      const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
      const bitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
      const outputs = targetNodes.map((node) =>
        normalizeBits(node.mooreOutput, outputBits, 'x', 'right'),
      )
      for (let bit = 0; bit < outputBits; bit += 1) {
        const hasZero = outputs.some((bits) => bits.charAt(bit) === '0')
        const hasOne = outputs.some((bits) => bits.charAt(bit) === '1')
        if (hasZero && hasOne) {
          const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
          const reached = targetNodes
            .map(
              (node, index) =>
                `${calcBinaryID(node.nodeId, bitCount)} ${displayPattern(outputs[index] ?? '')}`,
            )
            .join(', ')
          return {
            valid: false,
            reason: `In Moore mode the output belongs to the state, so every transition to a state uses that state's output. The next state "${displayPattern(targetPattern)}" of the transition from "${sourceStateName(state, transition)}" (input ${displayPattern(input)}) covers ${reached}, whose outputs disagree. Set one output for these states, or narrow the next state to states that share an output.`,
          }
        }
      }
    }
  }

  return { valid: true }
}
