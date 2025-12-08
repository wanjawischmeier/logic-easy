<!-- diese Datei diente nur einem temporären Versuch, doch evtl einen
 iframe zu nutzen. sie ist weder sauber, noch hab ich fehler gefixed, da
 ich sie nur kurz zum Testen hab generieren lassen - dann hab ich sie eh wieder verworfen.
 aus inspirationsgründen ist sie noch vorhanden. -->


<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { FsmExport } from '@/utility/types';

const props = defineProps<{
  onExport: (data: FsmExport) => void;
  onClear?: () => void;
}>();

const iframe = ref<HTMLIFrameElement>();

const handleClear = () => {
  props.onClear?.();
  iframe.value?.contentWindow?.postMessage({ type: 'fsm-clear' }, '*');
};

const onIframeLoad = () => {
  console.log('FSM iFrame loaded');
};

onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});

const handleMessage = (event: MessageEvent) => {
  if (event.data.type === 'fsm-export') {
    props.onExport(event.data.detail as FsmExport);
  }
};
</script>

<template>
  <div class="h-full w-full relative overflow-hidden">
    <iframe
      ref="iframe"
      src="/logic-easy/fsm-submodule/"
      class="h-full w-full border-0"
      @load="onIframeLoad"
    />
    <button
      @click="handleClear"
      class="absolute top-2 right-2 z-50 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 shadow-lg"
    >
      Clear FSM
    </button>
  </div>
</template>
