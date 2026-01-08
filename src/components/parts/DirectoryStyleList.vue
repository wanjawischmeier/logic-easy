<template>
  <div>
    <div class="mt-6 mb-2 ml-5 text-xl text-secondary-variant select-none">{{ title }}</div>

    <!-- grid-based terminal-style directory view -->
    <div class="relative">
      <!-- vertical stem spanning the whole list -->
      <div class="absolute left-5 top-0 bottom-5 w-px bg-secondary-variant"></div>

      <!-- grid: narrow left column for branches, right column for items -->
      <div class="grid grid-cols-[38px_1fr] gap-x-2">
        <div v-for="(entry, idx) in entries" :key="idx" class="contents">
          <!-- left cell: branch marker aligned to row -->
          <div class="h-10 flex items-start">
            <div class="w-8 h-px bg-secondary-variant ml-5 mt-5"></div>
          </div>

          <!-- right cell: actual item button aligned to same row height -->
          <div class="h-10 flex items-center">
            <button @click="entry.action()" :disabled="entry.disabled"
              class="group flex items-center hover:text-secondary-variant underline-offset-4 disabled:bg-transparent disabled:no-underline disabled:text-on-surface-disabled rounded-xs cursor-pointer disabled:cursor-default w-full text-left truncate"
              :title="entry.label">
              <span class="group-hover:underline">{{ entry.label }}</span>
              <span v-if="entry.subtitle" class="ml-2 text-on-surface-disabled group-hover:no-underline truncate">{{
                entry.subtitle }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { ListEntries } from '@/utility/types';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'DirectoryStyleList',
  props: {
    title: { type: String, required: true },
    entries: { type: Array as () => ListEntries, required: true },
  },
});
</script>
