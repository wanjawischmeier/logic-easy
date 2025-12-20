import type { TruthTableCell, TruthTableData } from '@/states/truthTableState'
import { stateManager } from '../../states/stateManager'
import { createPanel } from '../../utility/dockviewIntegration'
import { Formula } from '../../utility/types'
import { projectManager } from '../projectManager'

/**
 * Adds the truth table panel and a KV panel to the right if the variable count matches
 * @param inputCount Number of input variables
 */
export function restoreDefaultPanelLayout(inputCount: number) {
  createPanel('truth-table', 'Truth Table')

  // Add KV diagram if input count is between 2 and 4
  if (inputCount >= 2 && inputCount <= 4) {
    createPanel('kv-diagram', 'KV Diagram', {
      referencePanel: 'truth-table',
      direction: 'right'
    })
  }
}

/**
 * Creates the truth table state for a truth table project and registers it with the project manager.
 * @param projectName The name of the project.
 * @param inputCount The number of input variables.
 * @param outputCount The number of output variables.
 */
export function createTruthTableProject(
  projectName: string,
  inputCount: number,
  outputCount: number
) {
  // Create project with callback to initialize state after it's opened
  projectManager.createProject(projectName, () => {
    // input names: a, b, c, ...
    const inputVars = Array.from({ length: inputCount }, (_, i) =>
      String.fromCharCode(97 + i)
    )

    // output names: p, q, r, ...
    const outputVars = Array.from({ length: outputCount }, (_, i) =>
      String.fromCharCode(112 + i)
    )

    // create formulas
    const formulas: Record<string, Record<string, Formula>> = {}
    outputVars.forEach((name) => {
      formulas[name] = {}
    })

    // number of rows = 2^n
    const rows = 1 << inputCount

    // initialize all output values to zero
    const values = Array.from({ length: rows }, () =>
      Array.from({ length: outputCount }, () => 0 as TruthTableCell)
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
