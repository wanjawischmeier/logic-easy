<template>
  <PopupBase :visible="true" title="Manual" :actions="actions" @close="onClose">
    <div class="text-on-surface">
      Manual...
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import PopupBase, { type PopupAction } from '@/components/PopupBase.vue';
import { popupService } from '@/utility/popupService';

function onClose() {
  popupService.close();
}

const actions: PopupAction[] = [];
</script>
