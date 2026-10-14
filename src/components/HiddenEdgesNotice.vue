<template>
  <div
    class="flex-1 min-h-0 flex flex-col items-center justify-start px-6 py-8 overflow-y-auto gap-4"
  >
    <div class="max-w-md text-center mt-2">
      <!-- Icon -->
      <div class="mb-6">
        <svg
          viewBox="0 0 24 24"
          class="w-16 h-16 mx-auto fill-primary-variant opacity-75"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </div>

      <!-- Title -->
      <h1 class="text-2xl font-bold mb-4">Hidden transitions</h1>

      <!-- Message -->
      <p class="text-lg mb-4">
        <template v-if="count === 1">
          One transition has a don't care (<code>-</code>) as its next state. It is not drawn, and
          this view uses the drawn transitions only.
        </template>
        <template v-else>
          {{ count }} transitions have a don't care (<code>-</code>) as their next state. They are
          not drawn, and this view uses the drawn transitions only.
        </template>
      </p>

      <!-- What the button does -->
      <div class="bg-surface-2 rounded-lg p-4 mb-6">
        <p class="text-sm">
          To show this view, the affected rows have to be set completely to <code>-</code> in the
          next state and output columns. <strong>Continue anyway</strong> does that for you, so the
          table and this view describe the same machine.
        </p>
      </div>
    </div>

    <button
      type="button"
      class="px-3 py-1.5 text-sm rounded bg-elevated text-on-surface-disabled hover:bg-surface-2 transition-colors border-2 border-transparent hover:text-on-surface hover:border-surface-3"
      @click="emit('confirm')"
    >
      Continue anyway
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ count: number }>()

const emit = defineEmits<{ confirm: [] }>()
</script>
