<script setup lang="ts">
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'

const {
  states,
  transitions,
  binaryIDs,
  binaryTransitions,
  bitNumber,
  inputBits,
  outputBits,
} = AutomatonProject.useState()
</script>

<template>
  <div
    v-if="states.length"
    class="w-full h-full overflow-auto flex flex-col justify-center gap-4 items-center"
  >
    <h1 class="text-xl font-mono">States</h1>

    <!-- STATE CODES Table -->
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
        <tr v-for="(state, index) in states" :key="state.id">
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

    <h1 class="mt-6 text-xl font-mono">Transitions</h1>

    <!-- TRANSITION TABLE -->
    <table
      v-if="transitions.length"
      class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
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
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="(transitionView, idx) in binaryTransitions"
          :key="transitionView.id"
        >
          <!-- Z^n bits (read only) -->
          <td
            v-for="(_, i) in bitNumber"
            :key="transitionView.id + '-from-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            {{ (transitionView.fromBinary ?? '').charAt(i) || '0' }}
          </td>

          <!-- X^n bits (edit underlying transitions) -->
          <td
            v-for="(_, i) in inputBits"
            :key="transitionView.id + '-in-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === inputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <input
              v-if="transitions[idx]"
              v-model="transitions[idx]!.input"
              class="bg-transparent text-center outline-none w-10"
            />
          </td>

          <!-- Z^(n+1) bits (readonly) -->
          <td
            v-for="(_, i) in bitNumber"
            :key="transitionView.id + '-to-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === bitNumber - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            {{ (transitionView.toBinary ?? '').charAt(i) || '0' }}
          </td>

          <!-- Y^n bits (edit underlying transitions) -->
          <td
            v-for="(_, i) in outputBits"
            :key="transitionView.id + '-out-' + i"
            class="font-mono text-center bg-gray-800 border-b border-primary px-1 py-0"
            :class="i === outputBits - 1 ? 'border-r-4' : 'border-r border-gray-600'"
          >
            <input
              v-if="transitions[idx]"
              v-model="transitions[idx]!.output"
              class="bg-transparent text-center outline-none w-10"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else class="p-4 justify-center text-center text-gray-400 text-lg items-center">
      Please add transitions!
    </div>
  </div>

  <div v-else class="p-4 justify-center text-center text-gray-400 text-lg items-center">
    No data! Come on, paint a cool automaton!
  </div>
</template>
