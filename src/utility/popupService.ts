import { ref, type Component } from 'vue';

export type PopupConfig = {
  component: Component;
  props?: Record<string, unknown>;
};

const currentPopup = ref<PopupConfig | null>(null);

export const popupService = {
  get current() {
    return currentPopup;
  },

  open(config: PopupConfig) {
    currentPopup.value = config;
  },

  close() {
    currentPopup.value = null;
  },
};
