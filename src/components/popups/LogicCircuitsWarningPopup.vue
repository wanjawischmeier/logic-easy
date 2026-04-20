<template>
  <PopupBase :visible="true" title="Warning" :actions="[]" @close="onClose">
    <div class="flex flex-col gap-5 text-on-surface">
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 h-8 w-8 shrink-0 rounded-full border-2 border-red-500 text-red-500 font-black text-lg leading-none flex items-center justify-center"
        >
          !
        </div>

        <p class="text-base leading-7 text-on-surface">
          {{ message }}
        </p>
      </div>

      <div class="flex items-center justify-between gap-4">
        <label
          class="flex items-center gap-2 text-xs text-on-surface/50 select-none cursor-pointer hover:text-on-surface/70 transition-colors"
        >
          <input v-model="dontShowAgain" type="checkbox" class="accent-primary" />
          <span>{{ props.dontShowAgainLabel }}</span>
        </label>

        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="props.exportAction"
            type="button"
            class="px-3.5 py-1.5 rounded text-sm font-medium bg-surface-2 hover:bg-surface-3 text-on-surface/70 hover:text-on-surface transition-colors"
            @click="handleExport"
          >
            {{ props.exportLabel }}
          </button>

          <button
            type="button"
            class="px-3.5 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            @click="handleSync"
          >
            {{ props.syncLabel }}
          </button>
        </div>
      </div>
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PopupBase from '@/components/popups/PopupBase.vue'
import { popupService } from '@/utility/popupService'

const dontShowAgain = ref(false)

const props = withDefaults(
  defineProps<{
    message: string
    dontShowAgainLabel?: string
    exportLabel?: string
    syncLabel?: string
    exportAction?: () => void | Promise<void>
    syncAction?: (dontShowAgain?: boolean) => void
  }>(),
  {
    dontShowAgainLabel: 'Always resync without warning',
    exportLabel: 'Export your edited .lc file',
    syncLabel: 'Sync from LogicEasy',
    exportAction: undefined,
    syncAction: undefined,
  },
)

function onClose() {
  //disabled, user has to select one of the options
}

function handleExport() {
  void props.exportAction?.()
}

function handleSync() {
  props.syncAction?.(dontShowAgain.value)
  popupService.close()
}
</script>
