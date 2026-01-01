<script setup lang="ts">
import { useAutomatonState } from '@/states/automatonState'
import { ref, nextTick } from 'vue'

const {
  automaton,
  states,
  transitions,
  binaryIDs
} = useAutomatonState()

const editingStateId = ref<number | null>(null)
const editingTransitionId = ref<number | null>(null)
const tempName = ref('')

// mutation of global state on edit
function updateStateName(stateId: number, newName: string) {
  const stateIndex = automaton.value.states.findIndex(s => s.id === stateId)
  if (stateIndex < 0) {
    automaton.value.states[stateIndex].name = newName
  }
  editingStateId.value = null
}

function deleteState(stateId: number) {
  automaton.value.states = automaton.value.states.filter(s => s.id !== stateId)
  automaton.value.transitions = automaton.value.transitions.filter(t =>
    Number(t.from) !== stateId && Number(t.to) !== stateId
  )
}

function updateTransitionLabel(transId: number, newLabel: string) {
  const transIndex = automaton.value.transitions.findIndex(t => t.id === transId)
  if (transIndex !== -1) {
    automaton.value.transitions[transIndex].label = newLabel
  }
  editingTransitionId.value = null
}

function deleteTransition(transId: number) {
  automaton.value.transitions = automaton.value.transitions.filter(t => t.id !== transId)
}

function startEditState(stateId: number, currentName: string) {
  editingStateId.value = stateId
  tempName.value = currentName
  nextTick(() => {
    // opt: focus on input?
  })
}

function startEditTransition(transId: number, currentLabel: string) {
  editingTransitionId.value = transId
  tempName.value = currentLabel
  nextTick(() => {
    // opt: focus on input?
  })
}


</script>

<template>
  <div class="w-full h-full overflow-auto flex flex-col justify-center gap-10 items-center">
    <!-- STATES Table -->
    <table v-if="states.length" class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none mb-8">
      <thead>
        <tr>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4">ID</th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4">Name</th>
          <th class="w-16 border-b-4 border-primary bg-gray-800"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(state, index) in states" :key="state.id">
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4">
            {{ binaryIDs[index] }}
          </td>
          <td class="px-3 py-4 border-b border-primary border-r-4 align-middle">
            <!-- edit mode (double click) -->
            <input
              v-if="editingStateId === state.id"
              v-model="tempName"
              class="bg-gray-700 text-mono text-lg w-full text-center p-1 rounded border border-primary focus:border-primary-light focus:outline-none"
              @keyup.enter="updateStateName(state.id as number, tempName)"
              @blur="updateStateName(state.id as number, tempName)"
              autofocus
            />
            <!-- normal mode -->
            <span
              v-else
              class="text-lg font-mono text-center cursor-pointer hover:bg-gray-700 p-1 rounded block transition-all duration-100"
              @dblclick="startEditState(state.id as number, state.name)"
            >
              {{ state.name }}
            </span>
          </td>
          <td class="text-center py-4">
            <button
              @click="deleteState(state.id as number)"
              class="text-red-400 hover:text-red-200 px-2 py-1 hover:bg-red-900 rounded transition-all duration-100"
              title="Delete State"
            >
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- TRANSITIONS Table -->
    <table v-if="transitions?.length" class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none">
      <thead>
        <tr>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4">ID</th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4">From</th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-28 font-mono">Label</th>
          <th class="w-16 border-b-4 border-primary bg-gray-800"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transition in transitions" :key="transition.id">
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4">
            {{ transition.id }}
          </td>
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4">
            {{ transition.from }}
          </td>
          <td class="px-3 py-4 border-b border-primary align-middle">
            <!-- edit mode -->
            <input
              v-if="editingTransitionId === transition.id"
              v-model="tempName"
              class="bg-gray-700 text-mono text-lg w-full text-center p-1 rounded border border-primary focus:border-primary-light focus:outline-none"
              @keyup.enter="updateTransitionLabel(transition.id as number, tempName)"
              @blur="updateTransitionLabel(transition.id as number, tempName)"
              autofocus
            />
            <!-- normal mode -->
            <span
              v-else
              class="text-lg font-mono text-center cursor-pointer hover:bg-gray-700 p-1 rounded block transition-all duration-100"
              @dblclick="startEditTransition(transition.id as number, transition.label)"
            >
              {{ transition.label }}
            </span>
          </td>
          <td class="text-center py-4">
            <button
              @click="deleteTransition(transition.id as number)"
              class="text-red-400 hover:text-red-200 px-2 py-1 hover:bg-red-900 rounded transition-all duration-100"
              title="Delete Transition"
            >
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else class="p-4 text-gray-500 text-sm">no data! please paint a cool state machine</div>
  </div>
</template>
