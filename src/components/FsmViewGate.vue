<template>
  <!-- Exactly one overlay for every view, decided by fsmViewMode -->
  <InvalidFSMView v-if="mode === 'invalid'" :reason="reason" :hint="hint" />

  <HiddenEdgesNotice
    v-else-if="mode === 'hidden-pending'"
    :count="hiddenRowCount"
    @confirm="clearHiddenRows"
  />

  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FsmState } from '@/projects/state-machine/FsmTypes'
import InvalidFSMView from '@/components/InvalidFSMView.vue'
import HiddenEdgesNotice from '@/components/HiddenEdgesNotice.vue'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import {
  countPendingHiddenRows,
  fsmViewMode,
  validateFsm,
} from '@/utility/fsm/EditorSync/fsmValidation'

const props = defineProps<{ fsm?: FsmState | undefined; hint: string }>()

const mode = computed(() => fsmViewMode(props.fsm))
const hiddenRowCount = computed(() => (props.fsm ? countPendingHiddenRows(props.fsm) : 0))
const reason = computed(() => {
  if (!props.fsm) return ''
  const validity = validateFsm(props.fsm)
  return validity.valid ? '' : validity.reason
})

// Accepting the hidden rows is the only way to show the view again
function clearHiddenRows() {
  FsmProject.clearHiddenRowBits()
}
</script>
