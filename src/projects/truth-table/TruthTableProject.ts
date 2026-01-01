import { createPanel } from "@/utility/dockview/integration";
import { Project, type BaseProjectProps, type TruthTableData, type TruthTableCell } from "../Project";
import TruthTablePropsComponent from "./TruthTablePropsComponent.vue";
import type { Formula } from "@/utility/types";
import { computed } from "vue";
import { stateManager } from "@/states/stateManager";
import { registerProjectType } from '@/projects/projectRegistry';

// Default values for TruthTableProps
export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export interface TruthTableState {
  inputVars: string[];
  outputVars: string[];
  values: TruthTableData;
  minifiedValues: TruthTableData;
  formulas: Record<string, Record<string, Formula>>;
}

export class TruthTableProject extends Project {
  static override get defaultProps(): TruthTableProps {
    return {
      name: '',
      inputVariableCount: 3,
      outputVariableCount: 1,
    };
  }

  static override useState() {
    const state = computed(() => stateManager.state.truthTable);

    const inputVars = computed(() => state.value?.inputVars ?? []);
    const outputVars = computed(() => state.value?.outputVars ?? []);
    const values = computed(() => stateManager.state.truthTable?.values ?? []);
    const minifiedValues = computed(() => state.value?.minifiedValues ?? []);
    const formulas = computed(() => state.value?.formulas ?? {});

    return { inputVars, outputVars, values, minifiedValues, formulas }
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

  static override createState(props: TruthTableProps) {
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
    stateManager.state.truthTable = {
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

registerProjectType('truth-table', {
  propsComponent: TruthTablePropsComponent,
  projectClass: TruthTableProject
});
