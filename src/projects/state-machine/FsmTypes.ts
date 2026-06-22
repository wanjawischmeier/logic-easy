import type { BaseProjectProps } from '../Project'
import type { FunctionType } from '@/utility/types'

export type FsmModel = 'mealy' | 'moore'

// State encoding (Binary & One-Hot) for lc
export const StateEncoding = { binary: 'Binary', oneHot: 'One-Hot' } as const
export type StateEncoding = (typeof StateEncoding)[keyof typeof StateEncoding]
export const defaultStateEncoding: StateEncoding = 'Binary'

// Flip-flop types for lc
export const FlipFlopType = { d: 'D', jk: 'JK', rs: 'RS' } as const
export type FlipFlopType = (typeof FlipFlopType)[keyof typeof FlipFlopType]
export const defaultFlipFlopType: FlipFlopType = 'D'

// Default values for FsmProps
export interface FsmProps extends BaseProjectProps {
  initialFsmType: FsmModel
  initialInputBits: number
  initialOutputBits: number
}

// type definition for state nodes (all attributes)
export interface FsmNode {
  name: string
  nodeId: number
  binaryNodeId?: string
  isInitial: boolean
  isFinal?: boolean
  editorCoordX?: number
  editorCoordY?: number
  mooreOutput?: string
}

// type definition for transitions (all attributes)
export interface FsmTransition {
  transitionId: number
  fromNodeId: number
  toNodeId: number
  toBinaryId?: string
  input: string
  mealyOutput?: string
}

// type definition for whole central fsm state
export interface FsmState {
  nodes: FsmNode[]
  transitions: FsmTransition[]
  fsmModel: FsmModel
  functionType?: FunctionType

  nodeIdBitCount: number
  outputBitCount?: number
  inputBitCount?: number

  // lc export: FF type and state encoding
  stateEncoding?: StateEncoding
  flipFlopType?: FlipFlopType
}
