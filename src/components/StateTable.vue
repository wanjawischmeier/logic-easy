<script setup lang="ts">
import {
  AutomatonProject,
  type AutomatonState,
  setLastUpdateSource,
} from '@/projects/automaton/AutomatonProject'
import { stateManager } from '@/projects/stateManager'

const { states, transitions, binaryIDs, binaryTransitions, bitNumber, inputBits, outputBits } =
  AutomatonProject.useState()

function getAutomaton(): AutomatonState {
  if (!stateManager.state.automaton) {
    stateManager.state.automaton = {
      states: [],
      transitions: [],
      automatonType: 'mealy',
    }
  }
  return stateManager.state.automaton as AutomatonState
}

// set one clear transition if no transitions exist
const automaton = getAutomaton()
if (!automaton.transitions || automaton.transitions.length === 0) {
  const from = automaton.states?.[0]?.id ?? 0
  const to = automaton.states?.[0]?.id ?? 0
  automaton.transitions = [
    {
      id: 0,
      from,
      to,
      input: '',
      output: 'x',
    },
  ]
}

function addStateRow() {
  const automaton = getAutomaton()
  automaton.states ??= []
  const nextId = automaton.states.length
  automaton.states.push({
    id: nextId,
    name: `q${nextId}`,
    initial: nextId === 0,
    final: false,
  })
}

function addTransitionRow() {
  const automaton = getAutomaton()
  automaton.transitions ??= []
  const nextId = automaton.transitions.length

  const totalBits = bitNumber.value + inputBits.value
  const maxComb = 1 << totalBits
  if (nextId >= maxComb) return

  const global = nextId.toString(2).padStart(totalBits, '0')
  const zBits = global.slice(0, bitNumber.value)
  const xBits = global.slice(bitNumber.value)
  const fromIndex = parseInt(zBits, 2) || 0
  const fromState = automaton.states[fromIndex] ?? automaton.states[0]
  const from = fromState?.id ?? 0

  const defaultState = automaton.states.find((s) => s.id === 0) ?? automaton.states[0]
  const to = defaultState ? defaultState.id : 0

  automaton.transitions.push({
    id: nextId,
    from,
    to,
    input: xBits,
    output: ''.padStart(outputBits.value, 'x'),
  })
  setLastUpdateSource('table')
}

// Hilfsfunktion: Bits auf gegebene Länge mit x auffüllen
function normalizeBitsToX(value: string | undefined, length: number): string {
  const v = value ?? ''
  if (v.length >= length) return v
  return v + 'x'.repeat(length - v.length)
}

// remap bits from Z^n+1 to "transition.to"
function updateToFromBits(idx: number, i: number, bit: '0' | '1' | 'x') {
  const tr = transitions.value[idx]
  if (!tr) return

  // TODO: check if input is allowed (0 or 1 because state cannot be zero)

  setLastUpdateSource('table')

  const current = (binaryTransitions.value[idx]?.toBinary ?? '').padStart(bitNumber.value, '0')
  const chars = current.split('')
  chars[i] = bit
  const newBits = chars.join('')

  const newIndex = parseInt(newBits, 2)
  if (Number.isNaN(newIndex)) return

  const statesArr = states.value
  const targetState = statesArr[newIndex]
  if (!targetState) return

  tr.to = targetState.id
}

function sortTransitionsByZX() {
  const automaton = getAutomaton()
  const tr = automaton.transitions ?? []
  if (!tr.length) return

  const idToBinary = new Map<number | string, string>()
  states.value.forEach((s, idx) => {
    const bin = binaryIDs.value[idx] ?? '0'.padStart(bitNumber.value, '0')
    idToBinary.set(s.id, bin)
  })

  automaton.transitions = [...tr].sort((a, b) => {
    const zA = idToBinary.get(a.from) ?? '0'.padStart(bitNumber.value, '0')
    const zB = idToBinary.get(b.from) ?? '0'.padStart(bitNumber.value, '0')

    const xA = String(a.input ?? '')
    const xB = String(b.input ?? '')

    const keyA = zA + xA
    const keyB = zB + xB
    return keyA.localeCompare(keyB)
  })

  setLastUpdateSource('table')
}
</script>

<template>
  <div class="w-full h-full overflow-auto flex flex-col justify-center gap-4 items-center">
    <h1 class="text-xl font-mono">States</h1>
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
            {{ state.name }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-2 py-0"
          >
            {{ binaryIDs[index] }}
          </td>
        </tr>
      </tbody>
    </table>
    <button class="bg-primary text-xl" @click="addStateRow">+</button>

    <!-- TRANSITIONS TABLE-->
    <div v-if="states.length >= 2" class="gap-4 items-center text-center">
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
              {{ (transitionView.fromBinary ?? '').charAt(i) || '0' }}
            </td>

            <!-- X^n bits (edit) -->
            <td
              v-for="(_, i) in inputBits"
              :key="transitionView.id + '-in-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
              :class="i === inputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <input
                v-if="transitions[idx]"
                :value="normalizeBitsToX(transitions[idx]!.input, inputBits).charAt(i)"
                class="bg-transparent text-center outline-none w-6"
                @input="
                  (e) => {
                    const current = normalizeBitsToX(transitions[idx]!.input, inputBits)
                    const chars = current.split('')
                    const v = (e.target as HTMLInputElement).value
                    const bit = v === '1' ? '1' : v === '0' ? '0' : 'x'
                    chars[i] = bit
                    transitions[idx]!.input = chars.join('')
                    setLastUpdateSource('table')
                  }
                "
              />
            </td>

            <!-- Z^(n+1) bits (edit) -->
            <td
              v-for="(_, i) in bitNumber"
              :key="transitionView.id + '-to-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
              :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <input
                v-if="transitions[idx]"
                :value="(transitionView.toBinary ?? '').padStart(bitNumber, '0').charAt(i)"
                class="bg-transparent text-center outline-none w-6"
                @input="
                  (e) => {
                    const v = (e.target as HTMLInputElement).value
                    const bit = v === '1' ? '1' : v === '0' ? '0' : 'x'
                    updateToFromBits(idx, i, bit)
                  }
                "
              />
            </td>

            <!-- Y^n bits (edit) -->
            <td
              v-for="(_, i) in outputBits"
              :key="transitionView.id + '-out-' + i"
              class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
              :class="i === outputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
            >
              <input
                v-if="transitions[idx]"
                :value="normalizeBitsToX(transitions[idx]!.output, outputBits).charAt(i)"
                class="bg-transparent text-center outline-none w-6"
                @input="
                  (e) => {
                    const current = normalizeBitsToX(transitions[idx]!.output, outputBits)
                    const chars = current.split('')
                    const v = (e.target as HTMLInputElement).value
                    const bit = v === '1' ? '1' : v === '0' ? '0' : 'x'
                    chars[i] = bit
                    transitions[idx]!.output = chars.join('')
                    setLastUpdateSource('table')
                  }
                "
              />
            </td>
          </tr>
        </tbody>
      </table>
      <button class="bg-primary text-sm px-3 mr-3 py-1 font-mono" @click="addTransitionRow">+</button>
      <button class="bg-primary text-sm px-3 ml-3 py-1 font-mono" @click="sortTransitionsByZX">
        sort
      </button>
    </div>
    <div v-else class="text-sm font-mono text-gray-400 text-center">
      Please add more states to reveal the transition table.
    </div>
  </div>
</template>
