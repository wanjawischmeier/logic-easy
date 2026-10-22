<template>
  <a
    :href="docsHref"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-1 h-9 px-2.5 rounded-xs text-sm text-primary-variant bg-surface-2 border border-surface-3 hover:bg-surface-3 transition-colors"
    :title="tooltip"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" class="fill-current" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
    <span>{{ label }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ count: number; pending?: number }>()

const docsHref = `${import.meta.env.BASE_URL}docs/views/state-machine/tables.html#hidden-next-states`

const label = computed(() => (props.count === 1 ? '1 edge hidden' : `${props.count} edges hidden`))

const tooltip = computed(() => {
  const pending = props.pending ?? 0
  const carried =
    pending === 0
      ? 'None of them still shows bits in the state table'
      : pending === 1
        ? 'One of them still shows bits in the state table'
        : `${pending} of them still show bits in the state table`
  return `A next state with - (don't care) covers several states, so the row has no unique target and is hidden: the Editor draws no edge for it, the Karnaugh-Veitch and LogicCircuits views take it as a don't care, and it never makes the machine invalid. ${carried}. Click for the rules.`
})
</script>
