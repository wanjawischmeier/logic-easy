<template>
    <div class="h-full text-on-surface flex flex-col p-2 overflow-auto">
        <div class="flex flex-wrap justify-center gap-12">
            <QMCGroupingTable :iterations="iterations" :prime-implicants="pis" />
            <QMCPrimeImplicantChart :minterms="minterms" :prime-implicants="pis" :chart="chart"
                :input-vars="inputVars" />
            <FormulaRenderer :latex-expression="formulaLatex" v-if="formulaLatex"></FormulaRenderer>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { QMC, type QMCDetailedExpressionsObjects } from 'logi.js'
import type { Operation } from 'logi.js'
import QMCGroupingTable from './parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from './parts/QMCPrimeImplicantChart.vue'
import FormulaRenderer from './FormulaRenderer.vue'
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject'

interface Props {
    inputVars: string[]
    outputVars: string[]
    values: TruthTableData
    selectedOutputIndex?: number
    functionType?: string
}

const props = withDefaults(defineProps<Props>(), {
    selectedOutputIndex: 0,
    functionType: 'DNF'
})

const iterations = ref<any[]>([])
const minterms = ref<number[]>([])
const pis = ref<any[]>([])
const chart = ref<Record<number, string[]> | null>(null)
const expressions = ref<Operation[]>([])

// Calculate minterms or maxterms from truth table values
function calculateMinMaxTerms(values: TruthTableData, outputIndex: number): number[] {
    const mt: number[] = []
    const isDMF = props.functionType === 'DNF'

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
function applyDeMorgan(op: Operation): Operation {
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
        const negatedArgs = args.map(arg => applyDeMorgan(arg))
        return { priority: 6, args: negatedArgs } as unknown as Operation
    }

    // If it's an OR, convert to AND and negate each arg
    if ((op as any).priority === 6) {
        const args = (op as any).args as Operation[]
        const negatedArgs = args.map(arg => applyDeMorgan(arg))
        return { priority: 8, args: negatedArgs } as unknown as Operation
    }

    return op
}

// Run QMC when data changes
function runQMC() {
    console.log('=== runQMC called ===')
    console.log('props.values:', props.values)
    console.log('props.selectedOutputIndex:', props.selectedOutputIndex)
    console.log('props.outputVars:', props.outputVars)

    if (!props.values || props.values.length === 0) {
        console.log('No values, returning')
        return
    }
    if (props.selectedOutputIndex >= props.outputVars.length) {
        console.log('Invalid output index, returning')
        return
    }

    const qmc = new QMC()
    const mt = calculateMinMaxTerms(props.values, props.selectedOutputIndex)
    const dc: number[] = [] // Don't cares - could be extended later

    console.log('Calculated minterms:', mt)

    if (mt.length === 0) {
        console.log('No minterms - clearing display')
        // No minterms - clear the display
        iterations.value = []
        minterms.value = []
        pis.value = []
        chart.value = {}
        expressions.value = []
        return
    }

    console.log('Running QMC with minterms:', mt)
    const detailedResult = qmc.solve(mt, dc, true, true) as QMCDetailedExpressionsObjects
    const d = detailedResult.details
    if (!d) {
        console.log('No details from QMC')
        return
    }

    console.log('QMC result:', detailedResult)

    iterations.value = d.iterations
    const sortedMinterms = (d.minterms || []).slice().sort((a: number, b: number) => a - b)
    minterms.value = sortedMinterms
    pis.value = d.primeImplicants || []
    chart.value = d.chart || {}

    // Get the minimized expressions
    // For CNF: QMC returns DNF of complement, so apply De Morgan's law
    if (props.functionType === 'CNF') {
        expressions.value = detailedResult.expressions.map(expr => applyDeMorgan(expr))
        console.log('Applied De Morgan\'s law for CNF')
    } else {
        expressions.value = detailedResult.expressions
    }

    console.log('Set iterations:', iterations.value)
    console.log('Set pis:', pis.value)
    console.log('Set chart:', chart.value)
}

// Watch for changes in input data
watch(() => [props.values, props.selectedOutputIndex, props.inputVars, props.outputVars, props.functionType], () => {
    runQMC()
}, { immediate: true, deep: true })

// Convert Operation to custom LaTeX string (lowercase variables, no operators)
function operationToLatex(op: Operation, isCNF: boolean = false): string {
    if ((op as any).name !== undefined) {
        // It's a VAR
        return (op as any).name.toLowerCase()
    }

    if ((op as any).priority === 15) {
        // It's a NOT
        const inner = (op as any).args[0]
        return `\\bar{${operationToLatex(inner, isCNF)}}`
    }

    if ((op as any).priority === 8) {
        // It's an AND
        const args = (op as any).args as Operation[]
        if (isCNF) {
            // For CNF: AND joins product terms (parentheses groups)
            return args.map(arg => operationToLatex(arg, isCNF)).join('')
        } else {
            // For DNF: AND concatenates literals
            return args.map(arg => operationToLatex(arg, isCNF)).join('')
        }
    }

    if ((op as any).priority === 6) {
        // It's an OR
        const args = (op as any).args as Operation[]
        if (isCNF) {
            // For CNF: OR creates sum terms (wrapped in parentheses)
            const sum = args.map(arg => operationToLatex(arg, isCNF)).join(' + ')
            // Wrap in parentheses if more than one literal
            return args.length > 1 ? `(${sum})` : sum
        } else {
            // For DNF: OR separates product terms with +
            return args.map(arg => operationToLatex(arg, isCNF)).join(' + ')
        }
    }

    return ''
}

// Parse an expression into individual terms
function getTerms(expr: Operation, isCNF: boolean): string[] {
    const latex = operationToLatex(expr, isCNF)
    if (isCNF) {
        // For CNF: split by product terms (parentheses groups)
        // Match parentheses groups or single variables
        const matches = latex.match(/\([^)]+\)|[^()\s]+/g) || []
        return matches.map(t => t.trim())
    } else {
        // For DNF: split by + for sum terms
        return latex.split(' + ').map(t => t.trim())
    }
}

// Analyze expressions to find common terms and variable positions
function analyzeExpressions(exprs: Operation[], isCNF: boolean): { constantTerms: string[], variablePositions: string[][] } {
    if (exprs.length === 0) return { constantTerms: [], variablePositions: [] }
    if (exprs.length === 1) return { constantTerms: getTerms(exprs[0]!, isCNF), variablePositions: [] }

    const allTerms = exprs.map(expr => getTerms(expr, isCNF))
    const maxLength = Math.max(...allTerms.map(t => t.length))

    // Pad shorter expressions with empty strings
    const paddedTerms = allTerms.map(terms => {
        const padded = [...terms]
        while (padded.length < maxLength) padded.push('')
        return padded
    })

    // For each position, check if all expressions have the same term
    const constantTerms: string[] = []
    const variablePositions: string[][] = []

    for (let pos = 0; pos < maxLength; pos++) {
        const termsAtPos = paddedTerms.map(terms => terms[pos]!).filter(t => t !== '')
        const uniqueTerms = Array.from(new Set(termsAtPos))

        if (uniqueTerms.length === 1) {
            // All expressions have the same term at this position
            constantTerms.push(uniqueTerms[0]!)
        } else if (uniqueTerms.length > 1) {
            // This position varies across expressions - collect all variations
            variablePositions.push(termsAtPos)
        }
    }

    return { constantTerms, variablePositions }
}

// Get all unique variables from expressions
function getVariables(exprs: Operation[]): string[] {
    const varSet = new Set<string>()

    function collectVars(op: Operation) {
        if ((op as any).name !== undefined) {
            varSet.add((op as any).name.toLowerCase())
        }

        if ((op as any).args && Array.isArray((op as any).args)) {
            for (const arg of (op as any).args) {
                collectVars(arg)
            }
        }
    }

    for (const expr of exprs) {
        collectVars(expr)
    }

    return Array.from(varSet).sort()
}

const formulaLatex = computed(() => {
    if (expressions.value.length === 0) return ''

    const isCNF = props.functionType === 'CNF'
    const { constantTerms, variablePositions } = analyzeExpressions(expressions.value, isCNF)

    // If no variable positions, all expressions are identical
    if (variablePositions.length === 0) {
        const vars = getVariables(expressions.value)
        const formType = props.functionType === 'DNF' ? 'DMF' : 'CMF'
        const signature = `f_{${formType}}(${vars.join(', ')}) = `
        // Join terms appropriately based on form
        const termJoiner = isCNF ? '' : ' + '
        return signature + constantTerms.join(termJoiner)
    }

    // Build formula: constant terms + matrices for each variable position
    const parts: string[] = []

    // Add constant terms
    if (constantTerms.length > 0) {
        const termJoiner = isCNF ? '' : ' + '
        parts.push(constantTerms.join(termJoiner))
    }

    // Add a matrix for each variable position
    for (const variations of variablePositions) {
        // Get unique variations only
        const uniqueVars = Array.from(new Set(variations))
        const matrixRows = uniqueVars.join(' \\\\ ')
        parts.push(`\\left\\{ \\begin{matrix} ${matrixRows} \\end{matrix} \\right\\}`)
    }

    const vars = getVariables(expressions.value)
    const formType = props.functionType === 'DNF' ? 'DMF' : 'CMF'
    const signature = `f_{${formType}}(${vars.join(', ')}) = `
    const termJoiner = isCNF ? '' : ' + '
    return signature + parts.join(termJoiner)
})


</script>

<style scoped></style>
