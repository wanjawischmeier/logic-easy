import { createPanel } from "@/utility/dockview/integration";
import type { BaseProjectProps, Project } from "../projectRegistry";
import { stateManager } from "@/states/stateManager";
import type { TruthTableCell, TruthTableData } from "@/states/truthTableState";
import type { Formula } from "@/utility/types";
import { projectManager } from "@/projects/projectManager";

export interface TruthTableProps extends BaseProjectProps {
  inputVars: string[];
  outputVars: string[];
}

export class TruthTableProject implements Project<TruthTableProps> {
  static defaultProps(): TruthTableProps {
    return {
      name: '',
      inputVars: Array.from({ length: 2 }, (_, i) => String.fromCharCode(97 + i)),
      outputVars: Array.from({ length: 1 }, (_, i) => String.fromCharCode(112 + i)),
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
    if (props.inputVars.length >= 2 && props.inputVars.length <= 4) {
      createPanel('kv-diagram', 'KV Diagram', {
        referencePanel: 'truth-table',
        direction: 'right'
      })
    }
  }

  create(props: TruthTableProps) {
    // Create project with callback to initialize state after it's opened
    projectManager.createProject(props.name, () => {
      // Use the input and output variable names from props
      const inputVars = props.inputVars;
      const outputVars = props.outputVars;

      // create formulas
      const formulas: Record<string, Record<string, Formula>> = {}
      outputVars.forEach((name) => {
        formulas[name] = {}
      })

      // number of rows = 2^n
      const rows = 1 << props.inputVars.length

      // initialize all output values to zero
      const values = Array.from({ length: rows }, () =>
        Array.from({ length: props.outputVars.length }, () => 0 as TruthTableCell)
      ) as TruthTableData

      stateManager.state.truthTable = {
        inputVars,
        outputVars,
        formulas,
        values,
        minifiedValues: values,
      }
      stateManager.save()
    })
  }
}
