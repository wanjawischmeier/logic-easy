<template>
    <div>
        <div class="w-full overflow-auto relative">
            <table ref="tableRef" class="bg-surface-1 border border-primary table-fixed w-auto select-none relative">
                <thead>
                    <tr>
                        <th colspan="2"
                            class="px-3 pt-1 pb-2 text-secondary-variant border-b-4 border-r-4 border-primary bg-surface-1 text-center">
                            Terms
                        </th>
                        <th v-for="m in qmcResult?.minterms" :key="m"
                            class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1">{{ m
                            }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(pi, piIdx) in qmcResult?.pis" :key="pi.term"
                        class="hover:bg-surface-3 transition-color duration-100">
                        <td class="px-4 text-center align-middle border-b border-r border-primary font-mono relative"
                            :style="getBorderStyle(pi, piIdx, true, qmcResult)">
                            {{ pi.term }}
                        </td>
                        <td class="px-4 align-middle border-b border-r-4 border-primary relative"
                            :style="getBorderStyle(pi, piIdx, false, qmcResult)">
                            <vue-latex :fontsize=14 :expression="termToAlgebraic(pi.term)" />
                        </td>
                        <td v-for="m in qmcResult?.minterms" :key="m"
                            class="px-2 text-center align-middle border-b border-primary relative" :data-pi-idx="piIdx"
                            :data-minterm="m">
                            <vue-latex :fontsize=14 :expression="getCellSymbol(pi, m)" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Bounding boxes for essential prime implicants -->
            <svg class="absolute top-0 left-0 w-full h-full pointer-events-none" style="z-index: 1;">
                <rect v-for="(box, idx) in boundingBoxes" :key="idx" :x="box.x" :y="box.y" :width="box.width"
                    :height="box.height" :rx="8" :ry="8" :stroke="box.color.border" stroke-width="2"
                    :fill="box.color.fill" />
            </svg>
        </div>

        <FormulaRenderer class="pt-8" v-if="props.couplingTermLatex" :latex-expression="props.couplingTermLatex" />
    </div>
</template>

<script setup lang="ts">
import { type TruthTableState } from '@/projects/truth-table/TruthTableProject'
import FormulaRenderer from '@/components/FormulaRenderer.vue';
import { ref, computed, onMounted, nextTick, watch, type StyleValue } from 'vue'
import type { TermColor } from '@/utility/truthtable/colorGenerator';
import type { QMCResult } from '@/utility/truthtable/minimizer';
import type { PrimeImplicantInfo } from 'logi.js';

const BOUNDING_BOX_PADDING = 6

const props = defineProps<TruthTableState>()

interface BoundingBox {
    x: number
    y: number
    width: number
    height: number
    color: TermColor
}

const tableRef = ref<HTMLElement | null>(null)
const boundingBoxes = ref<Array<BoundingBox>>([])

// Find which minterms make each prime implicant essential
const essentialMinterms = computed(() => {
    const result = new Map<string, number[]>()
    if (!props.qmcResult?.pis) return result

    // First, build a map of minterm -> all PIs that cover it
    const mintermToPIs = new Map<number, string[]>()
    props.qmcResult?.pis.forEach(pi => {
        const piMinterms = pi.minterms || []
        piMinterms.forEach((m: number) => {
            if (!mintermToPIs.has(m)) {
                mintermToPIs.set(m, [])
            }
            mintermToPIs.get(m)!.push(pi.term)
        })
    })

    // Now find critical minterms for each essential PI
    props.qmcResult?.pis.forEach(pi => {
        if (!pi.isEssential) return

        const critical: number[] = []
        const piMinterms = pi.minterms || []

        // A minterm is critical if this PI is the only one covering it
        piMinterms.forEach((m: number) => {
            const coveringPIs = mintermToPIs.get(m) || []
            if (coveringPIs.length === 1 && coveringPIs[0] === pi.term) {
                critical.push(m)
            }
        })

        result.set(pi.term, critical)
    })

    return result
})

function termToAlgebraic(term: string): string {
    if (!term || !props.inputVars || props.inputVars.length === 0) return ''

    const literals: string[] = []

    // In the QMC space, leftmost bit corresponds to first variable
    for (let i = 0; i < term.length && i < props.inputVars.length; i++) {
        const bit = term[i]
        const varName = props.inputVars[i]?.toLowerCase() || ''

        if (bit === '1') {
            literals.push(varName)
        } else if (bit === '0') {
            literals.push(`\\bar{${varName}}`)
        }
        // '-' (don't care) is omitted
    }

    return literals.length > 0 ? literals.join('') : '1'
}

function getCellSymbol(pi: any, minterm: number): string {
    const piMinterms = pi.minterms || []
    if (!piMinterms.includes(minterm)) return ''

    // Check if this minterm makes this PI essential
    if (pi.isEssential) {
        const critical = essentialMinterms.value.get(pi.term) || []
        if (critical.includes(minterm)) {
            return '\\oplus'
        }
    }

    return '\\times'
}

function calculateBoundingBoxes() {
    if (!tableRef.value || !props.qmcResult?.pis) return

    const boxes: Array<BoundingBox> = []
    const table = tableRef.value
    const tableRect = table.getBoundingClientRect()

    props.qmcResult?.pis.forEach((pi, piIdx) => {
        if (!pi.isEssential) return

        const piMinterms = pi.minterms || []
        if (piMinterms.length === 0) return

        // Find all cells for this essential PI with their positions
        const cellsWithPositions: Array<{ element: HTMLElement, minterm: number, x: number, width: number }> = []
        const rows = table.querySelectorAll('tbody tr')

        rows.forEach(row => {
            const dataCells = row.querySelectorAll('td[data-pi-idx][data-minterm]')
            dataCells.forEach(cell => {
                const cellPiIdx = parseInt((cell as HTMLElement).getAttribute('data-pi-idx') || '-1')
                const cellMinterm = parseInt((cell as HTMLElement).getAttribute('data-minterm') || '-1')

                if (cellPiIdx === piIdx && piMinterms.includes(cellMinterm)) {
                    const rect = (cell as HTMLElement).getBoundingClientRect()
                    const x = rect.left - tableRect.left
                    cellsWithPositions.push({
                        element: cell as HTMLElement,
                        minterm: cellMinterm,
                        x: x,
                        width: rect.width
                    })
                }
            })
        })

        if (cellsWithPositions.length === 0) return

        // Sort cells by x position
        cellsWithPositions.sort((a, b) => a.x - b.x)

        // Group contiguous cells (cells that are adjacent horizontally)
        const groups: Array<typeof cellsWithPositions> = []
        let currentGroup: typeof cellsWithPositions = [cellsWithPositions[0]!]

        for (let i = 1; i < cellsWithPositions.length; i++) {
            const prev = cellsWithPositions[i - 1]!
            const curr = cellsWithPositions[i]!

            // Check if cells are adjacent (with small tolerance for rounding)
            const gap = curr.x - (prev.x + prev.width)
            const isAdjacent = gap < 5 // tolerance in pixels

            if (isAdjacent) {
                currentGroup.push(curr)
            } else {
                groups.push(currentGroup)
                currentGroup = [curr]
            }
        }
        groups.push(currentGroup)

        // Create a bounding box for each group
        const termColor = props.qmcResult?.termColors?.[piIdx];
        if (!termColor) return;

        // Get Y coordinates that span all rows
        const firstRow = table.querySelector('tbody tr')
        const lastRow = table.querySelector('tbody tr:last-child')
        let minY = 0, maxY = 0
        if (firstRow && lastRow) {
            const firstRowRect = firstRow.getBoundingClientRect()
            const lastRowRect = lastRow.getBoundingClientRect()
            minY = firstRowRect.top - tableRect.top
            maxY = lastRowRect.bottom - tableRect.top
        }

        groups.forEach(group => {
            if (group.length === 0) return

            const minX = group[0]!.x
            const lastCell = group[group.length - 1]!
            const maxX = lastCell.x + lastCell.width

            boxes.push({
                x: minX + BOUNDING_BOX_PADDING,
                y: minY + BOUNDING_BOX_PADDING,
                width: (maxX - minX) - (BOUNDING_BOX_PADDING * 2),
                height: (maxY - minY) - (BOUNDING_BOX_PADDING * 2),
                color: termColor
            })
        })
    })

    boundingBoxes.value = boxes
}

onMounted(() => {
    nextTick(() => {
        calculateBoundingBoxes()
    })
})

watch(() => [props.qmcResult?.pis, props.qmcResult?.minterms], () => {
    nextTick(() => {
        calculateBoundingBoxes()
    })
}, { deep: true })

function getBorderStyle(pi: PrimeImplicantInfo, piIdx: number, left: boolean, qmcResult?: QMCResult, borderWidth: string = '4px'): StyleValue {
    if (!qmcResult || !pi.isEssential) return {}

    const termColor = qmcResult?.termColors?.[piIdx]
    if (!termColor) return {}

    return left ?
        {
            boxShadow: `inset ${borderWidth} 0 0 0 ${termColor.border}, inset 0 ${borderWidth} 0 0 ${termColor.border}, inset 0 -${borderWidth} 0 0 ${termColor.border}`
        } : {
            boxShadow: `inset -${borderWidth} 0 0 0 ${termColor.border}, inset 0 ${borderWidth} 0 0 ${termColor.border}, inset 0 -${borderWidth} 0 0 ${termColor.border}`
        }
}
</script>

<style scoped></style>
