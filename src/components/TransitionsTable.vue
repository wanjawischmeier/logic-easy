<script setup lang="ts">
import { FsmProject } from '@/projects/state-machine/FsmProject'
import type { FsmModel, FsmNode, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { normalizeBits, toggleBitInString } from '@/utility/fsm/bitOperations'

const { nodes, transitions, inputBitCount, outputBitCount, nodeIdBitCount, fsmModel } =
  FsmProject.useState()

const getBinById = (id: number) => {
  const node = nodes.value.find((n) => n.nodeId === id)
  return node?.binaryNodeId ?? 'x'.repeat(nodeIdBitCount.value)
}

function handleOutputClick(trIdx: number, bitIdx: number) {
  const tr = transitions.value[trIdx]
  if (!tr) return

  if (fsmModel.value === 'moore') {
    const node = nodes.value.find((n) => n.nodeId === tr.fromNodeId)
    if (node)
      node.mooreOutput = toggleBitInString(node.mooreOutput ?? '', bitIdx, outputBitCount.value)
  } else {
    tr.mealyOutput = toggleBitInString(tr.mealyOutput ?? '', bitIdx, outputBitCount.value)
  }
}

/**
 * get relevant output string (moore or mealy)
 */
function getOutputValue(tr: FsmTransition, nodes: FsmNode[], model: FsmModel): string {
  if (model === 'moore') {
    const node = nodes.find((n) => n.nodeId === tr.fromNodeId)
    return node?.mooreOutput ?? ''
  }
  return tr.mealyOutput ?? ''
}
</script>

<template>
  <div class="flex flex-col gap-3 w-full pt-4">
    <h2 class="text-[11px] font-mono text-gray-500 uppercase tracking-widest px-2 text-left">
      Transitions
    </h2>
    <table
      v-if="transitions.length"
      class="w-full bg-gray-900/50 border border-white/10 table-fixed font-mono text-xs"
    >
      <thead class="bg-black/40 text-gray-500 uppercase text-[10px]">
        <tr>
          <th :colspan="nodeIdBitCount" class="py-2 border-b border-white/10 text-center">
            From (Zⁿ)
          </th>
          <th
            :colspan="inputBitCount"
            class="border-b border-white/10 border-l border-white/10 text-center"
          >
            In (Xⁿ)
          </th>
          <th
            :colspan="nodeIdBitCount"
            class="border-b border-white/10 border-l border-white/10 text-center"
          >
            To (Zⁿ⁺¹)
          </th>
          <th
            :colspan="outputBitCount"
            class="border-b border-white/10 border-l border-white/10 text-center"
          >
            Out (Yⁿ)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(tr, idx) in transitions" :key="tr.transitionId" class="hover:bg-white/5">
          <td
            v-for="(c, i) in getBinById(tr.fromNodeId)"
            :key="'f' + i"
            class="text-center py-2 opacity-40 border-b border-white/5"
          >
            {{ c }}
          </td>
          <td
            v-for="(c, i) in normalizeBits(tr.input, inputBitCount)"
            :key="'i' + i"
            class="text-center border-l border-white/5 border-b border-white/5"
          >
            {{ c }}
          </td>
          <td
            v-for="(c, i) in getBinById(tr.toNodeId)"
            :key="'t' + i"
            class="text-center border-l border-white/5 border-b border-white/5 text-blue-300"
          >
            {{ c }}
          </td>
          <td
            v-for="(c, bIdx) in normalizeBits(getOutputValue(tr, nodes, fsmModel), outputBitCount)"
            :key="'o' + idx + '-' + bIdx"
            @click="handleOutputClick(idx, bIdx)"
            class="text-center border-l border-white/5 border-b border-white/5 cursor-pointer hover:bg-blue-500/20 text-blue-500 font-bold"
          >
            {{ c }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
