<template>
  <PopupBase :visible="true" title="About" :actions="actions" @close="onClose">
    <div class="text-on-surface">
      <div class="flex justify-between">
        <div>
          <p class="mb-4">Credits...</p>
          <p class="text-sm text-secondary-variant">Version {{ version }}</p>
        </div>
        <img src="/logo/le_1024.png" :width="256" />
      </div>
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import PopupBase, { type PopupAction } from '@/components/popups/PopupBase.vue'
import { popupService } from '@/utility/popupService'
import packageJson from '../../../package.json'

const version = packageJson.version

function onClose() {
  popupService.close()
}

const actions: PopupAction[] = []
</script>
