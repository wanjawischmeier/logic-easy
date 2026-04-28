<script setup lang="ts">
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { stateManager } from '@/projects/stateManager'

const { nodes } = FsmProject.useState()

function addNode() {
  const fsm = stateManager.state.fsm
  if (!fsm) return
  const nextId = fsm.nodes.length > 0 ? Math.max(...fsm.nodes.map(n => n.nodeId)) + 1 : 0
  fsm.nodes.push({ nodeId: nextId, name: `q${nextId}`, isInitial: fsm.nodes.length === 0, mooreOutput: '0' })
}

function removeNode() {
  const fsm = stateManager.state.fsm
  if (fsm && fsm.nodes.length > 0) fsm.nodes.pop()
}

</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <div class="flex justify-between items-center px-2">
      <h2 class="text-[11px] font-mono text-gray-500 uppercase tracking-widest">Nodes</h2>
      <div class="flex gap-1 bg-black/20 p-1 rounded border border-white/5">
        <button @click="removeNode" class="px-2 hover:bg-red-500/10 text-white">-</button>
        <button @click="addNode" class="px-2 hover:bg-green-500/10 text-white">+</button>
      </div>
    </div>
    <table class="w-full bg-gray-900/50 border border-white/10 table-fixed font-mono text-sm">
      <thead>
        <tr class="text-gray-500 text-[10px] uppercase bg-black/40">
          <th class="p-2 border-b border-white/10 w-12">Init</th>
          <th class="p-2 border-b border-white/10 border-l border-white/10">Name</th>
          <th class="p-2 border-b border-white/10 border-l border-white/10">Binary (Zⁿ)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="node in nodes" :key="node.nodeId" class="hover:bg-white/5">
          <td class="border-b border-white/10 text-center py-2">
            <input type="radio" :checked="node.isInitial" @change="nodes.forEach(n => n.isInitial = (n.nodeId === node.nodeId))" class="accent-blue-500" />
          </td>
          <td class="border-b border-white/10 border-l border-white/10 p-0">
            <input v-model="node.name" class="w-full bg-transparent text-center py-2 outline-none" />
          </td>
          <td class="text-center border-b border-white/10 border-l border-white/10 py-2 text-blue-400">
            {{ node.binaryNodeId }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
