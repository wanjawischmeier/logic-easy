<!--

# State Table Panel
*Panel wrapper for the state table component.*
The goal of this panel is to host the state table inside dockview with minimal panel-level logic.

# Responsibilities
- Provide panel layout/container.
- Mount `StateTable.vue`.

# What belongs here
- Dockview-facing panel composition.
- Basic visual container behavior and rendering information.
- optional in the future: General settings and functionality for both tables.
-> Keep panel code lightweight and integration-focused.

-->

<script setup lang="ts">
import StateTable from '@/components/StateTable.vue'
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="flex-1 overflow-auto mb-4">
      <StateTable />
    </div>
  </div>
</template>