<template>
    <div>
        <h3 class="text-lg font-semibold mb-2">Grouping & Join History</h3>
        <div class="w-full overflow-auto">
            <table ref="tableRef" class="bg-surface-1 border border-primary table-auto select-none">
                <thead>
                    <tr>
                        <th rowspan="2"
                            class="px-3 pt-1 pb-2 text-secondary-variant border-b-4 border-r-4 border-primary bg-surface-1">
                            Class</th>
                        <template v-for="(iter, idx) in iterations" :key="`group-${idx}`">
                            <th colspan="2"
                                class="px-8 py-1 text-secondary-variant border-r border-primary bg-surface-1 text-center"
                                :class="{ 'border-r-4': idx < (iterations?.length ?? 0) - 1 }">
                                {{ idx === 0 ? 'Minterms' : `Iteration ${idx}` }}
                            </th>
                        </template>
                    </tr>
                    <tr>
                        <template v-for="(iter, idx) in iterations" :key="`sub-${idx}`">
                            <th class="px-2 text-secondary-variant border-b-4 border-primary bg-surface-1 text-center">
                                #</th>
                            <th class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1"
                                :class="{ 'border-r-4': idx < (iterations?.length ?? 0) - 1 }">
                                Term
                            </th>
                        </template>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="(kClass, kIdx) in tableRows" :key="kIdx">
                        <tr v-for="(row, rowIdx) in kClass.rows" :key="rowIdx">
                            <td v-if="rowIdx === 0" :rowspan="kClass.rows.length"
                                class="px-3 text-center align-middle border-b border-r-4 border-primary font-semibold">
                                <vue-latex :expression="`K_{${kClass.k}}`" display-mode />
                            </td>
                            <template v-for="(cell, cellIdx) in row.cells" :key="cellIdx">
                                <td class="px-2 py-1 text-center align-middle border-b border-r border-primary text-sm font-mono transition-all duration-150"
                                    :class="[cell.bgColor, { 'prime-highlight-left': cell.isPrime }, isHighlighted(cell.term) ? 'bg-yellow-200/50' : '']"
                                    @mouseenter="hoveredTerm = cell.term" @mouseleave="hoveredTerm = null">
                                    {{ cell.index }}
                                </td>
                                <td class="px-2 py-1 text-center align-middle border-b border-primary text-sm font-mono transition-all duration-150"
                                    :class="[cell.bgColor, { 'border-r-4': Number(cellIdx) < row.cells.length - 1, 'prime-highlight-right': cell.isPrime }, isHighlighted(cell.term) ? 'bg-yellow-200/50' : '']"
                                    @mouseenter="hoveredTerm = cell.term" @mouseleave="hoveredTerm = null">
                                    {{ cell.term }}
                                </td>
                            </template>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
    iterations?: any[]
    primeImplicants?: any[]
}

const props = defineProps<Props>()

const tableRef = ref<HTMLElement | null>(null)
const tableRows = ref<any[]>([])
const hoveredTerm = ref<string | null>(null)
const termRelationships = ref<Map<string, { parents: string[], children: string[] }>>(new Map())

watch(() => [props.iterations, props.primeImplicants], () => {
    buildTableRows()
}, { immediate: true, deep: true })

function buildTableRows() {
    if (!props.primeImplicants) return
    if (!props.iterations || props.iterations.length === 0) return

    const piTerms = new Set(props.primeImplicants.map((p: any) => p.term))

    // Build group color assignments for each iteration
    const colors = ['bg-surface-2', 'bg-surface-3']
    const termToGroupColor = new Map<string, Map<number, string>>() // term -> iteration -> color
    const termToKClass = new Map<string, number>() // term -> K-class (from iteration 0)

    props.iterations.forEach((iter: any, iterIdx: number) => {
        const groups = iter.groups || {}
        const sortedK = Object.keys(groups).sort((a, b) => Number(a) - Number(b))
        let groupColorIndex = 0

        sortedK.forEach((k: string) => {
            const terms = groups[k]
            const groupColor = colors[groupColorIndex % colors.length]
            if (!groupColor) return

            terms.forEach((term: string) => {
                if (!termToGroupColor.has(term)) {
                    termToGroupColor.set(term, new Map())
                }
                termToGroupColor.get(term)!.set(iterIdx, groupColor)

                // Store K-class from iteration 0
                if (iterIdx === 0) {
                    termToKClass.set(term, Number(k))
                }
            })

            groupColorIndex++
        })
    })

    // Build term relationships for hover highlighting
    termRelationships.value.clear()
    for (let iterIdx = 1; iterIdx < props.iterations.length; iterIdx++) {
        const iter = props.iterations[iterIdx]
        const joins = iter.joins || []
        joins.forEach((join: any) => {
            const joinTerm = join.term
            const parents = join.parents || []

            // Add children to parents
            parents.forEach((parent: string) => {
                if (!termRelationships.value.has(parent)) {
                    termRelationships.value.set(parent, { parents: [], children: [] })
                }
                termRelationships.value.get(parent)!.children.push(joinTerm)
            })

            // Add parents to join
            if (!termRelationships.value.has(joinTerm)) {
                termRelationships.value.set(joinTerm, { parents: [], children: [] })
            }
            termRelationships.value.get(joinTerm)!.parents = parents
        })
    }

    // Collect entries per K-class per iteration
    const kClassEntries = new Map<number, Map<number, any[]>>() // kClass -> iteration -> entries[]

    // Process iteration 0 minterms
    const iter0 = props.iterations[0]
    if (!iter0 || !iter0.groups) return

    const sortedK = Object.keys(iter0.groups).sort((a, b) => Number(a) - Number(b))
    sortedK.forEach((k: string) => {
        const kNum = Number(k)
        const terms = iter0.groups[k]

        if (!kClassEntries.has(kNum)) {
            kClassEntries.set(kNum, new Map())
        }
        if (!kClassEntries.get(kNum)!.has(0)) {
            kClassEntries.get(kNum)!.set(0, [])
        }

        terms.forEach((term: string) => {
            if (!term) return
            const bgColor = termToGroupColor.get(term)?.get(0) || 'bg-surface-1'
            kClassEntries.get(kNum)!.get(0)!.push({
                index: decimalFromBinary(term),
                term: term,
                bgColor: bgColor,
                isPrime: piTerms.has(term)
            })
        })
    })

    // Helper function to find K-class by tracing back to iteration 0
    const findKClass = (term: string): number => {
        if (termToKClass.has(term)) {
            return termToKClass.get(term)!
        }
        // If not in iteration 0, trace back through relationships
        const rels = termRelationships.value.get(term)
        if (rels && rels.parents.length > 0) {
            return findKClass(rels.parents[0]!)
        }
        return 0
    }

    // Process subsequent iterations' joins
    for (let iterIdx = 1; iterIdx < props.iterations.length; iterIdx++) {
        const iter = props.iterations[iterIdx]
        const joins = iter.joins || []

        joins.forEach((join: any) => {
            const joinTerm = join.term
            const bgColor = termToGroupColor.get(joinTerm)?.get(iterIdx) || 'bg-surface-1'

            // Determine K-class from first parent, recursively tracing to iteration 0
            const firstParent = join.parents?.[0]
            const kClass = firstParent ? findKClass(firstParent) : 0

            // Store K-class for this term for future lookups
            termToKClass.set(joinTerm, kClass)

            if (!kClassEntries.has(kClass)) {
                kClassEntries.set(kClass, new Map())
            }
            if (!kClassEntries.get(kClass)!.has(iterIdx)) {
                kClassEntries.get(kClass)!.set(iterIdx, [])
            }

            kClassEntries.get(kClass)!.get(iterIdx)!.push({
                index: join.minterms ? join.minterms.join(', ') : '',
                term: joinTerm,
                bgColor: bgColor,
                isPrime: piTerms.has(joinTerm)
            })
        })
    }

    // Build compact rows by filling columns vertically
    const sortedKs = Array.from(kClassEntries.keys()).sort((a, b) => a - b)
    tableRows.value = sortedKs.map(k => {
        if (!props.iterations) return
        const iterMap = kClassEntries.get(k)!

        // Find max entries across all iterations for this K-class
        let maxRows = 0
        for (let i = 0; i < props.iterations.length; i++) {
            const entries = iterMap.get(i) || []
            maxRows = Math.max(maxRows, entries.length)
        }

        // Build rows by filling vertically
        const rows = []
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
            const cells = []
            for (let iterIdx = 0; iterIdx < props.iterations.length; iterIdx++) {
                const entries = iterMap.get(iterIdx) || []
                if (rowIdx < entries.length) {
                    cells.push(entries[rowIdx])
                } else {
                    // Empty cell
                    cells.push({ index: '', term: '', bgColor: 'bg-surface-1', isPrime: false })
                }
            }
            rows.push({ cells })
        }

        return { k, rows }
    })
}

function decimalFromBinary(binary: string): number {
    return parseInt(binary.replace(/-/g, '0'), 2)
}

// Parse minterms from cell index (can be single number or comma-separated string)
function getMinMaxTerms(indexValue: string | number): Set<number> {
    if (typeof indexValue === 'number') {
        return new Set([indexValue])
    }
    if (!indexValue) return new Set()

    const minterms = indexValue.toString().split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    return new Set(minterms)
}

// Check if set A is a subset of set B
function isSubset(a: Set<number>, b: Set<number>): boolean {
    if (a.size > b.size) return false
    for (const item of a) {
        if (!b.has(item)) return false
    }
    return true
}

function isHighlighted(term: string): boolean {
    if (!term || !hoveredTerm.value) return false
    if (term === hoveredTerm.value) return true

    // Find the hovered cell to get its minterms
    let hoveredCell: any = null
    let candidateCell: any = null

    for (const kClass of tableRows.value) {
        for (const row of kClass.rows) {
            for (const cell of row.cells) {
                if (cell.term === hoveredTerm.value) {
                    hoveredCell = cell
                }
                if (cell.term === term) {
                    candidateCell = cell
                }
            }
        }
    }

    if (!hoveredCell || !candidateCell) return false

    const hoveredMinterms = getMinMaxTerms(hoveredCell.index)
    const candidateMinterms = getMinMaxTerms(candidateCell.index)

    // Highlight if hovered minterms are a subset of candidate (descendant)
    if (isSubset(hoveredMinterms, candidateMinterms) && hoveredMinterms.size < candidateMinterms.size) {
        return true
    }

    // Highlight if candidate minterms are a subset of hovered (ancestor)
    if (isSubset(candidateMinterms, hoveredMinterms) && candidateMinterms.size < hoveredMinterms.size) {
        return true
    }

    return false
}
</script>

<style scoped></style>
