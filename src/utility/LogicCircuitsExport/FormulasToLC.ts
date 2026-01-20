import { LCFile } from './LCFile'
import type { Element } from './Elements'
import type { Formula } from '@/utility/types.ts'

/**
 * builds a .lc file out of the minimized formulas of a truth table
 * @param rawFormulas
 * @param inputVars
 * @param outputVars
 * @param minimizeForm
 * @param outType
 */
export function formulaToLC(
  formulas: Record<string, Formula>,
  inputVars: string[],
  outputVars: string[],
  minimizeForm: 'dnf' | 'cnf' = 'dnf',
  outType: 'and-or' | 'nand' | 'nor' = 'and-or',
): LCFile {
  //create new lc File instance
  const lcFile = new LCFile()

  //set spacing constants
  const termSpacing = 20
  const outputSpacing = 30 //min space between lamps
  let yOffset = 30 + LCFile.AND_SIZE //start all the logic below the lamps

  //create buttons + labels for each input variable
  const buttonsByVar = new Map<string, Element>() //button map input variablename -> button element
  inputVars.forEach((v, i) => {
    const button = lcFile.createButton(i * (termSpacing + LCFile.BUTTON_SIZE), 30, 1) // create button, rotated by 90°
    buttonsByVar.set(v, button) //add button to map by input variable name
    button.addText(v, 0) //add text label above button
  })

  //build logic for each output variable
  const lampsByOutput = new Map<string, Element>() //lamp map output variablename -> lamp element
  outputVars.forEach((outputVar) => {
    const allTerms = formulas[outputVar]?.terms ?? [] //get all terms for current output var
    const terms = allTerms.filter((t) => t.literals[0] && t.literals[0].variable !== '0') //filter out 0 values, keep just normal vars
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
    const lamp = lcFile.createLamp(650, orY + LCFile.OR_SIZE / 2 + LCFile.LAMP_SIZE / 2, 0)
    lamp.addText(outputVar, 1) //add text label right to the lamp
    lampsByOutput.set(outputVar, lamp) //sadd lamp to map by output variable name

    //special case: always true for this output
    if (terms.length === 1 && terms[0]!.literals.length === 1) {
      //output always true
      lcFile
        .createHigh(lamp.xPOS - 100, lamp.yPOS)
        .getOutConnectors()[0]!
        .addTarget(lamp.getInConnectors()[0]!)
      yOffset += termSpacing + LCFile.LAMP_SIZE + outputSpacing
      return
    }

    //special case: always false for this output
    if (terms.length === 0) {
      //output always false
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
        collectorGate = lcFile.createORGate(450, orY, 0, 'n'.repeat(terms.length), 'n')
      } else if (outType === 'nand') {
        collectorGate = lcFile.createAndGate(450, orY, 0, 'n'.repeat(terms.length), 'i') //NAND gate
      } else {
        //nor
        collectorGate = lcFile.createORGate(450, orY, 0, 'n'.repeat(terms.length), 'i') //NOR gate
        //negate again
        const negateNorGate = lcFile.createORGate(550, orY, 0, 'nn', 'i')

        collectorGate.getOutConnectors()[0]!.addTarget(negateNorGate.getInConnectors()[0]!)
        collectorGate.getOutConnectors()[0]!.addTarget(negateNorGate.getInConnectors()[1]!)

        //directly connect negateNorGate to lamp
        negateNorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
      }

      if (outType !== 'nor')
        collectorGate.getOutConnectors()[0]!.addTarget(lamp.getInConnectors()[0]!)
      termCollector = collectorGate
    }

    if (terms.length === 1 && outType === 'nand') {
      //special case: single term with NAND output needs to be inverted
      termCollector.setInPortAt(0, 'i') //invert input
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
          nextGate = lcFile.createAndGate(300, currentRowY, 0, termInputs, 'n')
        } else if (outType === 'nand') {
          //NAND gate
          nextGate = lcFile.createAndGate(300, currentRowY, 0, termInputs, 'i')
        } else {
          //NOR
          nextGate = lcFile.createORGate(300, currentRowY, 0, termInputsNegated, 'i')
        }

        nextGate.getOutConnectors()[0]!.addTarget(termCollector.getInConnectors()[termIndex]!) //connect AND output to OR input or directly to lamp
      } else if (termInputs.length === 1) {
        //if we land here, this is gonna be connected to the OR or LAMP directly, so we have to check if it needs to be negated
        if (outType === 'and-or') {
          nextGate.setInPortAt(termIndex, term.literals[0]!.negated ? 'i' : 'n')
        } else if (outType === 'nand') {
          nextGate.setInPortAt(termIndex, term.literals[0]!.negated ? 'n' : 'i') //inverted if NAND
        } else {
          nextGate.setInPortAt(termIndex, term.literals[0]!.negated ? 'i' : 'n')
        }
      }

      //build connections from buttons to term inputs
      term.literals.forEach((literal, i) => {
        const button = buttonsByVar.get(literal.variable)
        if (!button) return //check for button

        //create connector node between button and input of AND/OR/lamp
        const connectorNode = lcFile.createNode(
          -5 + button.xPOS + LCFile.BUTTON_SIZE / 2,
          nextGate.yPOS + LCFile.AND_SIZE / term.literals.length + i * 20,
        )

        //if no AND was created and the collector is an OR, target the OR input for this termIndex
        const targetIdx = !(termInputs.length > 1) && termCollector !== lamp ? termIndex : i

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
  minimizeForm: 'dnf' | 'cnf' = 'dnf',
  outType: 'and-or' | 'nand' | 'nor' = 'and-or',
): void {
  const content: string = formulaToLC(
    formulas,
    inputVars,
    outputVars,
    minimizeForm,
    outType,
  ).toString()

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
