<template>
  <header class="h-full text-on-surface">
    <div class="flex items-center justify-between px-4 h-full">
      <div class="flex items-center gap-4">
        <!-- logo + title -->
        <a href="/logic-easy/" class="mr-4">
          <div class="flex gap-2">
            <img src="/iti-logo.png" alt="logo" class="h-6">
            <p class="font-medium">LogicEasy</p>
          </div>
        </a>

        <HeaderMenuBar />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import HeaderMenuBar from './HeaderMenuBar.vue';
</script>
