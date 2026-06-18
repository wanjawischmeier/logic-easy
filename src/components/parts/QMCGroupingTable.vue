<template>
  <div>
    <div class="w-full overflow-auto">
      <table ref="tableRef" class="bg-surface-1 border border-primary table-auto select-none">
        <thead>
          <tr>
            <th
              rowspan="2"
              class="px-3 pt-1 pb-2 text-secondary-variant border-b-4 border-r-4 border-primary bg-surface-1"
            >
              Class
            </th>
            <template v-for="(iter, idx) in qmcResult?.iterations" :key="`group-${idx}`">
              <th
                colspan="2"
                class="px-8 py-1 text-secondary-variant border-r border-primary bg-surface-1 text-center"
                :class="{ 'border-r-4': idx < (qmcResult?.iterations?.length ?? 0) - 1 }"
              >
                {{
                  idx === 0
                    ? functionType == 'Disjunctive'
                      ? 'Minterms'
                      : 'Maxterms'
                    : `Iteration ${idx}`
                }}
              </th>
            </template>
          </tr>
          <tr>
            <template v-for="(iter, idx) in qmcResult?.iterations" :key="`sub-${idx}`">
              <th
                class="px-2 text-secondary-variant border-b-4 border-primary bg-surface-1 text-center"
              >
                #
              </th>
              <th
                class="px-3 text-secondary-variant border-b-4 border-primary bg-surface-1"
                :class="{ 'border-r-4': idx < (qmcResult?.iterations?.length ?? 0) - 1 }"
              >
                Term
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <template v-for="(kClass, kIdx) in tableRows" :key="kIdx">
            <tr v-for="(row, rowIdx) in kClass.rows" :key="rowIdx">
              <td
                v-if="rowIdx === 0"
                :rowspan="kClass.rows.length"
                class="px-3 text-center align-middle border-b border-r-4 border-primary font-semibold"
              >
                <vue-latex :expression="`K_{${kClass.k}}`" display-mode />
              </td>
              <template v-for="(cell, cellIdx) in row.cells" :key="cellIdx">
                <td
                  class="px-2 py-1 text-center align-middle border-b border-r border-primary text-sm font-mono transition-all duration-150"
                  :class="[
                    cell.bgColor,
                    { 'prime-highlight-left': cell.isPrime },
                    isHighlighted(cell) ? 'bg-yellow-200/50' : '',
                  ]"
                  @mouseenter="hoveredCellId = cell.id"
                  @mouseleave="hoveredCellId = null"
                >
                  {{ cell.index }}
                </td>
                <td
                  class="px-2 py-1 text-center align-middle border-b border-r border-primary text-sm font-mono transition-all duration-150"
                  :class="[
                    cell.bgColor,
                    {
                      'border-r-4': Number(cellIdx) < (qmcResult?.iterations?.length ?? 0) - 1,
                      'prime-highlight-right': cell.isPrime,
                    },
                    isHighlighted(cell) ? 'bg-yellow-200/50' : '',
                  ]"
                  @mouseenter="hoveredCellId = cell.id"
                  @mouseleave="hoveredCellId = null"
                >
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
import type { QMCResult } from '@/utility/truthtable/minimizer'
import type { FunctionType } from '@/utility/types'

const props = defineProps<{
  qmcResult?: QMCResult
  functionType: FunctionType
}>()

interface TableCell {
  id: string
  index: string | number
  term: string
  bgColor: string
  isPrime: boolean
  iteration: number
  parents: string[]
  parentIds: string[]
  childIds: string[]
}

interface TableRow {
  cells: TableCell[]
}

interface KClassRows {
  k: number
  rows: TableRow[]
}

const tableRows = ref<KClassRows[]>([])
const hoveredCellId = ref<string | null>(null)
const cellById = ref<Map<string, TableCell>>(new Map())

watch(
  () => [props.qmcResult?.iterations, props.qmcResult?.pis],
  () => {
    buildTableRows()
  },
  { immediate: true, deep: true },
)

function buildTableRows() {
  if (!props.qmcResult?.pis) return
  if (!props.qmcResult?.iterations || props.qmcResult?.iterations.length === 0) return
  const iterations = props.qmcResult.iterations

  const piTerms = new Set(props.qmcResult?.pis.map((p: any) => p.term))

  // Build group color assignments for each iteration
  const colors = ['bg-surface-2', 'bg-surface-3']
  const termToGroupColor = new Map<string, Map<number, string>>() // term -> iteration -> color
  const termToKClass = new Map<string, number>() // term -> K-class (from iteration 0)

  iterations.forEach((iter: any, iterIdx: number) => {
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

  // Collect entries per K-class per iteration
  const kClassEntries = new Map<number, Map<number, TableCell[]>>() // kClass -> iteration -> entries[]
  const entriesByIterationAndTerm = new Map<number, Map<string, TableCell[]>>()
  const nextCellById = new Map<string, TableCell>()

  const createCell = (cell: Omit<TableCell, 'childIds'>): TableCell => {
    const nextCell = { ...cell, childIds: [] }
    nextCellById.set(nextCell.id, nextCell)

    if (!entriesByIterationAndTerm.has(nextCell.iteration)) {
      entriesByIterationAndTerm.set(nextCell.iteration, new Map())
    }
    const iterEntries = entriesByIterationAndTerm.get(nextCell.iteration)!
    if (!iterEntries.has(nextCell.term)) {
      iterEntries.set(nextCell.term, [])
    }
    iterEntries.get(nextCell.term)!.push(nextCell)

    return nextCell
  }

  const getParentCombinations = (parents: string[], previousIteration: number): TableCell[][] => {
    const parentOptions = parents.map(
      (parent) => entriesByIterationAndTerm.get(previousIteration)?.get(parent) || [],
    )

    if (parentOptions.some((options) => options.length === 0)) return []

    return parentOptions.reduce<TableCell[][]>(
      (combinations, options) =>
        combinations.flatMap((combination) => options.map((option) => [...combination, option])),
      [[]],
    )
  }

  // Process iteration 0 minterms
  const iter0 = iterations[0]
  if (!iter0 || !iter0.groups) return

  const sortedK = Object.keys(iter0.groups).sort((a, b) => Number(a) - Number(b))
  sortedK.forEach((k: string) => {
    const kNum = Number(k)
    const terms = iter0.groups[k]
    if (!terms) return

    if (!kClassEntries.has(kNum)) {
      kClassEntries.set(kNum, new Map())
    }
    if (!kClassEntries.get(kNum)!.has(0)) {
      kClassEntries.get(kNum)!.set(0, [])
    }

    terms.forEach((term: string) => {
      if (!term) return
      const bgColor = termToGroupColor.get(term)?.get(0) || 'bg-surface-1'
      const entry = createCell({
        id: `i0:${term}:${kClassEntries.get(kNum)!.get(0)!.length}`,
        index: decimalFromBinary(term),
        term: term,
        bgColor: bgColor,
        isPrime: piTerms.has(term),
        iteration: 0,
        parents: [],
        parentIds: [],
      })

      kClassEntries.get(kNum)!.get(0)!.push(entry)
    })
  })

  // Helper function to find K-class by tracing back to iteration 0
  const findKClass = (cell: TableCell): number => {
    if (termToKClass.has(cell.term)) {
      return termToKClass.get(cell.term)!
    }

    const firstParentId = cell.parentIds[0]
    const firstParent = firstParentId ? nextCellById.get(firstParentId) : null
    if (firstParent) return findKClass(firstParent)

    return 0
  }

  // Process subsequent iterations' joins
  for (let iterIdx = 1; iterIdx < iterations.length; iterIdx++) {
    const iter = iterations[iterIdx]
    const joins = iter?.joins || []
    let joinEntryIdx = 0

    joins.forEach((join: any) => {
      const joinTerm = join.term
      const bgColor = termToGroupColor.get(joinTerm)?.get(iterIdx) || 'bg-surface-1'
      const parents = join.parents || []
      const parentCombinations = getParentCombinations(parents, iterIdx - 1)

      parentCombinations.forEach((parentCombination) => {
        const parentIds = parentCombination.map((parent) => parent.id)
        const entry = createCell({
          id: `i${iterIdx}:${joinTerm}:${joinEntryIdx++}`,
          index: join.minterms ? join.minterms.join(', ') : '',
          term: joinTerm,
          bgColor: bgColor,
          isPrime: piTerms.has(joinTerm),
          iteration: iterIdx,
          parents: parents,
          parentIds: parentIds,
        })

        parentIds.forEach((parentId) => nextCellById.get(parentId)?.childIds.push(entry.id))

        // Determine K-class from first parent, recursively tracing to iteration 0.
        const kClass = parentCombination[0] ? findKClass(parentCombination[0]) : 0

        // Store K-class for this term for future lookups.
        termToKClass.set(joinTerm, kClass)

        if (!kClassEntries.has(kClass)) {
          kClassEntries.set(kClass, new Map())
        }
        if (!kClassEntries.get(kClass)!.has(iterIdx)) {
          kClassEntries.get(kClass)!.set(iterIdx, [])
        }

        kClassEntries.get(kClass)!.get(iterIdx)!.push(entry)
      })
    })
  }

  cellById.value = nextCellById

  // Build compact rows by filling columns vertically
  const sortedKs = Array.from(kClassEntries.keys()).sort((a, b) => a - b)
  tableRows.value = sortedKs.map((k) => {
    const iterMap = kClassEntries.get(k)!

    // Find max entries across all iterations for this K-class
    let maxRows = 0
    for (let i = 0; i < iterations.length; i++) {
      const entries = iterMap.get(i) || []
      maxRows = Math.max(maxRows, entries.length)
    }

    // Build rows by filling vertically
    const rows: TableRow[] = []
    for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
      const cells: TableCell[] = []
      for (let iterIdx = 0; iterIdx < iterations.length; iterIdx++) {
        const entries = iterMap.get(iterIdx) || []
        const entry = entries[rowIdx]
        if (entry) {
          cells.push(entry)
        } else {
          // Empty cell
          cells.push(createEmptyCell(iterIdx, rowIdx))
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

function createEmptyCell(iteration: number, rowIdx: number): TableCell {
  return {
    id: `empty:${iteration}:${rowIdx}`,
    index: '',
    term: '',
    bgColor: 'bg-surface-1',
    isPrime: false,
    iteration,
    parents: [],
    parentIds: [],
    childIds: [],
  }
}

function collectRelatedCellIds(startId: string, direction: 'parents' | 'children'): Set<string> {
  const visited = new Set<string>()
  const pending = [startId]

  while (pending.length > 0) {
    const currentId = pending.pop()
    if (!currentId || visited.has(currentId)) continue

    visited.add(currentId)
    const currentCell = cellById.value.get(currentId)
    if (!currentCell) continue

    const nextIds = direction === 'parents' ? currentCell.parentIds : currentCell.childIds
    pending.push(...nextIds)
  }

  return visited
}

function isHighlighted(cell: TableCell): boolean {
  if (!cell.term || !hoveredCellId.value) return false
  if (cell.id === hoveredCellId.value) return true

  const ancestors = collectRelatedCellIds(hoveredCellId.value, 'parents')
  const descendants = collectRelatedCellIds(hoveredCellId.value, 'children')

  return ancestors.has(cell.id) || descendants.has(cell.id)
}
</script>

<style scoped></style>
