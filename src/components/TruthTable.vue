<script setup lang="ts">
export type TruthTableCell = 0 | 1 | '-';

const props = defineProps<{
  inputVars: string[]
  outputVars: string[]
  modelValue: TruthTableCell[][]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: TruthTableCell[][]): void
}>()

function toggleCell(rowIdx: number, colIdx: number) {
  const newValues = props.modelValue.map(row => [...row])
  const row = newValues[rowIdx]
  if (!row) return

  const current = row[colIdx]
  if (current === undefined) return

  if (current === 0) row[colIdx] = 1
  else if (current === 1) row[colIdx] = '-'
  else row[colIdx] = 0

  emit('update:modelValue', newValues)
}
</script>

<template>
  <div class="w-full overflow-auto flex justify-center">
    <table v-if="modelValue.length && inputVars.length && outputVars.length"
      class="bg-slate-800 border border-blue-400 table-fixed w-auto select-none">
      <thead>
        <tr>
          <th v-for="(input, idx) in inputVars" :key="input"
            class="px-3 py-2 text-blue-300 border-b-4 border-blue-400 bg-slate-800 w-32"
            :class="{ 'border-r-4': idx === inputVars.length - 1, 'border-r': idx !== inputVars.length - 1 }">
            {{ input }}
          </th>
          <th v-for="output in outputVars" :key="output"
            class="px-3 py-2 text-green-300 border-b-4 border-blue-400 bg-slate-800 border-r last:border-r-0 w-32">
            {{ output }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIdx) in modelValue" :key="rowIdx">
          <td v-for="(cell, colIdx) in row" :key="colIdx"
            class="text-lg font-mono text-center align-middle cursor-pointer bg-slate-800 hover:bg-slate-700 border-b border-blue-400 transition-all duration-200"
            :class="{
              'border-r-4': colIdx === inputVars.length - 1,
              'border-r': colIdx !== inputVars.length - 1 && colIdx !== row.length - 1
            }" @click="toggleCell(rowIdx, colIdx)">
            <div class="flex-1 flex items-center justify-center p-2">
              {{ cell }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="text-red-400 p-4">No data :/</div>
  </div>
</template>
