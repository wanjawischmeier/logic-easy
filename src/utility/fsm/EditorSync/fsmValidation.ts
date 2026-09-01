import type { FsmState } from '@/projects/state-machine/FsmTypes'
import { resolveTransitionTargetNodes } from './fsmStateTableUtils'
import { calcBitNumber, normalizeBits } from '../bitOperations'

export type FsmValidity = { valid: true } | { valid: false; reason: string }

function sourceStateName(state: FsmState, transition: FsmState['transitions'][number]): string {
  return (
    state.nodes.find((node) => node.nodeId === transition.fromNodeId)?.name ??
    `q${transition.fromNodeId}`
  )
}

// Validate the automaton and return the first problem so the editor can show a precise reason
export function validateFsm(state: FsmState): FsmValidity {
  const transitions = state.transitions ?? []

  for (const transition of transitions) {
    const targetNodes = resolveTransitionTargetNodes(state, transition)

    // Rule: next state must reference an existing state
    if (targetNodes.length === 0) {
      const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
      return {
        valid: false,
        reason: `The transition from "${sourceStateName(state, transition)}" (input ${input}) has a next state that does not exist.`,
      }
    }

    // Rule: in Moore mode transitions with the same target state must share one output
    if (state.fsmModel === 'moore') {
      // An all-don't-care next state is a valid, unassigned (hidden) placeholder
      if (transition.toNodeId < 0) {
        const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
        const nodeIdBitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
        const targetPattern = normalizeBits(
          transition.toBinaryId ?? '',
          nodeIdBitCount,
          'x',
          'left',
        )
        if (/^x+$/.test(targetPattern)) continue
      }
      const outputBits = state.outputBitCount ?? 1
      const outputs = targetNodes.map((node) =>
        normalizeBits(node.mooreOutput, outputBits, 'x', 'right'),
      )
      for (let bit = 0; bit < outputBits; bit += 1) {
        const hasZero = outputs.some((bits) => bits.charAt(bit) === '0')
        const hasOne = outputs.some((bits) => bits.charAt(bit) === '1')
        if (hasZero && hasOne) {
          const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
          return {
            valid: false,
            reason: `In Moore mode, the transition from "${sourceStateName(state, transition)}" (input ${input}) targets states with conflicting outputs.`,
          }
        }
      }
    }
  }

  return { valid: true }
}
