import type { BaseProjectProps } from '../Project'
import type { FunctionType } from '@/utility/types'

export type FsmModel = 'mealy' | 'moore'

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
}
