import type { FsmState } from '@/projects/state-machine/FsmTypes'
import {
  isHiddenTransition,
  needsHiddenCleanup,
  resolveTransitionTargetNodes,
} from './fsmStateTableUtils'
import { normalizeBits } from '../bitOperations'

export type FsmValidity = { valid: true } | { valid: false; reason: string }

// Which overlay a view has to show. Exactly one place decides this, so the
// Editor, the Karnaugh-Veitch view and the LogicCircuits view can never disagree.
// An error on the drawn edges wins: repairing it is what countPendingHiddenRows waits for.
export type FsmViewMode = 'invalid' | 'hidden-pending' | 'ready'

export function fsmViewMode(state: FsmState | undefined): FsmViewMode {
  if (!state) return 'ready'
  if (!validateFsm(state).valid) return 'invalid'
  return countPendingHiddenRows(state) > 0 ? 'hidden-pending' : 'ready'
}

// Hidden rows only confuse the views while the drawn machine itself is fine
// Clearing them cannot repair an invalid machine, so the warning waits for that
export function countPendingHiddenRows(state: FsmState): number {
  if (!validateFsm(state).valid) return 0
  return (state.transitions ?? []).filter(needsHiddenCleanup).length
}

// Rows the editor does not draw at all. This is the number the views report.
export function countHiddenRows(state: FsmState): number {
  return (state.transitions ?? []).filter(isHiddenTransition).length
}

// Rows that still show concrete bits, so the views ask to clean them up
// Not gated on validity: the number stays correct while the machine is also invalid
export function countHiddenRowsWithBits(state: FsmState): number {
  return (state.transitions ?? []).filter(needsHiddenCleanup).length
}

// Validate the FSM and return the first problem so the overlay can explain it
export function validateFsm(state: FsmState): FsmValidity {
  const transitions = state.transitions ?? []

  for (const transition of transitions) {
    // Hidden rows have no unique next state, so they are not drawn and never lock a view
    if (isHiddenTransition(transition)) continue

    // Rule: a drawn transition must end in a state that exists
    const targetNodes = resolveTransitionTargetNodes(state, transition)
    if (targetNodes.length === 0) {
      // Name the row so the user can find it: (source state, input) identifies it
      const sourceName =
        state.nodes.find((node) => node.nodeId === transition.fromNodeId)?.name ??
        `q${transition.fromNodeId}`
      const input = normalizeBits(
        transition.input,
        Math.max(1, state.inputBitCount ?? 1),
        'x',
        'right',
      ).replace(/x/g, '-')
      return {
        valid: false,
        reason: `The transition from "${sourceName}" with input ${input} points at a non-existing state.`,
      }
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
