<!--

# State Table
*State table component for automata*.
- includes both 'state table' and 'transitions table'.
  - state table: name and ID of each state node
  - transitions table: start state node, end state node, input (only if automaton type
   is 'mealy'), output of each transition

## Goals
Provide a direct table-based editing experience for automaton states and transitions.
- Enable fast edits for state metadata and transition bits.
- Keep edits aligned with the shared automaton model.
- Mark updates so downstream sync can resolve origin correctly.

## Functionality
- Render state and transition tables.
- Handle user edits for:
  - state count and naming
  - initial/final settings
  - input/output bit-width changes
  - next-state and output bit toggles
- Inhibit prohibited user input and handle it smoothly.
- Write updates into shared automaton state.

# Dependencies
- Reads and derives data from automaton domain state.
- Writes through global app state.
- Relies on automaton sync coordination for editor propagation.
This component owns interaction-heavy table editing UI. Therefore, it should not own
iframe message transport or project lifecycle concerns. Its only purpose is to display the
automaton data correctly and to sync with the central automaton state.

-->

<script setup lang="ts">
import { AutomatonProject, type AutomatonState } from '@/projects/automaton/AutomatonProject'
import { editBits, normalizeBits } from '@/automatonfix-copy/bitOperations'
import { onMounted, reactive, ref } from 'vue'

const editingNames = reactive<Record<number, string | undefined>>({})
const MAX_TRANSITION_BITS = 10
const editableCellRefs = ref<(HTMLElement | null)[][]>([])

/*
 * manage central data
 */

// bundle all reactive data of automaton
const { states, transitions, binaryIDs, binaryTransitions, bitNumber, inputBits, outputBits } =
  AutomatonProject.useState()

// access to global automaton state
const getAutomaton = (): AutomatonState => AutomatonProject.ensureAutomatonState()

// initial default transition
onMounted(() => {
  const automaton = getAutomaton()
  if (automaton.states.length > 0 && automaton.transitions?.length === 0) {
    const from = automaton.states?.[0]?.id ?? 0
    const toPattern = getDefaultToPatternForStateCount(automaton.states.length)
    automaton.transitions = [
      {
        id: 0,
        from,
        to: -1,
        toPattern,
        input: '0',
        output: 'x',
      },
    ]
    AutomatonProject.setLastUpdateSource('table')
  }
})

function getNextStateId(): number {
  // returns the smallest free numeric state id
  const usedIds = new Set(states.value.map((state) => state.id))
  let nextId = 0

  while (usedIds.has(nextId)) {
    nextId += 1
  }

  return nextId
}

function getRequiredStateBitsFromCount(stateCount: number): number {
  // computes amount of bits required to represent all state indices
  const maxIndex = Math.max(stateCount - 1, 0)
  return Math.max(maxIndex.toString(2).length, 1)
}

function getDefaultToPatternForStateCount(stateCount: number): string {
  // builds default wildcard target pattern for the current state count
  return 'x'.repeat(getRequiredStateBitsFromCount(stateCount))
}

function getNextTransitionId(): number {
  // returns the next unique transition id based on current transitions
  const automaton = getAutomaton()
  const maxTransitionId = Math.max(
    -1,
    ...(automaton.transitions || []).map((transition) => transition.id),
  )
  return maxTransitionId + 1
}

function resolveConcreteToPatternsForCurrentStates() {
  // resolves concrete binary target patterns to concrete state ids when possible
  const automaton = getAutomaton()

  automaton.transitions = automaton.transitions.map((transition) => {
    if (transition.to >= 0) {
      return transition
    }

    const pattern = String(transition.toPattern ?? '')
    if (!pattern || pattern.includes('x')) {
      return transition
    }

    const targetIndex = parseInt(pattern, 2)
    if (Number.isNaN(targetIndex)) {
      return transition
    }

    const targetState = automaton.states[targetIndex]
    if (!targetState) {
      return transition
    }

    return {
      ...transition,
      to: targetState.id,
      toPattern: undefined,
    }
  })
}

/*
 * helper functions to edit table in table panel
 */

function addStateRow() {
  // adds a new state and initializes all missing transitions for that state
  const automaton = getAutomaton()
  const nextId = getNextStateId()
  const nextStatePattern = getDefaultToPatternForStateCount(automaton.states.length + 1)
  const hasInitialState = automaton.states.some((state) => state.initial)

  // set attributes and add new state
  automaton.states.push({
    id: nextId,
    name: `q${nextId}`,
    initial: !hasInitialState,
    final: false,
  })

  // compute amount of possible transitions (2^n) per state
  const combPerState = 1 << inputBits.value
  let nextTransitionId = getNextTransitionId()

  for (let xIndex = 0; xIndex < combPerState; xIndex++) {
    const xBits = xIndex.toString(2).padStart(inputBits.value, '0')
    automaton.transitions.push({
      id: nextTransitionId,
      from: nextId,
      to: -1,
      toPattern: nextStatePattern,
      input: xBits,
      output: 'x'.repeat(outputBits.value),
    })
    nextTransitionId += 1
  }

  resolveConcreteToPatternsForCurrentStates()

  AutomatonProject.setLastUpdateSource('table')
}

function setInitialState(stateId: number) {
  // marks one state as initial and resets all other initial flags
  const automaton = getAutomaton()
  automaton.states = automaton.states.map((state) => ({
    ...state,
    initial: state.id === stateId,
  }))
  AutomatonProject.setLastUpdateSource('table')
}

function startEditingName(stateId: number, currentName: string) {
  // starts buffered name editing for a specific state row
  editingNames[stateId] = currentName
}

function bufferStateName(stateId: number, name: string) {
  // updates buffered input while user types a state name
  editingNames[stateId] = name
}

function commitStateName(stateId: number) {
  // applies buffered state name (including fallback)
  const buffered = editingNames[stateId]
  delete editingNames[stateId]

  const automaton = getAutomaton()
  const previousName = automaton.states.find((state) => state.id === stateId)?.name ?? `q${stateId}`
  const requestedName = buffered?.trim() ? buffered.trim() : `q${stateId}`
  const duplicateExists = automaton.states.some(
    (state) =>
      state.id !== stateId && state.name.trim().toLowerCase() === requestedName.toLowerCase(),
  )
  const name = duplicateExists ? previousName : requestedName

  automaton.states = automaton.states.map((state) =>
    state.id === stateId ? { ...state, name } : state,
  )
  AutomatonProject.setLastUpdateSource('table')
}

function removeStateRow(stateId: number) {
  // removes one state and remaps all affected transitions and state ids
  const automaton = getAutomaton()
  const remainingStates = automaton.states
    .filter((state) => state.id !== stateId)
    .sort((left, right) => left.id - right.id)
  const oldToNewId = new Map<number, number>()

  remainingStates.forEach((state, index) => {
    oldToNewId.set(state.id, index)
  })

  automaton.states = remainingStates.map((state, index) => ({
    ...state,
    id: index,
  }))

  const defaultToPattern = getDefaultToPatternForStateCount(automaton.states.length)

  automaton.transitions = automaton.transitions
    .filter((transition) => transition.from !== stateId)
    .map((transition) => {
      const remappedFrom = oldToNewId.get(transition.from)
      if (remappedFrom === undefined) {
        return null
      }

      const remappedTo = oldToNewId.get(transition.to)
      const hasConcreteTarget = transition.to >= 0 && remappedTo !== undefined

      return {
        ...transition,
        from: remappedFrom,
        to: hasConcreteTarget ? remappedTo : -1,
        toPattern: hasConcreteTarget ? undefined : defaultToPattern,
      }
    })
    .filter((transition) => transition !== null)

  Object.keys(editingNames).forEach((key) => {
    delete editingNames[Number(key)]
  })

  if (automaton.states.length > 0 && !automaton.states.some((state) => state.initial)) {
    const firstRemainingState = automaton.states[0]!
    automaton.states[0] = {
      ...firstRemainingState,
      initial: true,
    }
  }

  AutomatonProject.setLastUpdateSource('table')
}

function decreaseStateCount() {
  // removes the state with the currently highest id
  if (states.value.length === 0) return
  const lastStateId = Math.max(...states.value.map((state) => state.id))
  removeStateRow(lastStateId)
}

function increaseInputBits() {
  // increases transition input width and fills newly required transition rows
  const automaton = getAutomaton()
  if (inputBits.value >= MAX_TRANSITION_BITS) return
  const nextInputBits = inputBits.value + 1

  const normalizedTransitions = automaton.transitions.map((transition) => ({
    ...transition,
    input: normalizeBits(transition.input, nextInputBits, '0', 'left'),
  }))

  const existingByKey = new Map<string, AutomatonState['transitions'][number]>()
  for (const transition of normalizedTransitions) {
    existingByKey.set(`${transition.from}:${transition.input}`, transition)
  }

  const defaultToPattern = getDefaultToPatternForStateCount(automaton.states.length)
  let nextTransitionId = getNextTransitionId()

  for (const state of automaton.states) {
    for (let inputIndex = 0; inputIndex < 1 << nextInputBits; inputIndex++) {
      const input = inputIndex.toString(2).padStart(nextInputBits, '0')
      const key = `${state.id}:${input}`
      if (existingByKey.has(key)) continue

      existingByKey.set(key, {
        id: nextTransitionId,
        from: state.id,
        to: -1,
        toPattern: defaultToPattern,
        input,
        output: 'x'.repeat(outputBits.value),
      })
      nextTransitionId += 1
    }
  }

  automaton.transitions = Array.from(existingByKey.values()).sort((left, right) => {
    if (left.from !== right.from) return left.from - right.from
    return left.input.localeCompare(right.input)
  })

  AutomatonProject.setLastUpdateSource('table')
}

function decreaseInputBits() {
  // decreases input width by merging transitions that differ only in removed bit
  const automaton = getAutomaton()
  if (inputBits.value <= 1) return

  const nextInputBits = inputBits.value - 1
  const mergedTransitions = new Map<string, AutomatonState['transitions'][number]>()

  for (const transition of automaton.transitions) {
    const normalizedInput = normalizeBits(transition.input, inputBits.value, '0', 'left')
    const removedBit = normalizedInput.charAt(0)
    const nextInput = normalizedInput.slice(-nextInputBits)
    const key = `${transition.from}:${nextInput}`
    const existingTransition = mergedTransitions.get(key)

    if (!existingTransition || removedBit === '0') {
      mergedTransitions.set(key, {
        ...transition,
        input: nextInput,
      })
    }
  }

  automaton.transitions = Array.from(mergedTransitions.values())

  AutomatonProject.setLastUpdateSource('table')
}

function updateOutputBitWidth(nextOutputBits: number) {
  const automaton = getAutomaton()
  automaton.transitions = automaton.transitions.map((transition) => ({
    ...transition,
    output: normalizeBits(transition.output, nextOutputBits, 'x', 'right'),
  }))
  AutomatonProject.setLastUpdateSource('table')
}

function increaseOutputBits() {
  // increases output width and pads transition outputs with wildcard bits
  if (outputBits.value >= MAX_TRANSITION_BITS) return
  updateOutputBitWidth(outputBits.value + 1)
}

function decreaseOutputBits() {
  // decreases output width by truncating outputs to new bit count
  if (outputBits.value <= 1) return
  updateOutputBitWidth(outputBits.value - 1)
}

/*
 * helper functions to display automaton data correctly in table
 */
// compute amount of necessary bits (x) to be displayed
// Inline normalizeBits used in template; helper removed to reduce duplication.

// remap "to" if Z^n+1 is edited
function updateToFromBits(idx: number, i: number, bit: '0' | '1' | 'x') {
  const tr = transitions.value[idx]
  if (!tr) return

  AutomatonProject.setLastUpdateSource('table')

  const newBits = editBits(
    binaryTransitions.value[idx]?.toBinary,
    bitNumber.value,
    'x',
    'left',
    (chars) => {
      if (i >= 0 && i < chars.length) chars[i] = bit
    },
  )

  if (newBits.includes('x')) {
    tr.to = -1
    tr.toPattern = newBits
    return
  }

  const newIndex = parseInt(newBits, 2)
  if (Number.isNaN(newIndex)) return

  const targetState = states.value[newIndex]
  if (!targetState) {
    tr.to = -1
    tr.toPattern = newBits
    return
  }

  tr.to = targetState.id
  tr.toPattern = undefined
}

function toggleToBit(idx: number, i: number) {
  // toggles one next-state bit: x -> 0 -> 1 -> x
  const current = (binaryTransitions.value[idx]?.toBinary ?? '')
    .padStart(bitNumber.value, 'x')
    .charAt(i)
  const nextBit = current === 'x' ? '0' : current === '0' ? '1' : 'x'
  updateToFromBits(idx, i, nextBit)
}

function toggleOutputBit(idx: number, i: number) {
  // toggles one output bit: 0 -> 1 -> x -> 0
  const transition = transitions.value[idx]
  if (!transition) return

  transition.output = editBits(transition.output, outputBits.value, 'x', 'right', (chars) => {
    if (i < 0 || i >= chars.length) return
    const bit = chars[i]
    chars[i] = bit === '0' ? '1' : bit === '1' ? 'x' : '0'
  })
  AutomatonProject.setLastUpdateSource('table')
}

function setEditableCellRef(el: HTMLElement | null, rowIdx: number, colIdx: number) {
  if (!editableCellRefs.value[rowIdx]) {
    editableCellRefs.value[rowIdx] = []
  }

  editableCellRefs.value[rowIdx]![colIdx] = el
}

function focusEditableCell(rowIdx: number, colIdx: number) {
  const maxRow = binaryTransitions.value.length - 1
  const maxCol = bitNumber.value + outputBits.value - 1
  if (maxRow < 0 || maxCol < 0) return

  const targetRow = Math.max(0, Math.min(maxRow, rowIdx))
  const targetCol = Math.max(0, Math.min(maxCol, colIdx))
  editableCellRefs.value[targetRow]?.[targetCol]?.focus()
}

function toggleEditableCell(rowIdx: number, colIdx: number) {
  if (colIdx < bitNumber.value) {
    toggleToBit(rowIdx, colIdx)
    return
  }

  toggleOutputBit(rowIdx, colIdx - bitNumber.value)
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
      toggleEditableCell(rowIdx, colIdx)
      return
    default:
      return
  }
}
</script>

<template>
  <div class="w-full h-full overflow-auto flex flex-col gap-4 items-center p-4">
    <h1 class="text-xl font-mono self-start">States</h1>
    <!-- STATES TABLE-->
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
        <!-- clear row for no data -->
        <tr v-if="states.length === 0">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          />
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          />
        </tr>

        <!-- normal rows -->
        <tr v-else v-for="(state, index) in states" :key="state.id">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            <input
              :value="editingNames[state.id] !== undefined ? editingNames[state.id] : state.name"
              class="w-full bg-transparent text-center outline-none hover:bg-gray-700 focus:bg-gray-700 transition-colors duration-100"
              @focus="startEditingName(state.id, state.name)"
              @input="bufferStateName(state.id, ($event.target as HTMLInputElement).value)"
              @blur="commitStateName(state.id)"
            />
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            {{ binaryIDs[index] }}
          </td>
        </tr>
      </tbody>
    </table>
    <!-- toolbar -->
    <div class="flex items-start mb-0.5 text-xs gap-3 flex-wrap">
      <!-- state number select -->
      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">states</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="states.length === 0"
            title="Remove state"
            @click="decreaseStateCount"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            states.length
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

      <!-- input bits select -->
      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">input bits</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="inputBits <= 1"
            title="Remove input bit"
            @click="decreaseInputBits"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            inputBits
          }}</span>
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors"
            :disabled="inputBits >= MAX_TRANSITION_BITS"
            title="Add input bit"
            @click="increaseInputBits"
          >
            +
          </button>
        </div>
      </div>

      <!-- output bits select -->
      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">output bits</span>
        <div
          class="inline-flex items-center rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors p-0.5 gap-0.5"
        >
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors disabled:opacity-30"
            :disabled="outputBits <= 1"
            title="Remove output bit"
            @click="decreaseOutputBits"
          >
            −
          </button>
          <span class="px-2 py-1 font-mono text-white tabular-nums min-w-6 text-center">{{
            outputBits
          }}</span>
          <button
            class="px-2.5 py-1 rounded-xs font-mono text-white hover:bg-surface-3 transition-colors"
            :disabled="outputBits >= MAX_TRANSITION_BITS"
            title="Add output bit"
            @click="increaseOutputBits"
          >
            +
          </button>
        </div>
      </div>

      <!-- Initial state select -->
      <div class="flex flex-col items-center gap-0.5 text-on-surface-variant text-xs select-none">
        <span class="text-gray-500 font-mono text-[11px] leading-none">initial state</span>
        <select
          class="rounded bg-surface-2 border border-surface-3 hover:border-primary transition-colors px-2 py-1.5 font-mono text-white text-xs cursor-pointer outline-none disabled:opacity-30"
          :disabled="states.length === 0"
          :value="states.find((s) => s.initial)?.id ?? ''"
          @change="setInitialState(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="state in states" :key="state.id" :value="state.id">
            {{ state.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- TRANSITIONS TABLE-->
    <div v-if="states.length >= 1" class="gap-4 items-center text-center">
      <h1 class="text-center py-4 mt-6 text-xl font-mono">Transitions</h1>

      <table
        class="mb-4 flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
      >
        <thead>
          <tr>
            <th
              class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
              :colspan="bitNumber"
            >
              first state
            </th>
            <th
              class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
              :colspan="inputBits"
            >
              input
            </th>
            <th
              class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
              :colspan="bitNumber"
            >
              next state
            </th>
            <th
              class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono border-r-4"
              :colspan="outputBits"
            >
              output
            </th>
          </tr>
          <tr>
            <!-- Z^n bits -->
            <th
              v-for="i in bitNumber"
              :key="'z-from-' + i"
              class="px-0 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
              :class="i === bitNumber ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <vue-latex :expression="`Z_{${bitNumber - i}}^n`" />
            </th>

            <!-- X^n bits -->
            <th
              v-for="i in inputBits"
              :key="'x-' + i"
              class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
              :class="i === inputBits ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <vue-latex :expression="`X_{${inputBits - i}}^n`" />
            </th>

            <!-- Z^(n+1) bits -->
            <th
              v-for="i in bitNumber"
              :key="'z-to-' + i"
              class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
              :class="i === bitNumber ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <vue-latex :expression="`Z_{${bitNumber - i}}^{(n+1)}`" />
            </th>

            <!-- Y^n bits -->
            <th
              v-for="i in outputBits"
              :key="'y-' + i"
              class="px-1 py-0.5 text-gray-400 border-b-4 border-primary bg-gray-800"
              :class="i === outputBits ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <vue-latex :expression="`Y_{${outputBits - i}}^n`" />
            </th>
            <th class="border-b-4 border-primary bg-gray-800" />
          </tr>
        </thead>

        <tbody>
          <tr v-for="(transitionView, idx) in binaryTransitions" :key="transitionView.id">
            <!-- Z^n bits (read only) -->
            <td
              v-for="(_, i) in bitNumber"
              :key="transitionView.id + '-from-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
              :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            >
              {{ (transitionView.fromBinary ?? '').charAt(Number(i)) || '0' }}
            </td>

            <!-- X^n bits (read only) -->
            <td
              v-for="(_, i) in inputBits"
              :key="transitionView.id + '-in-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
              :class="i === inputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            >
              {{
                normalizeBits(transitions[idx]!.input, inputBits, 'x', 'right').charAt(Number(i))
              }}
            </td>

            <!-- Z^(n+1) bits (edit) -->
            <td
              v-for="(_, i) in bitNumber"
              :key="transitionView.id + '-to-' + i"
              :ref="(el) => setEditableCellRef(el as HTMLElement | null, idx, Number(i))"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 focus:bg-gray-700 focus:outline-none transition-colors duration-100"
              :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
              tabindex="0"
              @click="toggleToBit(idx, i)"
              @keydown="handleEditableCellKeydown($event, idx, Number(i))"
            >
              {{
                (transitionView.toBinary ?? '').padStart(bitNumber, 'x').charAt(Number(i)) || 'x'
              }}
            </td>

            <!-- Y^n bits (edit) -->
            <td
              v-for="(_, i) in outputBits"
              :key="transitionView.id + '-out-' + i"
              :ref="
                (el) => setEditableCellRef(el as HTMLElement | null, idx, bitNumber + Number(i))
              "
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 focus:bg-gray-700 focus:outline-none transition-colors duration-100"
              :class="i === outputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
              tabindex="0"
              @click="toggleOutputBit(idx, i)"
              @keydown="handleEditableCellKeydown($event, idx, bitNumber + Number(i))"
            >
              {{
                normalizeBits(transitions[idx]!.output, outputBits, 'x', 'right').charAt(Number(i))
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="text-sm font-mono text-gray-400 text-center">
      Please add states to reveal the transition table.
    </div>
  </div>
</template>
