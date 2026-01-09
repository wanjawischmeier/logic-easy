<template>
    <div class="h-full text-on-surface flex flex-col p-2 overflow-auto">
        <div>
            <QMCGroupingTable :iterations="iterations" :prime-implicants="pis" />
        </div>

        <div>
            <QMCPrimeImplicantChart :minterms="minterms" :prime-implicants="pis" :chart="chart" />
        </div>

        <FormulaRenderer :latex-expression="formulaLatex" v-if="formulaLatex"></FormulaRenderer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { QMC, type QMCDetailedExpressionsObjects } from 'logi.js'
import type { Operation } from 'logi.js'
import QMCGroupingTable from './parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from './parts/QMCPrimeImplicantChart.vue'
import FormulaRenderer from './FormulaRenderer.vue'

const iterations = ref<any[]>([])
const minterms = ref<number[]>([])
const pis = ref<any[]>([])
const chart = ref<Record<number, string[]> | null>(null)
const expressions = ref<Operation[]>([])

// Convert Operation to custom LaTeX string (lowercase variables, no operators)
function operationToLatex(op: Operation): string {
    if ((op as any).name !== undefined) {
        // It's a VAR
        return (op as any).name.toLowerCase()
    }

    if ((op as any).priority === 15) {
        // It's a NOT
        const inner = (op as any).args[0]
        return `\\bar{${operationToLatex(inner)}}`
    }

    if ((op as any).priority === 8) {
        // It's an AND - concatenate without operators
        const args = (op as any).args as Operation[]
        return args.map(arg => operationToLatex(arg)).join('')
    }

    if ((op as any).priority === 6) {
        // It's an OR - separate with +
        const args = (op as any).args as Operation[]
        return args.map(arg => operationToLatex(arg)).join(' + ')
    }

    return ''
}

// Parse an expression into individual sum terms
function getTerms(expr: Operation): string[] {
    const latex = operationToLatex(expr)
    return latex.split(' + ').map(t => t.trim())
}

// Analyze expressions to find common terms and variable positions
function analyzeExpressions(exprs: Operation[]): { constantTerms: string[], variablePositions: string[][] } {
    if (exprs.length === 0) return { constantTerms: [], variablePositions: [] }
    if (exprs.length === 1) return { constantTerms: getTerms(exprs[0]!), variablePositions: [] }

    const allTerms = exprs.map(expr => getTerms(expr))
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

    const { constantTerms, variablePositions } = analyzeExpressions(expressions.value)

    // If no variable positions, all expressions are identical
    if (variablePositions.length === 0) {
        const vars = getVariables(expressions.value)
        const signature = `f(${vars.join(', ')}) = `
        return signature + constantTerms.join(' + ')
    }

    // Build formula: constant terms + matrices for each variable position
    const parts: string[] = []

    // Add constant terms
    if (constantTerms.length > 0) {
        parts.push(constantTerms.join(' + '))
    }

    // Add a matrix for each variable position
    for (const variations of variablePositions) {
        // Get unique variations only
        const uniqueVars = Array.from(new Set(variations))
        const matrixRows = uniqueVars.join(' \\\\ ')
        parts.push(`\\left\\{ \\begin{matrix} ${matrixRows} \\end{matrix} \\right\\}`)
    }

    const vars = getVariables(expressions.value)
    const signature = `f_{DMF}(${vars.join(', ')}) = `
    return signature + parts.join(' + ')
})

onMounted(() => {
    const qmc = new QMC()
    const mt = [0, 1, 2, 3, 5, 8, 10, 12, 13, 14, 15]
    const dc: number[] = []

    const detailedResult = qmc.solve(mt, dc, true, true) as QMCDetailedExpressionsObjects
    const d = detailedResult.details
    if (!d) return
    console.log(detailedResult)

    iterations.value = d.iterations
    const sortedMinterms = (d.minterms || []).slice().sort((a: number, b: number) => a - b)
    minterms.value = sortedMinterms
    pis.value = d.primeImplicants || []
    chart.value = d.chart || {}

    // Get the minimized expressions
    expressions.value = detailedResult.expressions
})
</script>

<style scoped></style>
