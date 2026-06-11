<template>
  <div>
    <div class="mt-6 mb-2 ml-5 text-xl text-secondary-variant select-none">{{ title }}</div>

    <!-- grid-based terminal-style directory view -->
    <!-- grid: narrow left column for branches, right column for items -->
    <div class="grid grid-cols-[38px_1fr] gap-x-2">
      <template v-for="(entry, idx) in entries" :key="idx">
        <template v-if="entry.children">
          <!-- left cell: branch marker aligned to row -->
          <div class="h-10 relative">
            <!-- stem stops at mid-row for the last top-level entry -->
            <div
              class="absolute w-px bg-secondary-variant"
              :class="idx < entries.length - 1 ? 'h-full' : 'h-5'"
              style="left: 20px"
            ></div>
            <div class="absolute h-px w-4 bg-secondary-variant" style="left: 20px; top: 20px"></div>
            <div
              class="absolute w-px bg-secondary-variant"
              style="left: 36px; top: 20px; bottom: 0"
            ></div>
          </div>
          <!-- right cell -->
          <div class="h-10 flex items-center">
            <span class="text-secondary-variant select-none">{{ entry.label }}</span>
          </div>

          <template v-for="(child, cidx) in entry.children" :key="'c-' + idx + '-' + cidx">
            <!-- left cell: branch marker aligned to row -->
            <div class="h-8 relative">
              <!-- outer stem only continues through children of non-last groups -->
              <div
                v-if="idx < entries.length - 1"
                class="absolute h-full w-px bg-secondary-variant"
                style="left: 20px"
              ></div>
              <div
                class="absolute w-px bg-secondary-variant"
                :class="cidx < entry.children!.length - 1 ? 'h-full' : 'h-4'"
                style="left: 36px"
              ></div>
              <div
                class="absolute h-px bg-secondary-variant w-[14px]"
                style="left: 36px; top: 1rem"
              ></div>
            </div>
            <!-- right cell: actual item button aligned to same row height -->
            <div class="h-8 flex items-center">
              <button
                @click="child.action()"
                :disabled="child.disabled"
                class="group flex items-center hover:text-secondary-variant underline-offset-4 disabled:bg-transparent disabled:no-underline disabled:text-on-surface-disabled rounded-xs cursor-pointer disabled:cursor-default w-full text-left truncate"
                :title="child.label"
              >
                <span class="group-hover:underline">{{ child.label }}</span>
              </button>
            </div>
          </template>
        </template>

        <template v-else>
          <!-- left cell: branch marker aligned to row -->
          <div class="h-10 relative">
            <div
              class="absolute w-px bg-secondary-variant"
              :class="idx < entries.length - 1 ? 'h-full' : 'h-5'"
              style="left: 20px"
            ></div>
            <div
              class="absolute h-px w-[21px] bg-secondary-variant"
              style="left: 20px; top: 20px"
            ></div>
          </div>
          <!-- right cell: actual item button aligned to same row height -->
          <div class="h-10 flex items-center">
            <button
              @click="entry.action()"
              :disabled="entry.disabled"
              class="group flex items-center hover:text-secondary-variant underline-offset-4 disabled:bg-transparent disabled:no-underline disabled:text-on-surface-disabled rounded-xs cursor-pointer disabled:cursor-default w-full text-left truncate"
              :title="entry.label"
            >
              <span class="group-hover:underline">{{ entry.label }}</span>
              <span
                v-if="entry.subtitle"
                class="ml-2 text-on-surface-disabled group-hover:no-underline truncate"
                >{{ entry.subtitle }}</span
              >
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import type { ListEntries } from '@/utility/types'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DirectoryStyleList',
  props: {
    title: { type: String, required: true },
    entries: { type: Array as () => ListEntries, required: true },
  },
})
</script>
