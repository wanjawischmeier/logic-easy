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

// Validate the automaton and return the first problem so the editor can show a precise reason
export function validateFsm(state: FsmState): FsmValidity {
  const transitions = state.transitions ?? []
  console.log('[FSM] validateFsm: checking', {
    model: state.fsmModel,
    nodes: state.nodes,
    transitions,
  })

  for (const transition of transitions) {
    const targetNodes = resolveTransitionTargetNodes(state, transition)
    const targetPattern = transition.toNodeId >= 0 ? '' : (transition.toBinaryId ?? '')
    const normalizedTargetPattern = targetPattern.replace(/-/g, 'x')

    if (transition.toNodeId < 0) {
      const maxNodeId = state.nodes.reduce((m, n) => Math.max(m, Number(n?.nodeId ?? -1)), 0)
      const minimumNodeIdBitCount = calcBitNumber(Math.max(1, maxNodeId + 1))
      const nodeIdBitCount = Math.max(minimumNodeIdBitCount, normalizedTargetPattern.length)
      const normalizedPattern = normalizeBits(normalizedTargetPattern, nodeIdBitCount, 'x', 'left')
      const possibleTargetBits = expandInputs(normalizedPattern)
      const existingTargetBits = new Set(
        state.nodes.map((node) => calcBinaryID(node.nodeId, nodeIdBitCount)),
      )
      const missingTargetBits = possibleTargetBits.filter((bits) => !existingTargetBits.has(bits))

      if (missingTargetBits.length > 0) {
        const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
        console.log('[FSM] validateFsm: INVALID (incomplete target pattern)', {
          transition,
          input,
          targetPattern: normalizedPattern,
          missingTargetBits,
        })
        return {
          valid: false,
          reason: `The transition from "${sourceStateName(state, transition)}" (input ${input}) has next state pattern "${normalizedPattern}", but state(s) ${missingTargetBits.join(', ')} do not exist.`,
        }
      }
    }

    // Rule: every next-state pattern must resolve to an existing state
    if (targetNodes.length === 0) {
      const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
      console.log('[FSM] validateFsm: INVALID (missing target state)', {
        transition,
        input,
        targetPattern,
      })
      return {
        valid: false,
        reason: `The transition from "${sourceStateName(state, transition)}" (input ${input}) has next state pattern "${targetPattern || 'x'}", but no existing state matches it.`,
      }
    }

    // Rule: in Moore mode transitions with the same target state must share one output
    if (state.fsmModel === 'moore') {
      const outputBits = state.outputBitCount ?? 1
      const outputs = targetNodes.map((node) =>
        normalizeBits(node.mooreOutput, outputBits, 'x', 'right'),
      )
      for (let bit = 0; bit < outputBits; bit += 1) {
        const hasZero = outputs.some((bits) => bits.charAt(bit) === '0')
        const hasOne = outputs.some((bits) => bits.charAt(bit) === '1')
        if (hasZero && hasOne) {
          const input = normalizeBits(transition.input, state.inputBitCount ?? 1, 'x', 'right')
          console.log('[FSM] validateFsm: INVALID (Moore output conflict)', {
            transition,
            input,
            outputs,
          })
          return {
            valid: false,
            reason: `In Moore mode, the transition from "${sourceStateName(state, transition)}" (input ${input}) targets states with conflicting outputs.`,
          }
        }
      }
    }
  }

  console.log('[FSM] validateFsm: valid')
  return { valid: true }
}
