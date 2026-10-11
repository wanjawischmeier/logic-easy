<template>
  <a
    :href="docsHref"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-1 px-2.5 py-1.5 rounded-xs text-sm text-primary-variant bg-surface-2 border border-surface-3 hover:bg-surface-3 transition-colors"
    :title="tooltip"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" class="fill-current" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
    <span>{{ count }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ count: number }>()

const docsHref = '/logic-easy/docs/views/state-machine/tables.html#next-states'
const tooltip = computed(() => {
  const carried = props.count === 1 ? 'One of them' : `${props.count} of them`
  return `All transitions with - as a next state bit are hidden: they have no unique target, so they are not drawn and the Karnaugh-Veitch and LogicCircuits views ignore them. ${carried} still show bits in the state table. Click for details.`
})
</script>
