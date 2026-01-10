<template>
    <div class="h-full text-on-surface flex flex-col p-2 overflow-auto">
        <div class="flex flex-wrap justify-center gap-12">
            <QMCGroupingTable :iterations="qmcResult?.iterations" :prime-implicants="qmcResult?.pis" />
            <QMCPrimeImplicantChart :minterms="qmcResult?.minterms" :prime-implicants="qmcResult?.pis"
                :chart="qmcResult?.chart" :input-vars="inputVars" />
            <FormulaRenderer :latex-expression="formulaLatex" v-if="formulaLatex"></FormulaRenderer>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Operation } from 'logi.js'
import QMCGroupingTable from './parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from './parts/QMCPrimeImplicantChart.vue'
import FormulaRenderer from './FormulaRenderer.vue'
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject'
import { Minimizer, type QMCResult } from '@/utility/truthtable/minimizer'
import type { FunctionType } from '@/utility/types'

interface Props {
    inputVars: string[]
    outputVars: string[]
    values: TruthTableData
    selectedOutputIndex?: number
    functionType?: FunctionType
}

const props = withDefaults(defineProps<Props>(), {
    selectedOutputIndex: 0,
    functionType: 'DNF'
})

const qmcResult = ref<QMCResult>()

// Watch for changes in input data
watch(() => [props.values, props.selectedOutputIndex, props.inputVars, props.outputVars, props.functionType], () => {
    qmcResult.value = Minimizer.runQMC(
        props.outputVars,
        props.values,
        props.selectedOutputIndex,
        props.functionType
    )
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
    if (!qmcResult.value || qmcResult.value.expressions.length === 0) return ''

    const isCNF = props.functionType === 'CNF'
    const { constantTerms, variablePositions } = analyzeExpressions(qmcResult.value.expressions, isCNF)

    // If no variable positions, all expressions are identical
    if (variablePositions.length === 0) {
        const vars = getVariables(qmcResult.value.expressions)
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

    const vars = getVariables(qmcResult.value.expressions)
    const formType = props.functionType === 'DNF' ? 'DMF' : 'CMF'
    const signature = `f_{${formType}}(${vars.join(', ')}) = `
    const termJoiner = isCNF ? '' : ' + '
    return signature + parts.join(termJoiner)
})
</script>

<style scoped></style>
