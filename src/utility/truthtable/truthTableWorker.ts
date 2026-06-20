import { Minimizer, type QMCResult } from './minimizer'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type {
  FunctionType,
  Formula,
  FunctionRepresentation,
  FormulaVariation,
} from '@/utility/types'
import {
  defaultColor,
  generateTermColor,
  mapFormulaTermsToPIColors,
  type TermColor,
} from './colorGenerator'
import { detectTautologyOrContradiction, flattenCouplingTermsToFormula } from './expressionParser'
import { getFunctionSignature, getCouplingTermLatex } from './latexGenerator'
import type { Operation } from 'logi.js'

// Message types for worker communication
export interface WorkerRequest {
  id: number
  truthTable: TruthTableState
  previous?: WorkerCacheSnapshot
}

export interface WorkerResponse {
  id: number
  qmcResults: Record<string, QMCResult | undefined>
  formulas: Record<string, Formula | undefined>
  couplingTermLatex: string | undefined
  selectedFormula: Formula | undefined
  formulaTermColors: TermColor[] | undefined
  variations?: Record<string, FormulaVariation[]>
}

export interface WorkerCacheSnapshot {
  truthTable: Pick<TruthTableState, 'inputVars' | 'outputVars' | 'values' | 'functionType'>
  qmcResults: Record<string, QMCResult | undefined>
}

export interface EdgeCaseResult {
  qmcResult: QMCResult
  formula: Formula
  couplingTermLatex: string
}

/**
 * Compute formula variations from QMC result expressions
 */
function computeVariations(
  qmcResult: QMCResult,
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  outputVariableName: string,
  truthTableValues?: TruthTableState['values'],
  outputVariableIndex?: number,
  labelMap?: Record<string, string>,
): FormulaVariation[] {
  if (!qmcResult.expressions || qmcResult.expressions.length === 0) {
    return []
  }

  return qmcResult.expressions.map((expr) => {
    // Convert expression to formula
    const formula = flattenCouplingTermsToFormula(expr as Operation, functionType)

    // Create a single-expression QMCResult for latex generation
    const singleExprResult: QMCResult = {
      ...qmcResult,
      expressions: [expr],
    }

    // Generate latex using the signature + expression latex
    const latex = getCouplingTermLatex(
      singleExprResult,
      functionType,
      functionRepresentation,
      inputVars,
      outputVariableName,
      truthTableValues,
      outputVariableIndex,
      { labelMap },
    )

    return {
      formula,
      latex,
    }
  })
}

/**
 * Creates a QMC result for edge cases (tautology/contradiction)
 */
function createEdgeCaseResult(
  type: 'tautology' | 'contradiction',
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
  outputVariableName: string,
): EdgeCaseResult {
  const signature = getFunctionSignature(
    functionType,
    functionRepresentation,
    inputVars,
    outputVariableName,
  )

  let constant: '0' | '1'

  if (type === 'tautology') {
    // Tautology: all 1s/don't cares
    // DNF: f = 1
    // CNF: f = 1
    constant = '1'
  } else {
    // Contradiction: all 0s/don't cares
    // DNF: f = 0
    // CNF: f = 0
    constant = '0'
  }

  const formula: Formula = {
    type: functionType,
    terms: [{ literals: [{ variable: constant, negated: false }] }],
  }

  const qmcResult: QMCResult = {
    iterations: [],
    minterms: [],
    pis: [],
    chart: null,
    expressions: [{ name: constant } as unknown as Operation],
    termColors: [defaultColor],
  }

  const couplingTermLatex = signature + constant

  return { qmcResult, formula, couplingTermLatex }
}

async function runMinimization(
  truthTable: TruthTableState,
  index: number,
): Promise<QMCResult | undefined> {
  // Create a modified truth table state for this output variable
  const modifiedTruthTable = {
    ...truthTable,
    outputVariableIndex: index,
  }

  return await Minimizer.runQMC(modifiedTruthTable)
}

function getVariationIndex(truthTable: TruthTableState, outputVar: string): number {
  const variationIndex = truthTable.variationIndex as Record<string, number> | number
  if (typeof variationIndex === 'number') return variationIndex
  return variationIndex[outputVar] ?? 0
}

function mapResultColors(
  truthTable: TruthTableState,
  result: QMCResult,
  previousResult?: QMCResult,
): TermColor[] {
  // Generate colors for each prime implicant based on their term string
  // This ensures consistent coloring between QMC chart and KV diagram
  // Preserve existing colors by matching PI term strings for temporal consistency

  // Get existing QMC result for this output variable to preserve colors
  const existingQmcResult = previousResult ?? truthTable.qmcResult
  const existingPIs = existingQmcResult?.pis || []
  const existingColors = existingQmcResult?.termColors || []

  // Build a map of term string -> color from existing results
  const termColorMap = new Map<string, TermColor>()

  existingPIs.forEach((pi, idx: number) => {
    const color = existingColors[idx]
    if (pi.term && color) {
      termColorMap.set(pi.term, color)
    }
  })

  // Accumulate all colors as we generate new ones
  const allColors = Array.from(termColorMap.values())

  return result.pis.map((pi) => {
    // Try to reuse color for this term string if it existed before
    const existingColor = termColorMap.get(pi.term)
    if (existingColor) {
      return existingColor
    }

    // Generate a new color that's maximally different from all colors (including newly generated ones)
    const newColor = generateTermColor(allColors)
    allColors.push(newColor) // Add to accumulator for next iteration
    return newColor
  })
}

function shouldUseGenericFormulaColors(truthTable: TruthTableState): boolean {
  return truthTable.fsmMode !== true
}

function arraysEqual<T>(left: T[] | undefined, right: T[] | undefined): boolean {
  if (left === right) return true
  if (!left || !right || left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function minimizationContextMatches(
  truthTable: TruthTableState,
  previous?: WorkerCacheSnapshot,
): previous is WorkerCacheSnapshot {
  if (!previous) return false

  return (
    previous.truthTable.functionType === truthTable.functionType &&
    arraysEqual(previous.truthTable.inputVars, truthTable.inputVars) &&
    arraysEqual(previous.truthTable.outputVars, truthTable.outputVars) &&
    previous.truthTable.values.length === truthTable.values.length
  )
}

function outputColumnChanged(
  values: TruthTableState['values'],
  previousValues: TruthTableState['values'],
  outputIndex: number,
): boolean {
  if (values.length !== previousValues.length) return true

  return values.some(
    (row, rowIndex) => row[outputIndex] !== previousValues[rowIndex]?.[outputIndex],
  )
}

function fallbackFormula(functionType: FunctionType): Formula {
  return {
    type: functionType,
    terms: [{ literals: [{ variable: '0', negated: false }] }],
  }
}

// Web Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, truthTable, previous } = e.data
  if (!truthTable) return

  const currentOutputVar = truthTable.outputVars[truthTable.outputVariableIndex]
  if (!currentOutputVar) return

  // Display-only substitution: use labels where provided, internal names for computation
  const displayInputVars = truthTable.inputVarLabels ?? truthTable.inputVars
  const displayOutputVars = truthTable.outputVarLabels ?? truthTable.outputVars
  const currentOutputName = displayOutputVars[truthTable.outputVariableIndex] ?? currentOutputVar
  const labelMap: Record<string, string> | undefined = truthTable.inputVarLabels
    ? Object.fromEntries(
        truthTable.inputVars.map((v, i) => [v, truthTable.inputVarLabels![i] ?? v]),
      )
    : undefined

  console.log('[TruthTableWorker] Processing request:', id)

  try {
    const canReusePrevious = minimizationContextMatches(truthTable, previous)
    const outputsToMinimize: string[] = []

    const qmcPromises = truthTable.outputVars.map(async (outputVar, index) => {
      const previousResult = previous?.qmcResults[outputVar]
      const canReuseOutput =
        canReusePrevious &&
        previousResult !== undefined &&
        !outputColumnChanged(truthTable.values, previous.truthTable.values, index)

      if (canReuseOutput) {
        return { outputVar, index, result: previousResult }
      }

      const edgeCase = detectTautologyOrContradiction(truthTable.values, index)
      if (edgeCase !== null) {
        const outputVariableName = displayOutputVars[index] ?? outputVar
        const edgeResult = createEdgeCaseResult(
          edgeCase,
          truthTable.functionType,
          truthTable.functionRepresentation,
          displayInputVars,
          outputVariableName,
        )
        return { outputVar, index, result: edgeResult.qmcResult }
      }

      outputsToMinimize.push(outputVar)
      const result = await runMinimization(truthTable, index)
      if (!result || !result.pis) {
        return { outputVar, index, result }
      }

      result.termColors = mapResultColors(truthTable, result, previousResult)
      return { outputVar, index, result }
    })

    console.log('[TruthTableWorker] Running minimization for output vars:', outputsToMinimize)
    const qmcResultsArray = await Promise.all(qmcPromises)

    // Build records from results
    const qmcResults: Record<string, QMCResult | undefined> = {}
    const formulas: Record<string, Formula | undefined> = {}
    const variationsRecord: Record<string, FormulaVariation[]> = {}

    for (const { outputVar, index, result } of qmcResultsArray) {
      qmcResults[outputVar] = result

      if (result && result.expressions && result.expressions.length > 0) {
        formulas[outputVar] = flattenCouplingTermsToFormula(
          result.expressions[0]!,
          truthTable.functionType,
        )
        // Compute variations for this output variable
        variationsRecord[outputVar] = computeVariations(
          result,
          truthTable.functionType,
          truthTable.functionRepresentation,
          displayInputVars,
          displayOutputVars[index] ?? outputVar,
          truthTable.values,
          index,
          labelMap,
        )
      } else {
        formulas[outputVar] = fallbackFormula(truthTable.functionType)
        variationsRecord[outputVar] = []
      }
    }

    // Get the selected output variable's data
    const currentQmcResult = qmcResults[currentOutputVar]
    let couplingTermLatex: string | undefined
    let selectedFormula: Formula | undefined
    let formulaTermColors: TermColor[] | undefined

    if (currentQmcResult) {
      couplingTermLatex = getCouplingTermLatex(
        currentQmcResult,
        truthTable.functionType,
        truthTable.functionRepresentation,
        displayInputVars,
        currentOutputName,
        truthTable.values,
        truthTable.outputVariableIndex,
        { labelMap },
      )
      const variations = variationsRecord[currentOutputVar]
      if (variations) {
        selectedFormula = variations[getVariationIndex(truthTable, currentOutputVar)]?.formula
      }

      // Map formula terms to prime implicant colors
      if (
        selectedFormula &&
        currentQmcResult.pis &&
        currentQmcResult.termColors &&
        shouldUseGenericFormulaColors(truthTable)
      ) {
        formulaTermColors = mapFormulaTermsToPIColors(
          selectedFormula,
          currentQmcResult.pis,
          currentQmcResult.termColors,
          truthTable.inputVars,
        )
      }
    }

    const response: WorkerResponse = {
      id,
      qmcResults,
      formulas,
      couplingTermLatex,
      selectedFormula,
      formulaTermColors: shouldUseGenericFormulaColors(truthTable) ? formulaTermColors : undefined,
      variations: variationsRecord,
    }

    self.postMessage(response)
  } catch (error) {
    console.error('[TruthTableWorker] Error processing request:', error)
    // Send back empty response on error
    const response: WorkerResponse = {
      id,
      qmcResults: {},
      formulas: {},
      couplingTermLatex: undefined,
      selectedFormula: undefined,
      formulaTermColors: undefined,
    }
    self.postMessage(response)
  }
}
