<script setup lang="ts">
import StateTable from '@/components/StateTable.vue'
import { useFsmListener } from '@/utility/FsmListener'
import { useAutomatonState } from '@/states/automatonState';

// event listener for fsm iframe (submodule)
useFsmListener()

// import global states for the state table
const { states, transitions } = useAutomatonState()

</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="flex-1 overflow-auto mb-4">
      <StateTable :data="{ states, transitions }" />
    </div>
  </div>
</template>
