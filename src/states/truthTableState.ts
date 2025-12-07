import { type TruthTableData, Formula, FunctionType } from "@/utility/types"
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

export function useTruthTableState() {
  const truthTableState = computed(() => stateManager.state.truthTable)
  const inputVars = computed(() => truthTableState.value?.inputVars || [])
  const outputVars = computed(() => truthTableState.value?.outputVars || [])
  const functionTypes = computed(() => Object.values(FunctionType))

  return { state: truthTableState, inputVars, outputVars, functionTypes }
}
