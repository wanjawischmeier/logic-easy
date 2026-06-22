import { LCFile } from './LCFile'
import type { Element } from './Elements'
import {
  Formula as FormulaDefaults,
  type Formula,
  type FormulaVariation,
  type FunctionType,
  type Literal,
  type Term,
} from '@/utility/types.ts'

interface NormalizedFormula {
  terms: Term[]
  constant: boolean | null
}

function literalPortType(literal: Literal, invertLiteral: boolean = false): 'n' | 'i' {
  const directType: 'n' | 'i' = literal.negated ? 'i' : 'n'
  if (!invertLiteral) return directType
  return directType === 'n' ? 'i' : 'n'
}

function normalizeFormula(
  formula: Formula | undefined,
  functionType: FunctionType,
): NormalizedFormula {
  const terms = formula?.terms ?? []

  if (terms.length === 0) {
    return {
      terms: [],
      constant: functionType === 'Conjunctive',
    }
  }

  const normalizedTerms: Term[] = []

  for (const term of terms) {
    const seenVariables = new Map<string, boolean>()
    const normalizedLiterals: Literal[] = []
    let termAlwaysTrue = false
    let termAlwaysFalse = false

    for (const literal of term.literals ?? []) {
      const variable = literal.variable.toLowerCase()

      if (variable === '1') {
        if (functionType === 'Conjunctive') {
          termAlwaysTrue = true
          break
        }
        continue
      }

      if (variable === '0') {
        if (functionType === 'Disjunctive') {
          termAlwaysFalse = true
          break
        }
        continue
      }

      const previousNegation = seenVariables.get(variable)
      if (previousNegation !== undefined) {
        if (previousNegation !== literal.negated) {
          if (functionType === 'Disjunctive') termAlwaysFalse = true
          else termAlwaysTrue = true
          break
        }
        continue
      }

      seenVariables.set(variable, literal.negated)
      normalizedLiterals.push({
        variable,
        negated: literal.negated,
      })
    }

    if (termAlwaysTrue) {
      if (functionType === 'Disjunctive') {
        return {
          terms: [],
          constant: true,
        }
      }
      continue
    }

    if (termAlwaysFalse) {
      if (functionType === 'Conjunctive') {
        return {
          terms: [],
          constant: false,
        }
      }
      continue
    }

    if (normalizedLiterals.length === 0) {
      return {
        terms: [],
        constant: functionType === 'Disjunctive',
      }
    }

    normalizedTerms.push({ literals: normalizedLiterals })
  }

  if (normalizedTerms.length === 0) {
    return {
      terms: [],
      constant: functionType === 'Conjunctive',
    }
  }

  return {
    terms: normalizedTerms,
    constant: null,
  }
}

/**
 * builds a .lc file out of the minimized formulas of a truth table
 * @param rawFormulas
 * @param inputVars
 * @param outputVars
 * @param outType
 * @param firstLine optional lc header
 */
export function formulaToLC(
  formulas: Record<string, Formula>,
  inputVars: string[],
  outputVars: string[],
  outType: 'and-or' | 'nand' | 'nor' = 'and-or',
  firstLine: string | undefined = undefined,
  displayInputLabels?: string[],
  displayOutputLabels?: string[],
): LCFile {
  //create new lc File instance
  const lcFile = new LCFile(firstLine)

  //set spacing constants
  const termSpacing = 20
  const outputSpacing = 30 //min space between lamps
  let yOffset = 30 + LCFile.AND_SIZE //start all the logic below the lamps
  const xOffset = 0 //start all the logic a bit to the right

  //create buttons + labels for each input variable
  const buttonsByVar = new Map<string, Element>() //button map input variablename -> button element
  inputVars.forEach((v, i) => {
    const button = lcFile.createButton(xOffset + i * (termSpacing + LCFile.BUTTON_SIZE), 30, 1) // create button, rotated by 90°
    buttonsByVar.set(v, button) //add button to map by input variable name
    buttonsByVar.set(v.toLowerCase(), button)
    button.addText(displayInputLabels?.[i] ?? v, 0) //add text label above button
  })

  //build logic for each output variable
  const lampsByOutput = new Map<string, Element>() //lamp map output variablename -> lamp element
  outputVars.forEach((outputVar, outIdx) => {
    console.log('Processing output variable:', formulas[outputVar])
    const formulaType = (
      formulas[outputVar]?.type === 'Disjunctive' ? 'Disjunctive' : 'Conjunctive'
    ) as FunctionType
    const normalized = normalizeFormula(formulas[outputVar], formulaType)
    const terms = normalized.terms
    const termCount = Math.max(terms.length, 1)

    const rowY = (idx: number) => yOffset + idx * (LCFile.AND_SIZE + termSpacing) // calculate Y offset for this term

    // calculate position for OR gate of this output
    // should be centered relative to terms
    let orY: number
    if (terms.length === 0) {
      orY = yOffset
    } else if (terms.length % 2 === 1) {
      const mid = Math.floor(terms.length / 2)
      orY = rowY(mid)
    } else {
      const upperMid = terms.length / 2 - 1
      orY = rowY(upperMid) + LCFile.AND_SIZE / 2 + termSpacing / 2
    }

    // create lamp for this output, aligned with OR gate
    const lamp = lcFile.createLamp(xOffset + 650, orY + LCFile.LAMP_SIZE / 2, 0)
    lamp.addText(displayOutputLabels?.[outIdx] ?? outputVar, 1) //add text label right to the lamp
    lampsByOutput.set(outputVar, lamp) //set lamp to map by output variable name

    //special case: constant output for this formula
    if (normalized.constant === true) {
      lcFile
        .createHigh(lamp.xPOS - 100, lamp.yPOS)
        .getOutConnectors()[0]!
        .addTarget(lamp.getInConnectors()[0]!)
      yOffset += termSpacing + LCFile.LAMP_SIZE + outputSpacing
      return
    }

    if (normalized.constant === false) {
      lcFile
        .createLow(lamp.xPOS - 100, lamp.yPOS)
        .getOutConnectors()[0]!
        .addTarget(lamp.getInConnectors()[0]!)
      yOffset += termSpacing + LCFile.LAMP_SIZE + outputSpacing
      return
    }

    //create or gate only if there are multiple terms, otherwise there is no "aggregation" via or needed
    let termCollector: Element = lamp //holds either the OR gate or the lamp directly if only one term
    if (terms.length > 1) {
      let collectorGate: Element
      if (outType === 'and-or') {
        collectorGate = lcFile.createORGate(xOffset + 450, orY, 0, 'n'.repeat(terms.length), 'n')
        if (formulaType === 'Conjunctive')
          collectorGate = lcFile.createAndGate(xOffset + 450, orY, 0, 'n'.repeat(terms.length), 'n')
        collectorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
      } else if (outType === 'nand') {
        collectorGate = lcFile.createAndGate(xOffset + 450, orY, 0, 'n'.repeat(terms.length), 'i') //NAND gate
        if (formulaType === 'Conjunctive') {
          const negateNandGate = lcFile.createAndGate(xOffset + 550, orY, 0, 'nn', 'i')

          collectorGate.getOutConnectors()[0]!.addTarget(negateNandGate.getInConnectors()[0]!)
          collectorGate.getOutConnectors()[0]!.addTarget(negateNandGate.getInConnectors()[1]!)
          negateNandGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
        } else {
          collectorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
        }
      } else {
        //nor
        collectorGate = lcFile.createORGate(xOffset + 450, orY, 0, 'n'.repeat(terms.length), 'i') //NOR gate
        if (formulaType === 'Disjunctive') {
          //negate again
          const negateNorGate = lcFile.createORGate(xOffset + 550, orY, 0, 'nn', 'i')

          collectorGate.getOutConnectors()[0]!.addTarget(negateNorGate.getInConnectors()[0]!)
          collectorGate.getOutConnectors()[0]!.addTarget(negateNorGate.getInConnectors()[1]!)

          //directly connect negateNorGate to lamp
          negateNorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
        } else {
          collectorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
        }
      }

      termCollector = collectorGate
    }

    if (
      terms.length === 1 &&
      terms[0]!.literals.length > 1 &&
      ((outType === 'nand' && formulaType === 'Disjunctive') ||
        (outType === 'nor' && formulaType === 'Conjunctive'))
    ) {
      termCollector.setInPortAt(0, 'i')
    }

    //build logic for each term
    terms.forEach((term, termIndex) => {
      const currentRowY = rowY(termIndex)
      const termInputs = term.literals.map((lit) => (lit.negated ? 'i' : 'n')).join('')
      const termInputsNegated = term.literals.map((lit) => (lit.negated ? 'n' : 'i')).join('')

      let nextGate: Element = termCollector
      if (termInputs.length > 1) {
        //just create AND gate if there are multiple inputs
        if (outType === 'and-or') {
          //normal AND gate
          nextGate = lcFile.createAndGate(xOffset + 300, currentRowY, 0, termInputs, 'n')
          if (formulaType === 'Conjunctive')
            nextGate = lcFile.createORGate(xOffset + 300, currentRowY, 0, termInputs, 'n')
        } else if (outType === 'nand') {
          //NAND gate
          nextGate = lcFile.createAndGate(
            xOffset + 300,
            currentRowY,
            0,
            formulaType === 'Conjunctive' ? termInputsNegated : termInputs,
            'i',
          )
        } else {
          //NOR
          nextGate = lcFile.createORGate(
            xOffset + 300,
            currentRowY,
            0,
            formulaType === 'Conjunctive' ? termInputs : termInputsNegated,
            'i',
          )
        }

        nextGate.getOutConnectors()[0]!.addTarget(termCollector.getInConnectors()[termIndex]!) //connect AND output to OR input or directly to lamp
      } else if (termInputs.length === 1) {
        //if we land here, this is gonna be connected to the OR or LAMP directly, so we have to check if it needs to be negated
        if (outType === 'and-or') {
          nextGate.setInPortAt(termIndex, literalPortType(term.literals[0]!))
        } else if (outType === 'nand') {
          const invertLiteral = formulaType === 'Disjunctive' && termCollector !== lamp
          nextGate.setInPortAt(termIndex, literalPortType(term.literals[0]!, invertLiteral))
        } else {
          const invertLiteral = formulaType === 'Conjunctive' && termCollector !== lamp
          nextGate.setInPortAt(termIndex, literalPortType(term.literals[0]!, invertLiteral))
        }
      }

      //build connections from buttons to term inputs
      term.literals.forEach((literal, i) => {
        const button =
          buttonsByVar.get(literal.variable) ?? buttonsByVar.get(literal.variable.toLowerCase())
        if (!button) return //check for button

        //if no AND was created and the collector is an OR, target the OR input for this termIndex
        const targetIdx = !(termInputs.length > 1) && termCollector !== lamp ? termIndex : i

        //create connector node between button and input of AND/OR/lamp
        const connectorNode = lcFile.createNode(
          -5 + button.xPOS + LCFile.BUTTON_SIZE / 2,
          nextGate.yPOS + LCFile.AND_SIZE / nextGate.getInConnectors().length + targetIdx * 20,
        )

        connectorNode.addTarget(nextGate.getInConnectors()[targetIdx]!)
        button.getOutConnectors()[0]!.addTarget(connectorNode)
      })
    })

    //calculate y offset for next output
    yOffset += termCount * (LCFile.AND_SIZE + termSpacing) - termSpacing + outputSpacing
  })

  return lcFile
}

export function formulaToLcFile(
  projectName: string,
  formulas: Record<string, Formula>,
  inputVars: string[],
  outputVars: string[],
  minimizeForm: FunctionType = 'Disjunctive',
  outType: 'and-or' | 'nand' | 'nor' = 'and-or',
): void {
  const content: string = formulaToLC(formulas, inputVars, outputVars, outType).toString()

  const blob = new Blob([content], {
    type: 'text/lc',
  })

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    projectName.replace(/\s+/g, '_') + '_' + minimizeForm + '_' + outType + '.lc',
  )
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Builds canonical DNF/CNF formulas directly from a truth table's output columns.
 */
export function generateCanonicalFormulas(
  inputVars: string[],
  outputVars: string[],
  values: (number | string)[][],
  functionType: FunctionType,
): Record<string, Formula> {
  const canonicalFormulas: Record<string, Formula> = {}

  outputVars.forEach((outVar, outIdx) => {
    const terms: Term[] = []
    const isDNF = functionType === 'Disjunctive'
    const targetValue = isDNF ? 1 : 0

    values.forEach((row, rowIdx) => {
      if (row[outIdx] === targetValue) {
        const literals = inputVars.map((inVar, inIdx) => {
          // Find input bits using binary representation of row index
          const bitValue = (rowIdx >> (inputVars.length - 1 - inIdx)) & 1
          const negated = isDNF ? bitValue === 0 : bitValue === 1

          return { variable: inVar, negated }
        })
        terms.push({ literals })
      }
    })

    canonicalFormulas[outVar] = {
      type: functionType,
      terms,
    }
  })

  return canonicalFormulas
}

/**
 * Picks the user-selected minimization variation per output, falling back to the
 * default formula when none is selected.
 */
export function generateSelectedVariationFormulas(
  outputVars: string[],
  variations: Record<string, FormulaVariation[]> | undefined,
  variationIndex: Record<string, number> | number,
  formulas: Record<string, Formula>,
): Record<string, Formula> {
  const selectedIndexFor = (outputVar: string) =>
    typeof variationIndex === 'number' ? variationIndex : (variationIndex[outputVar] ?? 0)

  const selectedFormulas: Record<string, Formula> = {}

  outputVars.forEach((outputVar) => {
    const selectedVariation = variations?.[outputVar]?.[selectedIndexFor(outputVar)]
    selectedFormulas[outputVar] =
      selectedVariation?.formula ?? formulas[outputVar] ?? FormulaDefaults.empty
  })

  return selectedFormulas
}
