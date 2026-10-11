import type { FsmState } from '@/projects/state-machine/FsmTypes'
import { expandInputs } from './editorTransitionUtils'
import { resolveTransitionTargetNodes } from './fsmStateTableUtils'
import { calcBinaryID, calcBitNumber, normalizeBits } from '../bitOperations'

export type FsmValidity = { valid: true } | { valid: false; reason: string }

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

// Validate the FSM and return the first problem so the overlay can explain it
export function validateFsm(state: FsmState): FsmValidity {
  const transitions = state.transitions ?? []

  for (const transition of transitions) {
    const targetNodes = resolveTransitionTargetNodes(state, transition)
    const targetPattern = transition.toNodeId >= 0 ? '' : (transition.toBinaryId ?? '')
    const normalizedTargetPattern = targetPattern.replace(/-/g, 'x')

    // A removed target keeps its dead pattern until the user picks a new next state
    if (transition.removedTarget) {
      return { valid: false, reason: 'A transition points at a non-existing state.' }
    }

    // All-don't-care next states stay undrawn and never lock the editor
    if (transition.toNodeId < 0 && /^x+$/.test(normalizedTargetPattern)) continue

    if (transition.toNodeId < 0) {
      const { missingTargetBits } = analyzeTargetPattern(state, normalizedTargetPattern)

      if (missingTargetBits.length > 0) {
        return { valid: false, reason: 'A transition points at a non-existing state.' }
      }
    }

    // Rule: every next-state pattern must resolve to an existing state
    if (targetNodes.length === 0) {
      return { valid: false, reason: 'A transition points at a non-existing state.' }
    }

    // Rule: in Moore mode all target states of a transition must show the same output
    if (state.fsmModel === 'moore') {
      const outputBits = state.outputBitCount ?? 1
      const outputs = targetNodes.map((node) =>
        normalizeBits(node.mooreOutput, outputBits, 'x', 'right'),
      )
      for (let bit = 0; bit < outputBits; bit += 1) {
        const firstBit = outputs[0]?.charAt(bit) ?? 'x'
        if (outputs.some((bits) => bits.charAt(bit) !== firstBit)) {
          return {
            valid: false,
            reason:
              'In Moore mode a transition covers states with different outputs - give these states the same output, or use concrete next states.',
          }
        }
      }
    }
  }

  return { valid: true }
}
