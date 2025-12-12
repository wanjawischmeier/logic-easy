<script setup lang="ts">
  import type { FsmExport } from '@/utility/FsmExport.ts'

const props = defineProps<{
  data: FsmExport['states']
}>()
</script>

<template>
  <table class="w-full text-sm border border-gray-600 rounded overflow-hidden">
    <tbody>
      <tr v-for="s in props.data" :key="s.id">
        <td>{{ s.id }}</td>
        <td>{{ s.name }}</td>
        <td>{{ s.initial }}</td>
        <td>{{ s.final }}</td>
      </tr>
    </tbody>
  </table>
</template>
