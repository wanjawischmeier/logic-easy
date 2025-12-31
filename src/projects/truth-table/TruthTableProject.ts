import { createPanel } from "@/utility/dockview/integration";
import { Project, type BaseProjectProps, type TruthTableData, type TruthTableCell } from "../Project";
import TruthTablePropsComponent from "./TruthTablePropsComponent.vue";
import type { Formula, FunctionType } from "@/utility/types";
import { computed } from "vue";
import { stateManager, type AppState } from "@/states/stateManager";
import { registerProject } from '@/projects/projectRegistry';

// Default values for TruthTableProps
export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export const defaultTruthTableProps: TruthTableProps = {
  name: '',
  inputVariableCount: 2,
  outputVariableCount: 1,
};

export interface TruthTableState {
  inputVars: string[];
  outputVars: string[];
  values: TruthTableData;
  minifiedValues: TruthTableData;
  formulas: Record<string, Record<string, Formula>>;
}

export class TruthTableProject extends Project {
  static override useState() {
    const state = computed(() => stateManager.state.truthTable)
    const inputVars = computed(() => state.value?.inputVars || [])
    const outputVars = computed(() => state.value?.outputVars || [])
    const functionTypes = computed(() => Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>))

    return { state, inputVars, outputVars, functionTypes }
  }

  static override restoreDefaultPanelLayout(props: TruthTableProps) {
    createPanel('truth-table', 'Truth Table')

    // Add KV diagram if input count is between 2 and 4
    if (props.inputVariableCount >= 2 && props.inputVariableCount <= 4) {
      createPanel('kv-diagram', 'KV Diagram', {
        referencePanel: 'truth-table',
        direction: 'right'
      })
    }
  }

  private static generateVariableNames(count: number, startCharCode: number): string[] {
    return Array.from({ length: count }, (_, i) => String.fromCharCode(startCharCode + i))
  }

  static override createState(appState: AppState, props: TruthTableProps) {
    console.log('[TruthTableProject.createState] Initializing project state')

    // Generate variable names
    const inputVariables = this.generateVariableNames(props.inputVariableCount, 97)
    const outputVariables = this.generateVariableNames(props.outputVariableCount, 112)

    // create formulas
    const formulas: Record<string, Record<string, Formula>> = {}
    outputVariables.forEach((name) => {
      formulas[name] = {}
    })

    // number of rows = 2^n
    const rows = 1 << props.inputVariableCount

    // initialize all output values to zero
    const values = Array.from({ length: rows }, () =>
      Array.from({ length: props.outputVariableCount }, () => 0 as TruthTableCell)
    ) as TruthTableData

    // Initialize state
    appState.truthTable = {
      inputVars: inputVariables,
      outputVars: outputVariables,
      formulas,
      values,
      minifiedValues: values,
    }

    console.log('[TruthTableProject.createState] State initialized:', {
      inputVars: inputVariables,
      outputVars: outputVariables,
      hasValues: !!values
    })
  }
}

// Register the runtime class with the project registry to avoid direct import cycles
registerProject('truth-table', {
  propsComponent: TruthTablePropsComponent,
  projectClass: TruthTableProject
});
