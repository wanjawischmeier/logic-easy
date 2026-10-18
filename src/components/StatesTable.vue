<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import { Toast } from '@/utility/toastService'
import type { FsmNode } from '@/projects/state-machine/FsmTypes'
import { normalizeBits } from '@/utility/fsm/bitOperations'
import {
  addStateRow as addFsmStateRow,
  getStateCountLimit,
  MAX_STATE_NAME_LENGTH,
  removeStateRow as removeFsmStateRow,
  renameState as renameFsmState,
  sanitizeStateName,
  toggleStateMooreOutputBit,
} from '@/projects/state-machine/FsmProject'

const { nodes, nodeIdBitCount, fsmModel, outputBitCount } = FsmProject.useState()

// The number of input/output bits is fixed once at project creation or on data import
const stateLimit = computed(() => getStateCountLimit()) // 16

const editingNames = reactive<Record<number, string | undefined>>({})

const fsm = computed(() => stateManager.state.fsm)

function getFsm() {
  return fsm.value
}

// In Moore mode the output belongs to the state, so this column reads and writes the state itself
function stateOutputValue(state: FsmNode): string {
  return normalizeBits(state.mooreOutput, outputBitCount.value, 'x', 'right')
}

function displayOutputBit(state: FsmNode, index: number): string {
  const bit = stateOutputValue(state).charAt(Number(index)) || 'x'
  return bit === 'x' ? '-' : bit
}

const editableCellRefs = ref<(HTMLElement | null)[][]>([])

function setEditableCellRef(el: HTMLElement | null, rowIdx: number, bitIdx: number) {
  if (!editableCellRefs.value[rowIdx]) {
    editableCellRefs.value[rowIdx] = []
  }

  editableCellRefs.value[rowIdx]![bitIdx] = el
}

function focusEditableCell(rowIdx: number, bitIdx: number) {
  const maxRow = nodes.value.length - 1
  const maxBit = outputBitCount.value - 1
  if (maxRow < 0 || maxBit < 0) return

  const targetRow = Math.max(0, Math.min(maxRow, rowIdx))
  const targetBit = Math.max(0, Math.min(maxBit, bitIdx))
  editableCellRefs.value[targetRow]?.[targetBit]?.focus()
}

function toggleStateOutputBit(stateId: number, bitIdx: number) {
  const current = getFsm()
  if (!current) return

  toggleStateMooreOutputBit(current, stateId, bitIdx)
}

function handleOutputCellKeydown(
  event: KeyboardEvent,
  rowIdx: number,
  bitIdx: number,
  stateId: number,
) {
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      focusEditableCell(rowIdx - 1, bitIdx)
      return
    case 'ArrowDown':
      event.preventDefault()
      focusEditableCell(rowIdx + 1, bitIdx)
      return
    case 'ArrowLeft':
      event.preventDefault()
      focusEditableCell(rowIdx, bitIdx - 1)
      return
    case 'ArrowRight':
      event.preventDefault()
      focusEditableCell(rowIdx, bitIdx + 1)
      return
    case ' ':
    case 'Spacebar':
      event.preventDefault()
      toggleStateOutputBit(stateId, bitIdx)
      return
    default:
      return
  }
}

function addStateRow() {
  const current = getFsm()
  if (!current) return
  if (nodes.value.length >= stateLimit.value) return

  addFsmStateRow(current, fsmModel.value)
}

// Only the highest state can be removed so ids/names stay contiguous
function decreaseStateCount() {
  const current = getFsm()
  if (!current) return
  if (nodes.value.length === 0) return

  const highestStateId = Math.max(...nodes.value.map((state) => state.nodeId))
  removeFsmStateRow(current, highestStateId)

  delete editingNames[highestStateId]
}

function startEditingName(stateId: number, currentName: string) {
  editingNames[stateId] = currentName
}

function bufferStateName(stateId: number, name: string, input?: HTMLInputElement) {
  const sanitized = sanitizeStateName(name) // applies editor rules
  editingNames[stateId] = sanitized

  // Sanitizing can drop characters without changing the buffer, so the DOM needs the result too
  if (input && input.value !== sanitized) {
    const caret = input.selectionStart ?? name.length
    const caretAfter = sanitizeStateName(name.slice(0, caret)).length
    input.value = sanitized
    input.setSelectionRange(caretAfter, caretAfter)
  }
}

function commitStateName(stateId: number) {
  const current = getFsm()
  const buffered = editingNames[stateId]
  delete editingNames[stateId]

  if (!current) return

  const state = nodes.value.find((s) => s.nodeId === stateId)
  if (!state) return
  if (buffered === undefined) return

  const nextName = sanitizeStateName(buffered).trim() || `q${stateId}`
  const duplicateExists = nodes.value.some(
    (node) => node.nodeId !== stateId && node.name.trim().toLowerCase() === nextName.toLowerCase(),
  )

  // invalid renames are reported and the state keeps its name
  if (duplicateExists) {
    Toast.warning(`A state named "${nextName}" already exists.`)
    return
  }

  // if no effective change was made while editing, don't sync the FSM panel
  if (nextName === state.name) return

  renameFsmState(current, stateId, nextName)
}
</script>

<template>
  <div class="w-full flex flex-col gap-2 items-center p-2">
    <h1 class="text-xl text-center font-mono">States</h1>

    <table class="flex-auto bg-surface-1 border border-primary table-auto select-none mb-0">
      <thead>
        <tr v-if="fsmModel === 'moore'">
          <th
            rowspan="2"
            class="px-3 text-on-surface-disabled border-b-4 border-primary bg-surface-1 w-auto font-mono border-r-4"
          >
            name
          </th>
          <th
            rowspan="2"
            class="px-3 text-on-surface-disabled border-b-4 border-primary bg-surface-1 w-auto font-mono border-r-4"
          >
            binary index
          </th>
          <th
            :colspan="outputBitCount"
            class="px-3 text-on-surface-disabled border-b border-primary bg-surface-1 w-auto font-mono"
          >
            output
          </th>
        </tr>
        <tr v-if="fsmModel === 'moore'">
          <th
            v-for="i in outputBitCount"
            :key="'y-' + i"
            class="px-1 py-0.5 text-on-surface-disabled border-b-4 border-primary bg-surface-1 font-mono"
            :class="i === outputBitCount ? '' : 'border-r border-gray-600'"
          >
            <vue-latex :expression="`Y_{${outputBitCount - i}}`" />
          </th>
        </tr>
        <tr v-if="fsmModel !== 'moore'">
          <th
            class="px-3 text-on-surface-disabled border-b-4 border-primary bg-surface-1 w-auto font-mono border-r-4"
          >
            name
          </th>
          <th
            class="px-3 text-on-surface-disabled border-b-4 border-primary bg-surface-1 w-auto font-mono"
          >
            binary index
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="nodes.length === 0">
          <td class="text-lg font-mono text-center border-b border-primary border-r-4 px-2 py-0" />
          <td class="text-lg font-mono text-center border-b border-primary border-r-4 px-2 py-0" />
          <td
            v-if="fsmModel === 'moore'"
            class="text-lg font-mono text-center border-b border-primary px-2 py-0"
          />
        </tr>

        <tr v-else v-for="(state, rowIdx) in nodes" :key="state.nodeId">
          <td class="text-lg font-mono text-center border-b border-primary border-r-4 px-2 py-0">
            <input
              :value="
                editingNames[state.nodeId] !== undefined ? editingNames[state.nodeId] : state.name
              "
              :maxlength="MAX_STATE_NAME_LENGTH"
              class="w-full bg-transparent text-center outline-none hover:bg-surface-2 focus:bg-surface-2 transition-colors duration-100"
              @focus="startEditingName(state.nodeId, state.name)"
              @input="
                bufferStateName(
                  state.nodeId,
                  ($event.target as HTMLInputElement).value,
                  $event.target as HTMLInputElement,
                )
              "
              @blur="commitStateName(state.nodeId)"
              @keydown.enter.prevent="
                commitStateName(state.nodeId)
                ;($event.target as HTMLInputElement)?.blur()
              "
            />
          </td>
          <td
            class="text-lg font-mono text-center bg-surface-1 border-b border-primary px-2 py-0"
            :class="fsmModel === 'moore' ? 'border-r-4' : ''"
          >
            {{ state.binaryNodeId ?? '-'.repeat(nodeIdBitCount) }}
          </td>

          <template v-if="fsmModel === 'moore'">
            <td
              v-for="(_, i) in outputBitCount"
              :key="state.nodeId + '-out-' + i"
              :ref="(el) => setEditableCellRef(el as HTMLElement | null, rowIdx, Number(i))"
              class="text-lg font-mono text-center bg-surface-1 border-b border-primary px-1 py-0 select-none hover:bg-surface-2 focus:bg-surface-2 focus:outline-none transition-colors duration-100"
              :class="i === outputBitCount ? '' : 'border-r border-gray-600'"
              tabindex="0"
              @click="toggleStateOutputBit(state.nodeId, Number(i))"
              @keydown="handleOutputCellKeydown($event, rowIdx, Number(i), state.nodeId)"
            >
              {{ displayOutputBit(state, Number(i)) }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="flex gap-2">
      <button
        class="flex items-center justify-center w-9 h-9 rounded bg-surface-2 border border-surface-3 text-on-surface text-2xl leading-none transition-colors hover:bg-primary hover:border-primary disabled:opacity-30"
        :disabled="nodes.length === 0"
        title="Remove state"
        @click="decreaseStateCount"
      >
        −
      </button>
      <button
        class="flex items-center justify-center w-9 h-9 rounded bg-surface-2 border border-surface-3 text-on-surface text-2xl leading-none transition-colors hover:bg-primary hover:border-primary disabled:opacity-30"
        :disabled="nodes.length >= stateLimit"
        title="Add state"
        @click="addStateRow"
      >
        +
      </button>
    </div>
  </div>
</template>
