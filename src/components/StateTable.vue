<script setup lang="ts">

// API standard to receive data
const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stateTableData?: any[]
}>()
</script>

<!-- state table (now only template)-->
<template>
  <div>Heyho</div>
  <div v-if="props.stateTableData?.length">
    <table class="table table-sm"></table>
  </div>
</template>
