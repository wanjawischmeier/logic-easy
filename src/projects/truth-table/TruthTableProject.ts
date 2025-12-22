import { createPanel } from "@/utility/dockview/integration";
import type { BaseProjectProps, Project } from "../projectRegistry";
import { stateManager } from "@/states/stateManager";
import type { TruthTableCell, TruthTableData } from "@/states/truthTableState";
import type { Formula } from "@/utility/types";
import { projectManager } from "@/projects/projectManager";

export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export class TruthTableProject implements Project<TruthTableProps> {
  static defaultProps(): TruthTableProps {
    return {
      name: '',
      inputVariableCount: 2,
      outputVariableCount: 1,
    };
  }
  type = 'truth-table' as const;

  props: TruthTableProps;

  constructor(props: TruthTableProps) {
    this.props = props;
  }

  restoreDefaultPanelLayout(props: TruthTableProps) {
    createPanel('truth-table', 'Truth Table')

    // Add KV diagram if input count is between 2 and 4
    if (props.inputVariableCount >= 2 && props.inputVariableCount <= 4) {
      createPanel('kv-diagram', 'KV Diagram', {
        referencePanel: 'truth-table',
        direction: 'right'
      })
    }
  }

  create(props: TruthTableProps) {
    // Create project with callback to initialize state after it's opened
    projectManager.createProject(props.name, () => {
      // Generate variable names
      const inputVariables = Array.from({ length: props.inputVariableCount }, (_, i) => String.fromCharCode(97 + i))
      const outputVariables = Array.from({ length: props.outputVariableCount }, (_, i) => String.fromCharCode(112 + i))

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

      stateManager.state.truthTable = {
        inputVars: inputVariables,
        outputVars: outputVariables,
        formulas,
        values,
        minifiedValues: values,
      }
      stateManager.save()
    })
  }
}
