<script setup lang="ts">
import { computed, reactive } from 'vue'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'
import {
  addStateRow as addFsmStateRow,
  getStateCountLimit,
  removeStateRow as removeFsmStateRow,
  renameState as renameFsmState,
  setInitialState as setFsmInitialState,
  setInputBitCount as setFsmInputBitCount,
  setOutputBitCount as setFsmOutputBitCount,
} from '@/projects/state-machine/FsmProject'

const { nodes, inputBitCount, outputBitCount, nodeIdBitCount, fsmModel } = FsmProject.useState()

const editingNames = reactive<Record<number, string | undefined>>({})

const fsm = computed(() => stateManager.state.fsm)

function getFsm() {
  return fsm.value
}

function addStateRow() {
  const current = getFsm()
  if (!current) return

  addFsmStateRow(current, fsmModel.value)
}

function removeStateRow(stateId: number) {
  const current = getFsm()
  if (!current) return

  removeFsmStateRow(current, stateId)

  delete editingNames[stateId]
}

function decreaseStateCount() {
  if (nodes.value.length === 0) return
  const lastStateId = Math.max(...nodes.value.map((state) => state.nodeId))
  removeStateRow(lastStateId)
}

function setInitialState(stateId: number) {
  const current = getFsm()
  if (!current) return

  setFsmInitialState(current, stateId)
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

  renameFsmState(current, stateId, buffered)
}

function updateInputBitWidth(nextInputBits: number) {
  const current = getFsm()
  if (!current) return

  setFsmInputBitCount(current, nextInputBits)
}

function increaseInputBits() {
  if (inputBitCount.value >= getStateCountLimit()) return
  updateInputBitWidth(inputBitCount.value + 1)
}

function decreaseInputBits() {
  if (inputBitCount.value <= 1) return
  updateInputBitWidth(inputBitCount.value - 1)
}

function updateOutputBitWidth(nextOutputBits: number) {
  const current = getFsm()
  if (!current) return

  setFsmOutputBitCount(current, nextOutputBits, fsmModel.value)
}

function increaseOutputBits() {
  if (outputBitCount.value >= getStateCountLimit()) return
  updateOutputBitWidth(outputBitCount.value + 1)
}

function decreaseOutputBits() {
  if (outputBitCount.value <= 1) return
  updateOutputBitWidth(outputBitCount.value - 1)
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
            name of state
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
              class="w-full bg-transparent text-center outline-none hover:bg-gray-700 focus:bg-gray-700 transition-colors duration-100"
              @focus="startEditingName(state.nodeId, state.name)"
              @input="bufferStateName(state.nodeId, ($event.target as HTMLInputElement).value)"
              @blur="commitStateName(state.nodeId)"
            />
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            {{ state.binaryNodeId ?? 'x'.repeat(nodeIdBitCount) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="flex items-start mb-0 text-xs gap-2 flex-wrap">
      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">states</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="nodes.length === 0"
            title="Remove state"
            @click="decreaseStateCount"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            nodes.length
          }}</span>
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors"
            title="Add state"
            @click="addStateRow"
          >
            +
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">input bits</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="inputBitCount <= 1"
            title="Remove input bit"
            @click="decreaseInputBits"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            inputBitCount
          }}</span>
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors"
            :disabled="inputBitCount >= 10"
            title="Add input bit"
            @click="increaseInputBits"
          >
            +
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">output bits</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="outputBitCount <= 1"
            title="Remove output bit"
            @click="decreaseOutputBits"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            outputBitCount
          }}</span>
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors"
            :disabled="outputBitCount >= 10"
            title="Add output bit"
            @click="increaseOutputBits"
          >
            +
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">initial state</span>
        <select
          class="rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors px-2 py-1.5 font-mono text-white text-xs cursor-pointer outline-none disabled:opacity-30"
          :disabled="nodes.length === 0"
          :value="nodes.find((s) => s.isInitial)?.nodeId ?? ''"
          @change="setInitialState(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="state in nodes" :key="state.nodeId" :value="state.nodeId">
            {{ state.name }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
