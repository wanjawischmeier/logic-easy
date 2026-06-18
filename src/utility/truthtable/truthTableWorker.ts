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
): EdgeCaseResult {
  const signature = getFunctionSignature(functionType, functionRepresentation, inputVars)

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

function mapResultColors(truthTable: TruthTableState, result: QMCResult): TermColor[] {
  // Generate colors for each prime implicant based on their term string
  // This ensures consistent coloring between QMC chart and KV diagram
  // Preserve existing colors by matching PI term strings for temporal consistency

  // Get existing QMC result for this output variable to preserve colors
  const existingQmcResult = truthTable.qmcResult
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

// Web Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, truthTable } = e.data
  if (!truthTable) return

  const currentOutputVar = truthTable.outputVars[truthTable.outputVariableIndex]
  if (!currentOutputVar) return

  // Display-only substitution: use labels where provided, internal names for computation
  const displayInputVars = truthTable.inputVarLabels ?? truthTable.inputVars
  const labelMap: Record<string, string> | undefined = truthTable.inputVarLabels
    ? Object.fromEntries(
        truthTable.inputVars.map((v, i) => [v, truthTable.inputVarLabels![i] ?? v]),
      )
    : undefined

  console.log('[TruthTableWorker] Processing request:', id)

  try {
    // Early detection of tautology/contradiction for current output variable
    const edgeCase = detectTautologyOrContradiction(
      truthTable.values,
      truthTable.outputVariableIndex,
    )

    if (edgeCase !== null) {
      console.log('[TruthTableWorker] Detected edge case:', edgeCase)

      // Create edge case results for all output variables
      const qmcResults: Record<string, QMCResult | undefined> = {}
      const formulas: Record<string, Formula | undefined> = {}
      const variationsRecord: Record<string, FormulaVariation[]> = {}

      for (const outputVar of truthTable.outputVars) {
        const outputIndex = truthTable.outputVars.indexOf(outputVar)
        const outputEdgeCase = detectTautologyOrContradiction(truthTable.values, outputIndex)

        if (outputEdgeCase !== null) {
          const edgeResult = createEdgeCaseResult(
            outputEdgeCase,
            truthTable.functionType,
            truthTable.functionRepresentation,
            displayInputVars,
          )
          qmcResults[outputVar] = edgeResult.qmcResult
          formulas[outputVar] = edgeResult.formula
          variationsRecord[outputVar] = [
            {
              formula: edgeResult.formula,
              latex: edgeResult.couplingTermLatex,
            },
          ]
        } else {
          // This output variable is not an edge case, run QMC normally
          const result = await runMinimization(truthTable, outputIndex)
          qmcResults[outputVar] = result

          if (result && result.expressions && result.expressions.length > 0) {
            formulas[outputVar] = flattenCouplingTermsToFormula(
              result.expressions[0]!,
              truthTable.functionType,
            )
            variationsRecord[outputVar] = computeVariations(
              result,
              truthTable.functionType,
              truthTable.functionRepresentation,
              displayInputVars,
              undefined,
              undefined,
              labelMap,
            )
          } else {
            formulas[outputVar] = {
              type: truthTable.functionType,
              terms: [{ literals: [{ variable: '0', negated: false }] }],
            }
            variationsRecord[outputVar] = []
          }
        }
      }

      // Get the selected output variable's data
      const currentEdgeResult = createEdgeCaseResult(
        edgeCase,
        truthTable.functionType,
        truthTable.functionRepresentation,
        displayInputVars,
      )

      const response: WorkerResponse = {
        id,
        qmcResults,
        formulas,
        couplingTermLatex: currentEdgeResult.couplingTermLatex,
        selectedFormula: currentEdgeResult.formula,
        formulaTermColors: shouldUseGenericFormulaColors(truthTable)
          ? currentEdgeResult.qmcResult.termColors
          : undefined,
        variations: variationsRecord,
      }

      self.postMessage(response)
      return
    }

    // Process all output variables in parallel
    const qmcPromises = truthTable.outputVars.map(async (outputVar, index) => {
      const result = await runMinimization(truthTable, index)
      if (!result || !result.pis) {
        return { outputVar, result }
      }

      result.termColors = mapResultColors(truthTable, result)
      return { outputVar, result }
    })

    const qmcResultsArray = await Promise.all(qmcPromises)

    // Build records from results
    const qmcResults: Record<string, QMCResult | undefined> = {}
    const formulas: Record<string, Formula | undefined> = {}
    const variationsRecord: Record<string, FormulaVariation[]> = {}

    for (const { outputVar, result } of qmcResultsArray) {
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
          truthTable.values,
          truthTable.outputVariableIndex,
          labelMap,
        )
      } else {
        formulas[outputVar] = {
          type: truthTable.functionType,
          terms: [{ literals: [{ variable: '0', negated: false }] }],
        }
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
