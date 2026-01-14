import { createPanel } from "@/utility/dockview/integration";
import { Project, type BaseProjectProps } from "../Project";
import TruthTablePropsComponent from "./TruthTablePropsComponent.vue";
import type { Formula, FunctionType } from "@/utility/types";
import { computed } from "vue";
import { stateManager, type AppState } from "@/projects/stateManager";
import { registerProjectType } from '@/projects/projectRegistry';
import type { QMCResult } from "@/utility/truthtable/minimizer";

export type TruthTableCell = 0 | 1 | '-';
export type TruthTableData = TruthTableCell[][];

// Default values for TruthTableProps
export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export interface TruthTableState {
  inputVars: string[];
  outputVars: string[];
  values: TruthTableData;
  formulas: Record<string, Record<FunctionType, Formula>>;
  outputVariableIndex: number;
  functionType: FunctionType;
  qmcResult?: QMCResult;
  couplingTermLatex?: string;
  selectedFormula?: Formula;
}

export class TruthTableProject extends Project {
  static override get defaultProps(): TruthTableProps {
    return {
      name: '',
      inputVariableCount: 4,
      outputVariableCount: 2,
    };
  }

  static override useState() {
    const state = computed(() => stateManager.state.truthTable);

    const inputVars = computed(() => state.value?.inputVars ?? []);
    const outputVars = computed(() => state.value?.outputVars ?? []);
    const values = computed(() => stateManager.state.truthTable?.values ?? []);
    const formulas = computed(() => state.value?.formulas ?? {});
    const outputVariableIndex = computed(() => state.value?.outputVariableIndex ?? 0);
    const functionType = computed(() => state.value?.functionType ?? 'DNF');
    const qmcResult = computed(() => state.value?.qmcResult);
    const couplingTermLatex = computed(() => state.value?.couplingTermLatex);
    const selectedFormula = computed(() => state.value?.selectedFormula);

    const outputVar = computed(() => state.value?.outputVars[state.value.outputVariableIndex])

    return {
      state,
      inputVars,
      outputVars,
      outputVar,
      values,
      formulas,
      outputVariableIndex,
      functionType,
      qmcResult,
      couplingTermLatex,
      selectedFormula
    }
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
      values: values,
      formulas: formulas,
      outputVariableIndex: 0,
      functionType: 'DNF',
    }

    console.log('[TruthTableProject.createState] State initialized:', {
      inputVars: inputVariables,
      outputVars: outputVariables,
      hasValues: !!values
    })
  }

  static override validateState(state: AppState): boolean {
    return state.truthTable != undefined;
  }

  static functionTypes = computed(() =>
    Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>)
  )
}

registerProjectType('truth-table', {
  name: 'Truth Table',
  propsComponent: TruthTablePropsComponent,
  projectClass: TruthTableProject
});
