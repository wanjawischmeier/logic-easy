<script setup lang="ts">
import { AutomatonProject, type AutomatonState } from '@/projects/automaton/AutomatonProject'
import { stateManager } from '@/projects/stateManager'
import { onMounted, reactive } from 'vue'

const editingNames = reactive<Record<number, string | undefined>>({})

/**
 * aktuelle Probleme:
 * - bei add state / transition in editor werden nur die neuen transitions auch angezeigt, nicht die volle tabelle
 * - ... allerdings wird auch der reine table -> editor export etwas hässlich
 * - die table kann mehr kanten erlauben als der editor, da dieser mit mehreren gleichen kanten überfordert ist
 * - todo: in editor kanten mit x / x ausblenden können
 * - todo: eingabeprüfungen
 */

/**
 * manage central data
 */

/**
 * TODO:
 * 1. bei add state automatisch 2^|x| tabellenspalten je mit allen möglichen inputs des zustands hinzufügen,
 * hier per default für next state don´t care
 * 2. bei add new state in editor ebenfalls dies hinzufügen
 * 3. add neue kante in tabelle entfernen (automatisch hinzufügen)
 * 4. bei neuer kante in table a) direktes benennen nötig machen und b) nicht 2x selben input erlauben
 * 5. auto layout button unten in editor setzen
 * 6. initial state wechselbar machen
 */

// bundle all reactive data of automaton
const { states, transitions, binaryIDs, binaryTransitions, bitNumber, inputBits, outputBits } =
  AutomatonProject.useState()

// access to global automaton state
const getAutomaton = (): AutomatonState => {
  if (!stateManager.state.automaton) {
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: 'mealy',
    }
  }
  return stateManager.state.automaton as AutomatonState
}

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
  const usedIds = new Set(states.value.map((state) => state.id))
  let nextId = 0

  while (usedIds.has(nextId)) {
    nextId += 1
  }

  return nextId
}

function getRequiredStateBitsFromCount(stateCount: number): number {
  const maxIndex = Math.max(stateCount - 1, 0)
  return Math.max(maxIndex.toString(2).length, 1)
}

function getDefaultToPatternForStateCount(stateCount: number): string {
  return 'x'.repeat(getRequiredStateBitsFromCount(stateCount))
}

function getNextTransitionId(): number {
  const automaton = getAutomaton()
  const maxTransitionId = Math.max(
    -1,
    ...(automaton.transitions || []).map((transition) => transition.id),
  )
  return maxTransitionId + 1
}

function resolveConcreteToPatternsForCurrentStates() {
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

/**
 * helper functions to edit table in table panel
 */

function addStateRow() {
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
  const automaton = getAutomaton()
  automaton.states = automaton.states.map((state) => ({
    ...state,
    initial: state.id === stateId,
  }))
  AutomatonProject.setLastUpdateSource('table')
}

function startEditingName(stateId: number, currentName: string) {
  editingNames[stateId] = currentName
}

function bufferStateName(stateId: number, name: string) {
  editingNames[stateId] = name
}

function commitStateName(stateId: number) {
  const buffered = editingNames[stateId]
  delete editingNames[stateId]

  const name = buffered?.trim() ? buffered : `q${stateId}`
  const automaton = getAutomaton()
  automaton.states = automaton.states.map((state) =>
    state.id === stateId ? { ...state, name } : state,
  )
  AutomatonProject.setLastUpdateSource('table')
}

function removeStateRow(stateId: number) {
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
  if (states.value.length === 0) return
  const lastStateId = Math.max(...states.value.map((state) => state.id))
  removeStateRow(lastStateId)
}

function increaseInputBits() {
  const automaton = getAutomaton()
  const nextInputBits = inputBits.value + 1

  automaton.transitions = automaton.transitions.map((transition) => ({
    ...transition,
    input: (transition.input ?? '').padStart(nextInputBits, '0').slice(-nextInputBits),
  }))

  AutomatonProject.setLastUpdateSource('table')
}

function decreaseInputBits() {
  const automaton = getAutomaton()
  if (inputBits.value <= 1) return

  const nextInputBits = inputBits.value - 1
  const mergedTransitions = new Map<string, AutomatonState['transitions'][number]>()

  for (const transition of automaton.transitions) {
    const normalizedInput = (transition.input ?? '').padStart(inputBits.value, '0')
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

function increaseOutputBits() {
  const automaton = getAutomaton()
  const nextOutputBits = outputBits.value + 1

  automaton.transitions = automaton.transitions.map((transition) => ({
    ...transition,
    output: normalizeBitsToX(transition.output, nextOutputBits).slice(0, nextOutputBits),
  }))

  AutomatonProject.setLastUpdateSource('table')
}

function decreaseOutputBits() {
  const automaton = getAutomaton()
  if (outputBits.value <= 1) return

  const nextOutputBits = outputBits.value - 1

  automaton.transitions = automaton.transitions.map((transition) => ({
    ...transition,
    output: normalizeBitsToX(transition.output, outputBits.value).slice(0, nextOutputBits),
  }))

  AutomatonProject.setLastUpdateSource('table')
}

/**
 * helper functions to display automaton data correctly in table
 */
// compute amount of necessary bits (x) to be displayed
function normalizeBitsToX(value: string | undefined, length: number | string): string {
  const normalizedLength = Math.max(Number(length) || 0, 0)
  return (value ?? '').padEnd(normalizedLength, 'x')
}

// remap "to" if Z^n+1 is edited
function updateToFromBits(idx: number, i: number, bit: '0' | '1' | 'x') {
  const tr = transitions.value[idx]
  if (!tr) return

  AutomatonProject.setLastUpdateSource('table')

  const current = (binaryTransitions.value[idx]?.toBinary ?? '').padStart(bitNumber.value, 'x')
  const chars = current.split('')
  chars[i] = bit
  const newBits = chars.join('')

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
  const current = (binaryTransitions.value[idx]?.toBinary ?? '')
    .padStart(bitNumber.value, 'x')
    .charAt(i)
  const nextBit = current === 'x' ? '0' : current === '0' ? '1' : 'x'
  updateToFromBits(idx, i, nextBit)
}

function toggleOutputBit(idx: number, i: number) {
  const transition = transitions.value[idx]
  if (!transition) return

  const current = normalizeBitsToX(transition.output, outputBits.value)
  const chars = current.split('')
  const bit = chars[i]

  chars[i] = bit === '0' ? '1' : bit === '1' ? 'x' : '0'
  transition.output = chars.join('')
  AutomatonProject.setLastUpdateSource('table')
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
            initial
          </th>
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
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          />
        </tr>

        <!-- normal rows -->
        <tr v-else v-for="(state, index) in states" :key="state.id">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            <button
              class="w-full px-2 py-0 select-none hover:bg-gray-700 transition-colors duration-100"
              @click="setInitialState(state.id)"
            >
              {{ state.initial ? '1' : '0' }}
            </button>
          </td>
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
    <!-- Toolbar -->
    <div class="flex items-start mb-1 text-sm gap-6">
      <!-- States pill group -->
      <div class="flex flex-col items-center gap-1 text-on-surface-variant text-xs select-none mr-4">
        <span class="text-gray-400 font-mono">states</span>
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

      <!-- Input bits pill group -->
      <div class="flex flex-col items-center gap-1 text-on-surface-variant text-xs select-none mr-4">
        <span class="text-gray-400 font-mono">input bits</span>
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
            title="Add input bit"
            @click="increaseInputBits"
          >
            +
          </button>
        </div>
      </div>

      <!-- Output bits pill group -->
      <div class="flex flex-col items-center gap-1 text-on-surface-variant text-xs select-none">
        <span class="text-gray-400 font-mono">output bits</span>
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
            title="Add output bit"
            @click="increaseOutputBits"
          >
            +
          </button>
        </div>
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
              {{ normalizeBitsToX(transitions[idx]!.input, inputBits).charAt(Number(i)) }}
            </td>

            <!-- Z^(n+1) bits (edit) -->
            <td
              v-for="(_, i) in bitNumber"
              :key="transitionView.id + '-to-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 transition-colors duration-100"
              :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
              @click="toggleToBit(idx, i)"
            >
              {{
                (transitionView.toBinary ?? '').padStart(bitNumber, 'x').charAt(Number(i)) || 'x'
              }}
            </td>

            <!-- Y^n bits (edit) -->
            <td
              v-for="(_, i) in outputBits"
              :key="transitionView.id + '-out-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0 select-none hover:bg-gray-700 transition-colors duration-100"
              :class="i === outputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
              @click="toggleOutputBit(idx, i)"
            >
              {{ normalizeBitsToX(transitions[idx]!.output, outputBits).charAt(Number(i)) }}
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
