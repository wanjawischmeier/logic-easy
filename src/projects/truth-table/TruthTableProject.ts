import { createPanel } from "@/utility/dockview/integration";
import { Project, type BaseProjectProps } from "../Project";
import { stateManager } from "@/states/stateManager";
import type { TruthTableCell, TruthTableData } from "@/states/truthTableState";
import type { Formula } from "@/utility/types";
import { projectManager } from "@/projects/projectManager";

export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number;
  outputVariableCount: number;
}

export class TruthTableProject extends Project<TruthTableProps> {
  static override get defaultProps(): TruthTableProps {
    return {
      ...super.defaultProps,
      inputVariableCount: 2,
      outputVariableCount: 1,
    };
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

  create() {
    // Create project with callback to initialize state after it's opened
    projectManager.createProject(this.props.name, () => {
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
