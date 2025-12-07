import { stateManager } from './states/stateManager'
import { addPanel } from './dockviewIntegration'
import { Formula, type TruthTableCell, type TruthTableData } from './types'
import { projectManager } from './states/projectManager'

export function restoreDefaultPanelLayout(inputCount: number) {
  addPanel('truth-table', 'Truth Table')

  // Add KV diagram if input count is between 2 and 4
  if (inputCount >= 2 && inputCount <= 4) {
    addPanel('kv-diagram', 'KV Diagram', {
      referencePanel: 'truth-table',
      direction: 'right'
    })
  }
}

export function createTruthTableProject(
  projectName: string,
  inputCount: number,
  outputCount: number
) {
  // Create project
  projectManager.createProject(projectName)

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
}
