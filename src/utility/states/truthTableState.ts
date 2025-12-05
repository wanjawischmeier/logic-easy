import type { Formula } from "../truthTableInterpreter"
import { FunctionType, type TruthTableData } from "../types"
import { computed } from "vue"
import { stateManager } from "./stateManager"

/**
 * Truth table state structure
 */
export interface TruthTableState {
  inputVars: string[]
  outputVars: string[]
  values: TruthTableData
  minifiedValues: TruthTableData
  formulas: Record<string, Record<string, Formula>>
}

export const defaultTruthTableState = {
  inputVars: ['a', 'b', 'c', 'd'],
  outputVars: ['x', 'y', 'z'],
  values: [
    [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 0],
    [1, 1, 0], [1, 0, 0], ['-', 1, 0], [0, 1, 0],
    [0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 0],
    ['-', 1, 0], [0, 0, 0], ['-', 1, 0], [0, 1, 0],
  ] as TruthTableData,
  minifiedValues: [] as TruthTableData,
  formulas: {} as Record<string, Record<string, Formula>>
}

export function useTruthTableState() {
  const truthTableState = computed(() => stateManager.state.truthTable)
  const inputVars = computed(() => truthTableState.value?.inputVars || [])
  const outputVars = computed(() => truthTableState.value?.outputVars || [])
  const functionTypes = computed(() => Object.values(FunctionType))

  return { state: truthTableState, inputVars, outputVars, functionTypes }
}
