<template>
  <div
    class="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-surface"
  >
    <span
      class="flex items-center justify-center w-16 h-16 rounded-2xl border border-surface-3 bg-surface-2 text-on-surface"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </span>
    <h2 class="text-2xl font-medium text-on-surface">Automaton Invalid</h2>
    <p class="text-sm text-on-surface/80 leading-relaxed max-w-md">
      {{ reason || 'The current automaton cannot be rendered.' }}
    </p>
    <p class="text-xs text-on-surface/50">
      Fix the issues in the state table to unlock the editor.
    </p>
  </div>
</template>

<script setup lang="ts">
// Shared by the editor and the KV diagram so both views lock together while the automaton is invalid
defineProps<{ reason?: string }>()
</script>

<style scoped></style>
