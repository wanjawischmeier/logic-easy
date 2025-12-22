import { shallowRef, type Component } from 'vue';
import type { BaseProjectProps } from '@/projects/projectRegistry';

export type GenericPopupConfig = {
  component: Component;
  props?: Record<string, unknown>;
};

export type ProjectCreationPopupConfig<TProps extends BaseProjectProps = BaseProjectProps> = {
  projectPropsComponent: Component;
  initialProps: TProps;
  onProjectCreate: (props: TProps) => void;
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

  open<TProps extends BaseProjectProps = BaseProjectProps>(config: PopupConfig | ProjectCreationPopupConfig<TProps>) {
    currentPopup.value = config as PopupConfig;
  },

  close() {
    currentPopup.value = null;
  },
};
