import type { BaseProjectProps } from '../Project'

export type FsmModel = 'mealy' | 'moore'

// Default values for AutomatonProps
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
    input: string
    mealyOutput?: string
  }


// type definition for whole central fsm state
export interface FsmState {
  nodes: FsmNode[]
  transitions: FsmTransition[]
  fsmModel: FsmModel

  nodeIdBitCount: number
  outputBitCount?: number
  inputBitCount?: number
}
