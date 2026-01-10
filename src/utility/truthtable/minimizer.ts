import type { TruthTableData, TruthTableState } from "@/projects/truth-table/TruthTableProject"
import type { FunctionType } from '@/utility/types'
import { QMC, type Operation, type QMCDetailedExpressionsObjects } from "logi.js"

export interface QMCResult {
    iterations: any[]
    minterms: number[]
    pis: any[]
    chart: Record<number, string[]> | null
    expressions: Operation[]
}

export class Minimizer {
    static get emptyQMQResult(): QMCResult {
        return {
            iterations: [],
            minterms: [],
            pis: [],
            chart: [],
            expressions: []
        }
    }

    // Calculate minterms or maxterms from truth table values
    static calculateMinMaxTerms(values: TruthTableData, outputIndex: number, functionType: FunctionType): number[] {
        const mt: number[] = []
        const isDMF = functionType === 'DNF'

        values.forEach((row, rowIndex) => {
            const outputCell = row[outputIndex] // Row contains only output values

            // For DMF: collect minterms (where output is 1)
            // For CMF: collect maxterms (where output is 0)
            if ((isDMF && outputCell === 1) || (!isDMF && outputCell === 0)) {
                mt.push(rowIndex)
            }
        })

        return mt
    }

    // Apply De Morgan's law to convert DNF to CNF
    static applyDeMorgan(op: Operation): Operation {
        // If it's a VAR, negate it
        if ((op as any).name !== undefined) {
            return { priority: 15, args: [op] } as unknown as Operation
        }

        // If it's a NOT, remove the negation (double negative)
        if ((op as any).priority === 15) {
            return (op as any).args[0]
        }

        // If it's an AND, convert to OR and negate each arg
        if ((op as any).priority === 8) {
            const args = (op as any).args as Operation[]
            const negatedArgs = args.map(arg => this.applyDeMorgan(arg))
            return { priority: 6, args: negatedArgs } as unknown as Operation
        }

        // If it's an OR, convert to AND and negate each arg
        if ((op as any).priority === 6) {
            const args = (op as any).args as Operation[]
            const negatedArgs = args.map(arg => this.applyDeMorgan(arg))
            return { priority: 8, args: negatedArgs } as unknown as Operation
        }

        return op
    }

    // Run QMC when data changes
    static runQMC(truthTable: TruthTableState): QMCResult | undefined {
        console.log('=== runQMC called ===')
        console.log('props.values:', truthTable.values)
        console.log('props.selectedOutputIndex:', truthTable.outputVariableIndex)
        console.log('props.outputVars:', truthTable.outputVars)

        if (truthTable.values.length === 0) {
            console.log('No values, returning')
            return
        }
        if (truthTable.outputVariableIndex >= truthTable.outputVars.length) {
            console.log('Invalid output index, returning')
            return
        }

        const qmc = new QMC()
        const mt = this.calculateMinMaxTerms(
            truthTable.values,
            truthTable.outputVariableIndex,
            truthTable.functionType
        )
        const dc: number[] = [] // Don't cares - could be extended later

        console.log('Calculated minterms:', mt)

        if (mt.length === 0) {
            console.log('No minterms - clearing display')
            // No minterms - clear the display
            return this.emptyQMQResult
        }

        console.log('Running QMC with minterms:', mt)
        const detailedResult = qmc.solve(mt, dc, true, true) as QMCDetailedExpressionsObjects
        const d = detailedResult.details
        if (!d) {
            console.log('No details from QMC')
            return
        }

        console.log('QMC result:', detailedResult)
        const sortedMinterms = (d.minterms || []).slice().sort((a: number, b: number) => a - b)

        return {
            iterations: d.iterations,
            minterms: sortedMinterms,
            pis: d.primeImplicants,
            chart: d.chart,
            expressions: truthTable.functionType === 'CNF'
                ? detailedResult.expressions.map(expr => this.applyDeMorgan(expr))
                : detailedResult.expressions
        }
    }
}