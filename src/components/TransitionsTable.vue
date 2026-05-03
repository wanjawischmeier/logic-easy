<script setup lang="ts">
import { ref } from 'vue'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import type { FsmModel, FsmNode, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { normalizeBits } from '@/utility/fsm/bitOperations'
import {
  toggleMooreOutputBit,
  toggleTransitionOutputBit,
  toggleTransitionTargetBit,
} from '@/projects/state-machine/FsmProject'

const { nodes, transitions, inputBitCount, outputBitCount, nodeIdBitCount, fsmModel } =
  FsmProject.useState()

const editableCellRefs = ref<(HTMLElement | null)[][]>([])

function getBinaryById(id: number) {
  const node = nodes.value.find((state) => state.nodeId === id)
  return node?.binaryNodeId ?? 'x'.repeat(nodeIdBitCount.value)
}

function getToBinary(tr: FsmTransition) {
  if (tr.toBinaryId) {
    return normalizeBits(tr.toBinaryId, nodeIdBitCount.value, 'x', 'left')
  }

  const node = nodes.value.find((state) => state.nodeId === tr.toNodeId)
  return node?.binaryNodeId ?? 'x'.repeat(nodeIdBitCount.value)
}

function getOutputValue(tr: FsmTransition, model: FsmModel): string {
  if (model === 'moore') {
    const node = nodes.value.find((state) => state.nodeId === tr.fromNodeId)
    return node?.mooreOutput ?? ''
  }

  return tr.mealyOutput ?? ''
}

function setEditableCellRef(el: HTMLElement | null, rowIdx: number, colIdx: number) {
  if (!editableCellRefs.value[rowIdx]) {
    editableCellRefs.value[rowIdx] = []
  }

  editableCellRefs.value[rowIdx]![colIdx] = el
}

function focusEditableCell(rowIdx: number, colIdx: number) {
  const maxRow = transitions.value.length - 1
  const maxCol = nodeIdBitCount.value + outputBitCount.value - 1
  if (maxRow < 0 || maxCol < 0) return

  const targetRow = Math.max(0, Math.min(maxRow, rowIdx))
  const targetCol = Math.max(0, Math.min(maxCol, colIdx))
  editableCellRefs.value[targetRow]?.[targetCol]?.focus()
}

function toggleToBit(idx: number, i: number) {
  const current = stateManager.state.fsm
  if (!current) return

  toggleTransitionTargetBit(current, idx, i)
}

function toggleOutputBit(idx: number, i: number) {
  const current = stateManager.state.fsm
  if (!current) return

  if (fsmModel.value === 'moore') {
    toggleMooreOutputBit(current, idx, i)
    return
  }

  toggleTransitionOutputBit(current, idx, i)
}

function handleEditableCellKeydown(event: KeyboardEvent, rowIdx: number, colIdx: number) {
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      focusEditableCell(rowIdx - 1, colIdx)
      return
    case 'ArrowDown':
      event.preventDefault()
      focusEditableCell(rowIdx + 1, colIdx)
      return
    case 'ArrowLeft':
      event.preventDefault()
      focusEditableCell(rowIdx, colIdx - 1)
      return
    case 'ArrowRight':
      event.preventDefault()
      focusEditableCell(rowIdx, colIdx + 1)
      return
    case ' ':
    case 'Spacebar':
      event.preventDefault()
      if (colIdx < nodeIdBitCount.value) {
        toggleToBit(rowIdx, colIdx)
      } else {
        toggleOutputBit(rowIdx, colIdx - nodeIdBitCount.value)
      }
      return
    default:
      return
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2 w-full pt-0">
    <h2 class="text-center py-2 mt-1 text-xl font-mono">Transitions</h2>

    <table
      v-if="transitions.length"
      class="mb-0 flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
    >
      <thead>
        <tr>
          <th
            class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
            :colspan="nodeIdBitCount"
          >
            first state
          </th>
          <th
            class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
            :colspan="inputBitCount"
          >
            input
          </th>
          <th
            class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
            :colspan="nodeIdBitCount"
          >
            next state
          </th>
          <th
            class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
            :colspan="outputBitCount"
          >
            output
          </th>
        </tr>
        <tr>
          <th
            v-for="i in nodeIdBitCount"
            :key="'z-from-' + i"
            class="px-0 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
            :class="i === nodeIdBitCount ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <vue-latex :expression="`Z_{${nodeIdBitCount - i}}^n`" />
          </th>

          <th
            v-for="i in inputBitCount"
            :key="'x-' + i"
            class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
            :class="i === inputBitCount ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <vue-latex :expression="`X_{${inputBitCount - i}}^n`" />
          </th>

          <th
            v-for="i in nodeIdBitCount"
            :key="'z-to-' + i"
            class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
            :class="i === nodeIdBitCount ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <vue-latex :expression="`Z_{${nodeIdBitCount - i}}^{(n+1)}`" />
          </th>

          <th
            v-for="i in outputBitCount"
            :key="'y-' + i"
            class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
            :class="i === outputBitCount ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <vue-latex :expression="`Y_{${outputBitCount - i}}^n`" />
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(transitionView, idx) in transitions" :key="transitionView.transitionId">
          <td
            v-for="(_, i) in nodeIdBitCount"
            :key="transitionView.transitionId + '-from-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === nodeIdBitCount - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            {{ getBinaryById(transitionView.fromNodeId).charAt(Number(i)) || '0' }}
          </td>

          <td
            v-for="(_, i) in inputBitCount"
            :key="transitionView.transitionId + '-in-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === inputBitCount - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            {{ normalizeBits(transitionView.input, inputBitCount, 'x', 'right').charAt(Number(i)) }}
          </td>

          <td
            v-for="(_, i) in nodeIdBitCount"
            :key="transitionView.transitionId + '-to-' + i"
            :ref="(el) => setEditableCellRef(el as HTMLElement | null, idx, Number(i))"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 focus:bg-gray-700 focus:outline-none transition-colors duration-100"
            :class="i === nodeIdBitCount - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            tabindex="0"
            @click="toggleToBit(idx, i)"
            @keydown="handleEditableCellKeydown($event, idx, Number(i))"
          >
            {{ getToBinary(transitionView).padStart(nodeIdBitCount, 'x').charAt(Number(i)) || 'x' }}
          </td>

          <td
            v-for="(_, i) in outputBitCount"
            :key="transitionView.transitionId + '-out-' + i"
            :ref="
              (el) => setEditableCellRef(el as HTMLElement | null, idx, nodeIdBitCount + Number(i))
            "
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 focus:bg-gray-700 focus:outline-none transition-colors duration-100"
            :class="i === outputBitCount - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            tabindex="0"
            @click="toggleOutputBit(idx, i)"
            @keydown="handleEditableCellKeydown($event, idx, nodeIdBitCount + Number(i))"
          >
            {{
              normalizeBits(
                getOutputValue(transitionView, fsmModel),
                outputBitCount,
                'x',
                'right',
              ).charAt(Number(i))
            }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else class="text-sm font-mono text-gray-400 text-center">
      Please add states to reveal the transition table.
    </div>
  </div>
</template>

<style scoped>
table {
  border-collapse: collapse;
}

td {
  min-width: 20px;
}
</style>
