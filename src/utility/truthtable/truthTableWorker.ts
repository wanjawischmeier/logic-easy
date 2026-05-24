import { Minimizer, type QMCResult } from './minimizer'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'
import type {
  Formula,
  FormulaVariationsMap,
  FunctionType,
  FunctionRepresentation,
} from '@/utility/types'
import {
  defaultColor,
  generateTermColor,
  mapFormulaTermsToPIColors,
  type TermColor,
} from './colorGenerator'
import { detectTautologyOrContradiction, flattenCouplingTermsToFormula } from './expressionParser'
import { getAlternativeMinimalForms } from './latexGenerator'
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
  formulaVariations: FormulaVariationsMap
  selectedFormula: Formula | undefined
}

/**
 * Creates a QMC result for edge cases (tautology/contradiction)
 */
function createEdgeCaseResult(
  type: 'tautology' | 'contradiction',
  functionType: FunctionType,
  functionRepresentation: FunctionRepresentation,
  inputVars: string[],
): { qmcResult: QMCResult; formula: Formula } {
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

  return { qmcResult, formula }
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

function buildVariationColors(
  formula: Formula,
  qmcResult: QMCResult | undefined,
  inputVars: string[],
): TermColor[] {
  if (!qmcResult?.pis?.length || !qmcResult.termColors?.length) {
    return formula.terms.length > 0 ? [defaultColor] : []
  }

  try {
    return mapFormulaTermsToPIColors(formula, qmcResult.pis, qmcResult.termColors, inputVars)
  } catch (error) {
    console.warn('[TruthTableWorker] Failed to map variation term colors:', error)
    return formula.terms.length > 0 ? [defaultColor] : []
  }
}

function buildFormulaVariationsMap(
  qmcResults: Record<string, QMCResult | undefined>,
  formulas: Record<string, Formula | undefined>,
  truthTable: TruthTableState,
): FormulaVariationsMap {
  const normal: Record<string, Formula> = {}
  const disjunctive: Record<
    string,
    { signature: string; variations: { formula: Formula; termColors: TermColor[] }[] }
  > = {}
  const conjunctive: Record<
    string,
    { signature: string; variations: { formula: Formula; termColors: TermColor[] }[] }
  > = {}

  for (const outputVar of truthTable.outputVars) {
    const qmcResult = qmcResults[outputVar]
    const baseFormula = formulas[outputVar]
    if (baseFormula) {
      normal[outputVar] = baseFormula
    }

    if (!qmcResult) continue

    const dnfForms = getAlternativeMinimalForms(
      qmcResult,
      'Disjunctive',
      truthTable.functionRepresentation,
      truthTable.inputVars,
      truthTable.values,
      truthTable.outputVars.indexOf(outputVar),
    )
    const cnfForms = getAlternativeMinimalForms(
      qmcResult,
      'Conjunctive',
      truthTable.functionRepresentation,
      truthTable.inputVars,
      truthTable.values,
      truthTable.outputVars.indexOf(outputVar),
    )

    disjunctive[outputVar] = {
      signature: dnfForms.signature,
      variations: dnfForms.formulas.map((formula) => ({
        formula,
        termColors: buildVariationColors(formula, qmcResult, truthTable.inputVars),
      })),
    }

    conjunctive[outputVar] = {
      signature: cnfForms.signature,
      variations: cnfForms.formulas.map((formula) => ({
        formula,
        termColors: buildVariationColors(formula, qmcResult, truthTable.inputVars),
      })),
    }
  }

  return { normal, disjunctive, conjunctive }
}

// Web Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, truthTable } = e.data
  if (!truthTable) return

  const currentOutputVar = truthTable.outputVars[truthTable.outputVariableIndex]
  if (!currentOutputVar) return

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

      for (const outputVar of truthTable.outputVars) {
        const outputIndex = truthTable.outputVars.indexOf(outputVar)
        const outputEdgeCase = detectTautologyOrContradiction(truthTable.values, outputIndex)

        if (outputEdgeCase !== null) {
          const edgeResult = createEdgeCaseResult(
            outputEdgeCase,
            truthTable.functionType,
            truthTable.functionRepresentation,
            truthTable.inputVars,
          )
          qmcResults[outputVar] = edgeResult.qmcResult
          formulas[outputVar] = edgeResult.formula
        } else {
          // This output variable is not an edge case, run QMC normally
          const result = await runMinimization(truthTable, outputIndex)
          qmcResults[outputVar] = result

          if (result && result.expressions && result.expressions.length > 0) {
            formulas[outputVar] = flattenCouplingTermsToFormula(
              result.expressions[0]!,
              truthTable.functionType,
            )
          } else {
            formulas[outputVar] = {
              type: truthTable.functionType,
              terms: [{ literals: [{ variable: '0', negated: false }] }],
            }
          }
        }
      }

      // Get the selected output variable's data
      const currentEdgeResult = createEdgeCaseResult(
        edgeCase,
        truthTable.functionType,
        truthTable.functionRepresentation,
        truthTable.inputVars,
      )

      const response: WorkerResponse = {
        id,
        qmcResults,
        formulas,
        formulaVariations: buildFormulaVariationsMap(qmcResults, formulas, truthTable),
        selectedFormula: currentEdgeResult.formula,
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

    for (const { outputVar, result } of qmcResultsArray) {
      qmcResults[outputVar] = result

      if (result && result.expressions && result.expressions.length > 0) {
        formulas[outputVar] = flattenCouplingTermsToFormula(
          result.expressions[0]!,
          truthTable.functionType,
        )
      } else {
        formulas[outputVar] = {
          type: truthTable.functionType,
          terms: [{ literals: [{ variable: '0', negated: false }] }],
        }
      }
    }

    // Get the selected output variable's data
    const currentQmcResult = qmcResults[currentOutputVar]
    let formulaVariations: FormulaVariationsMap = {
      normal: {},
      disjunctive: {},
      conjunctive: {},
    }
    let selectedFormula: Formula | undefined

    if (currentQmcResult) {
      formulaVariations = buildFormulaVariationsMap(qmcResults, formulas, truthTable)

      selectedFormula = formulas[currentOutputVar]
    }

    const response: WorkerResponse = {
      id,
      qmcResults,
      formulas,
      formulaVariations,
      selectedFormula,
    }

    self.postMessage(response)
  } catch (error) {
    console.error('[TruthTableWorker] Error processing request:', error)
    // Send back empty response on error
    const response: WorkerResponse = {
      id,
      qmcResults: {},
      formulas: {},
      formulaVariations: { normal: {}, disjunctive: {}, conjunctive: {} },
      selectedFormula: undefined,
    }
    self.postMessage(response)
  }
}
