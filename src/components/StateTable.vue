<script setup lang="ts">
import { AutomatonProject } from '@/projects/automaton/AutomatonProject'
import { computed } from 'vue'
import type { AutomatonState } from '@/projects/automaton/AutomatonProject'

const {
  states,
  transitions,
  binaryIDs,
  inputSymbols,
  stateIndexMap,
  bitNumber,
  inputBits,
  outputBits,
} = AutomatonProject.useState()

const zLabels = computed(() => {
  const bits = bitNumber.value || 1
  return Array.from({ length: bits }, (_, i) => `Z<sup>${bits - 1 - i}</sup>`)
})

const transitionTableData = computed(() => {
  const data: Record<number, Record<string, { to: number; output: string }>> = {}
  type Transition = AutomatonState['transitions'][number]

  transitions.value.forEach((tr: Transition) => {
    const label = String(tr.label ?? '')
    const [inputRaw, outputRaw] = label.split('/')
    const input = inputRaw?.trim() || '0'
    const output = outputRaw?.trim() || '-'

    const fromIdx = stateIndexMap.value.get(tr.from)
    const toIdx = stateIndexMap.value.get(tr.to)
    if (typeof fromIdx !== 'number' || typeof toIdx !== 'number') return

    const from = fromIdx
    const to = toIdx

    if (!data[from]) data[from] = {}
    data[from][input] = { to, output }
  })
  return data
})
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

    <!-- STATE table - IMMER sichtbar wenn states -->
    <table
      class="w-full bg-gray-800 border border-primary table-fixed select-none mb-8 min-w-[600px]"
    >
      <thead>
        <tr>
          <th class="w-12 border-r-4 border-b-4 border-primary bg-gray-800"></th>
          <th
            v-for="(label, idx) in zLabels"
            :key="`z${idx}`"
            class="px-2 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono text-xs"
            v-html="label"
          ></th>
          <th
            :colspan="inputSymbols.length"
            class="px-4 text-gray-400 border-b-4 border-primary bg-gray-800 font-mono text-center"
          >
            y<sup>{{ outputBits - 1 }}</sup> ... y<sup>0</sup>
          </th>
        </tr>
        <tr>
          <th class="px-3 text-gray-400 border-b border-primary bg-gray-800 font-mono w-12">
            Eingabe
          </th>
          <th
            :colspan="bitNumber"
            class="px-3 text-gray-400 border-b border-primary bg-gray-800 font-mono text-center"
          >
            X<sub>{{ inputBits }}</sub> ... X<sub>1</sub>
          </th>
          <th
            v-for="input in inputSymbols"
            :key="input"
            class="px-4 text-gray-400 border-b border-primary bg-gray-800 font-mono min-w-[60px]"
          >
            {{ input }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(state, index) in states" :key="state.id">
          <td class="border-r border-primary bg-gray-800 py-4"></td>
          <td
            v-for="(bit, bitIdx) in (binaryIDs[index] || '')
              .padStart(bitNumber || 1, '0')
              .split('')"
            :key="`zbit${bitIdx}`"
            class="text-lg font-mono text-center border-b border-primary px-2 py-4 bg-gray-800"
          >
            {{ bit }}
          </td>
          <td
            v-for="input in inputSymbols"
            :key="input"
            class="text-lg font-mono text-center border-b border-primary px-3 py-4 bg-gray-800"
          >
            <span v-if="transitionTableData[index]?.[input]">
              {{ binaryIDs[transitionTableData[index][input].to] }}/{{
                transitionTableData[index][input].output
              }}
            </span>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- STATE Table -->
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
            Label
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
            {{ transition.label }}
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
