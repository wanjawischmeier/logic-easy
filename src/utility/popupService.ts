import { shallowRef, type Component } from 'vue';

export type GenericPopupConfig = {
  component: Component;
  props?: Record<string, unknown>;
};

export type ProjectCreationPopupConfig = {
  projectPropsComponent: Component;
  onProjectCreate: (projectName: string, props: Record<string, unknown>) => void;
};

export type PopupConfig = GenericPopupConfig | ProjectCreationPopupConfig;

function isProjectCreationPopup(config: PopupConfig): config is ProjectCreationPopupConfig {
  return 'projectPropsComponent' in config;
}

const currentPopup = shallowRef<PopupConfig | null>(null);

export const popupService = {
  get current() {
    return currentPopup;
  },

  get isProjectCreation() {
    return currentPopup.value ? isProjectCreationPopup(currentPopup.value) : false;
  },

  open(config: PopupConfig) {
    currentPopup.value = config;
  },

  close() {
    currentPopup.value = null;
  },
};
