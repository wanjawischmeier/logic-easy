import type { IDockviewPanelProps } from "dockview-vue"
import type { Formula } from "../truthTableInterpreter"
import { FunctionType, type TruthTableData } from "../types"
import { computed } from "vue"

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

export type TruthTableProps = {
  params: IDockviewPanelProps & {
    params?: {
      state?: {
        inputVars: string[],
        outputVars: string[],
        values: TruthTableData,
        minifiedValues: TruthTableData,
        formulas: Record<string, Formula>
      },
      updateTruthTable?: (values: TruthTableData) => void
    }
  }
}

export function useTruthTableState(props: TruthTableProps) {
  const state = computed(() => props.params?.params?.state)
  const inputVars = computed(() => state.value?.inputVars || [])
  const outputVars = computed(() => state.value?.outputVars || [])
  const functionTypes = computed(() => Object.values(FunctionType))

  return { state, inputVars, outputVars, functionTypes }
}
