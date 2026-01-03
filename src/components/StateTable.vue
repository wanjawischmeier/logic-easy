<script setup lang="ts">
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'

const { states, transitions, binaryIDs, binaryTransitions } = AutomatonProject.useState()
</script>

<template>
  <div
    v-if="states.length"
    class="w-full h-full overflow-auto flex flex-col justify-center gap-10 items-center"
  >
    <!-- STATE CODES Table -->
    <table class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none mb-8">
      <thead>
        <tr>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            binary ID
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4"
          >
            Name
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(state, index) in states" :key="state.id">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ binaryIDs[index] }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ state.name }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- TRANSITION Table -->
    <table
      v-if="transitions?.length"
      class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
    >
      <thead>
        <tr>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            ID
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4"
          >
            From
          </th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-28 font-mono">
            Input
          </th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-28 font-mono">
            Output
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transition in transitions" :key="transition.id">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.id }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.from }}
          </td>
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary px-3 py-4">
            {{ transition.input }}
          </td>
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary px-3 py-4">
            {{ transition.output }}
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="p-4 justify-center text-center text-gray-400 text-lg items-center">
      Please add transitions!
    </div>

    <!-- ACTUAL TRANSITION Table -->
    <table
      v-if="transitions?.length"
      class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
    >
      <thead>
        <tr>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            Z^n
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            X^n
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            Z^(n+1)
          </th>
          <th
            class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4"
          >
            Y^n
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transition in binaryTransitions" :key="transition.id">
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.fromBinary }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.input }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.toBinary }}
          </td>
          <td
            class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4"
          >
            {{ transition.output }}
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
