import { createPanel } from "@/utility/dockview/integration";
import { Project, type BaseProjectProps, type BaseProjectState, type TruthTableData, type TruthTableCell } from "../Project";
import type { Formula, FunctionType } from "@/utility/types";
import { computed } from "vue";

export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export interface TruthTableState extends BaseProjectState {
  inputVars: string[];
  outputVars: string[];
  values: TruthTableData;
  minifiedValues: TruthTableData;
  formulas: Record<string, Record<string, Formula>>;
}

export class TruthTableProject extends Project<TruthTableProps, TruthTableState> {
  static override get defaultProps(): TruthTableProps {
    return {
      ...super.defaultProps,
      inputVariableCount: 2,
      outputVariableCount: 1,
    };
  }

  static override useState() {
    const state = computed(() => this.useProjectState<TruthTableProject>())
    const inputVars = computed(() => state.value?.inputVars || [])
    const outputVars = computed(() => state.value?.outputVars || [])
    const functionTypes = computed(() => Object.values({ DNF: 'DNF', CNF: 'CNF' } as Record<string, FunctionType>))

    console.log('[TruthTableProject.useState] Computed state:', {
      hasCurrentProject: !!TruthTableProject.currentProject,
      currentProjectState: TruthTableProject.currentProject?.state,
      stateValue: state.value,
      inputVarsValue: inputVars.value,
      outputVarsValue: outputVars.value
    })

    return { state, inputVars, outputVars, functionTypes }
  }

  constructor(props: TruthTableProps, state?: TruthTableState) {
    super(props, state);
  }

  restoreDefaultPanelLayout() {
    createPanel('truth-table', 'Truth Table')

    // Add KV diagram if input count is between 2 and 4
    if (this.props.inputVariableCount >= 2 && this.props.inputVariableCount <= 4) {
      createPanel('kv-diagram', 'KV Diagram', {
        referencePanel: 'truth-table',
        direction: 'right'
      })
    }
  }

  private generateVariableNames(count: number, startCharCode: number): string[] {
    return Array.from({ length: count }, (_, i) => String.fromCharCode(startCharCode + i))
  }

  async create() {
    console.log('[TruthTableProject.create] Initializing project state')

    // Generate variable names
    const inputVariables = this.generateVariableNames(this.props.inputVariableCount, 97)
    const outputVariables = this.generateVariableNames(this.props.outputVariableCount, 112)

    // create formulas
    const formulas: Record<string, Record<string, Formula>> = {}
    outputVariables.forEach((name) => {
      formulas[name] = {}
    })

    // number of rows = 2^n
    const rows = 1 << this.props.inputVariableCount

    // initialize all output values to zero
    const values = Array.from({ length: rows }, () =>
      Array.from({ length: this.props.outputVariableCount }, () => 0 as TruthTableCell)
    ) as TruthTableData

    // Initialize state
    if (!this.state) {
      this.state = {
        inputVars: inputVariables,
        outputVars: outputVariables,
        formulas,
        values,
        minifiedValues: values,
      } as any; // Type assertion needed due to reactive wrapping
    } else {
      Object.assign(this.state, {
        inputVars: inputVariables,
        outputVars: outputVariables,
        formulas,
        values,
        minifiedValues: values,
      });
    }

    console.log('[TruthTableProject.create] State initialized:', {
      inputVars: inputVariables,
      outputVars: outputVariables,
      hasValues: !!values
    })
  }
}
