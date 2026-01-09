<template>
    <div>
        <h3 class="text-lg font-semibold mb-2">Prime Implicant Chart</h3>
        <div class="w-full overflow-auto relative">
            <table ref="tableRef" class="bg-surface-1 border border-primary table-fixed w-auto select-none relative">
                <thead>
                    <tr>
                        <th
                            class="px-3 pt-1 pb-2 text-secondary-variant border-b-4 border-r-4 border-primary bg-surface-1">
                            Terms
                        </th>
                        <th v-for="m in minterms" :key="m"
                            class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1">{{ m }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(pi, piIdx) in primeImplicants" :key="pi.term"
                        class="hover:bg-surface-3 transition-color duration-100">
                        <td class="px-4 align-middle border-b border-r-4 border-primary relative"
                            :style="pi.isEssential ? { boxShadow: `inset 0 0 0 2px ${essentialColors[piIdx % essentialColors.length]}` } : {}">
                            <vue-latex :fontsize=14 :expression="pi.term" display-mode />
                        </td>
                        <td v-for="m in minterms" :key="m"
                            class="px-4 text-center align-middle border-b border-primary relative" :data-pi-idx="piIdx"
                            :data-minterm="m">
                            <vue-latex :fontsize=14 :expression="getCellSymbol(pi, m)" display-mode />
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Bounding boxes for essential prime implicants -->
            <svg class="absolute top-0 left-0 w-full h-full pointer-events-none" style="z-index: 1;">
                <rect v-for="(box, idx) in boundingBoxes" :key="idx" :x="box.x" :y="box.y" :width="box.width"
                    :height="box.height" :rx="8" :ry="8" :stroke="box.color" stroke-width="2" fill="none"
                    :style="{ strokeDasharray: '6,8' }" />
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'

const BOUNDING_BOX_PADDING = 6

interface Props {
    minterms: number[]
    primeImplicants: any[]
    chart: Record<number, string[]> | null
}

const props = defineProps<Props>()

const tableRef = ref<HTMLElement | null>(null)
const boundingBoxes = ref<Array<{ x: number, y: number, width: number, height: number, color: string }>>([])

const essentialColors = [
    'rgb(239, 68, 68)',    // red
    'rgb(59, 130, 246)',   // blue
    'rgb(34, 197, 94)',    // green
    'rgb(168, 85, 247)',   // purple
    'rgb(234, 179, 8)',    // yellow
    'rgb(236, 72, 153)',   // pink
    'rgb(20, 184, 166)',   // teal
]

const essentialList = computed(() => {
    return props.primeImplicants
        .filter((p: any) => p.isEssential)
        .map((p: any) => p.term)
})

// Find which minterms make each prime implicant essential
const essentialMinterms = computed(() => {
    const result = new Map<string, number[]>()

    // First, build a map of minterm -> all PIs that cover it
    const mintermToPIs = new Map<number, string[]>()
    props.primeImplicants.forEach(pi => {
        const piMinterms = pi.minterms || []
        piMinterms.forEach((m: number) => {
            if (!mintermToPIs.has(m)) {
                mintermToPIs.set(m, [])
            }
            mintermToPIs.get(m)!.push(pi.term)
        })
    })

    // Now find critical minterms for each essential PI
    props.primeImplicants.forEach(pi => {
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
    if (!tableRef.value) return

    const boxes: Array<{ x: number, y: number, width: number, height: number, color: string }> = []
    const table = tableRef.value
    const tableRect = table.getBoundingClientRect()

    props.primeImplicants.forEach((pi, piIdx) => {
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
        const color = essentialColors[piIdx % essentialColors.length] || 'rgb(239, 68, 68)'

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
                color: color
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

watch(() => [props.primeImplicants, props.minterms], () => {
    nextTick(() => {
        calculateBoundingBoxes()
    })
}, { deep: true })
</script>

<style scoped></style>
