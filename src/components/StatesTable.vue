<script setup lang="ts">
import { computed, reactive } from 'vue'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import {
  addStateRow as addFsmStateRow,
  getStateCountLimit,
  removeStateRow as removeFsmStateRow,
  renameState as renameFsmState,
} from '@/projects/state-machine/FsmProject'

const { nodes, nodeIdBitCount, fsmModel } = FsmProject.useState()

// The number of input/output bits is fixed once at project creation or on data import
const stateLimit = computed(() => getStateCountLimit()) // 16

const editingNames = reactive<Record<number, string | undefined>>({})

const fsm = computed(() => stateManager.state.fsm)

function getFsm() {
  return fsm.value
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

function bufferStateName(stateId: number, name: string) {
  editingNames[stateId] = name
}

function commitStateName(stateId: number) {
  const current = getFsm()
  const buffered = editingNames[stateId]
  delete editingNames[stateId]

  if (!current) return

  const state = nodes.value.find((s) => s.nodeId === stateId)
  if (!state) return
  if (buffered === undefined) return

  const nextName = buffered.trim() ? buffered.trim() : `q${stateId}`
  const duplicateExists = nodes.value.some(
    (node) => node.nodeId !== stateId && node.name.trim().toLowerCase() === nextName.toLowerCase(),
  )
  const resolvedName = duplicateExists ? state.name : nextName

  // if no effective change was made while editing, don't sync the FSM panel
  if (resolvedName === state.name) return

  renameFsmState(current, stateId, resolvedName)
}
</script>

<template>
  <div class="w-full flex flex-col gap-2 items-center p-2">
    <h1 class="text-xl text-center font-mono">States</h1>

    <table class="flex-auto bg-gray-800 border border-primary table-auto select-none mb-0">
      <thead>
        <tr>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-auto font-mono border-r-4"
          >
            name
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-auto font-mono border-r-4"
          >
            binary index
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="nodes.length === 0">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          />
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          />
        </tr>

        <tr v-else v-for="state in nodes" :key="state.nodeId">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            <input
              :value="
                editingNames[state.nodeId] !== undefined ? editingNames[state.nodeId] : state.name
              "
              maxlength="12"
              class="w-full bg-transparent text-center outline-none hover:bg-gray-700 focus:bg-gray-700 transition-colors duration-100"
              @focus="startEditingName(state.nodeId, state.name)"
              @input="bufferStateName(state.nodeId, ($event.target as HTMLInputElement).value)"
              @blur="commitStateName(state.nodeId)"
              @keydown.enter.prevent="
                commitStateName(state.nodeId)
                ;($event.target as HTMLInputElement)?.blur()
              "
            />
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            {{ state.binaryNodeId ?? '-'.repeat(nodeIdBitCount) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="flex gap-2">
      <button
        class="flex items-center justify-center w-9 h-9 rounded bg-surface-2 border border-surface-3 text-white text-2xl leading-none transition-colors hover:bg-primary hover:border-primary disabled:opacity-30"
        :disabled="nodes.length === 0"
        title="Remove state"
        @click="decreaseStateCount"
      >
        −
      </button>
      <button
        class="flex items-center justify-center w-9 h-9 rounded bg-surface-2 border border-surface-3 text-white text-2xl leading-none transition-colors hover:bg-primary hover:border-primary disabled:opacity-30"
        :disabled="nodes.length >= stateLimit"
        title="Add state"
        @click="addStateRow"
      >
        +
      </button>
    </div>
  </div>
</template>
