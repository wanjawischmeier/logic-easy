<script setup lang="ts">
import { useAutomatonState } from '@/states/automatonState.ts'

const {
  states,
  transitions,
  binaryIDs
} = useAutomatonState()

</script>

<template>
  <div class="w-full h-full overflow-auto flex flex-col justify-center gap-10 items-center">
    <!-- STATES Table -->
    <table
      v-if="states.length"
      class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none mb-8"
    >
      <thead>
        <tr>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4">
            ID
          </th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4">
            Name
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(state, index) in states" :key="state.id">
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4">
            {{ binaryIDs[index] }}
          </td>
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary border-r-4 px-3 py-4">
            {{ state.name }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- TRANSITIONS Table -->
    <table
      v-if="transitions?.length"
      class="flex-auto bg-gray-800 border border-primary table-fixed w-auto select-none"
    >
      <thead>
        <tr>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-20 font-mono border-r-4">
            ID
          </th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-24 font-mono border-r-4">
            From
          </th>
          <th class="px-3 text-gray-400 border-b-4 border-primary bg-gray-800 w-28 font-mono">
            Label
          </th>
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
          <td class="text-lg font-mono text-center bg-gray-800 border-b border-primary px-3 py-4">
            {{ transition.label }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else class="p-4 text-gray-500 text-sm">no data! please paint a cool state machine</div>
  </div>
</template>
