<template>
  <Transition enter-active-class="transition-opacity duration-200 ease-in-out"
    leave-active-class="transition-opacity duration-200 ease-in-out" enter-from-class="opacity-0"
    leave-to-class="opacity-0">
    <div v-if="loadingState.isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-surface-1 bg-opacity-80 backdrop-blur-sm"
      style="top: 40px;">
      <div class="flex flex-col items-center gap-4 bg-elevated p-8 rounded-lg shadow-2xl">
        <!-- Spinner -->
        <div class="w-12 h-12 border-4 border-surface-3 border-t-primary rounded-full animate-spin"></div>

        <!-- Message -->
        <p class="text-on-surface text-lg">{{ loadingState.message }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { loadingService } from '@/utility/loadingService'

const loadingState = loadingService.loading
</script>
