import type { BaseProjectProps } from '@/projects/Project';
import { projectManager } from '@/projects/projectManager';
import { getProjectType } from '@/projects/projectRegistry';
import { type MenuEntry, dockRegistry } from '@/router/dockRegistry';
import { shallowRef, type Component } from 'vue';

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

/**
 * Creates a new project after first showing a popup.
 * @param panelId The id with which the new panel should be created.
 * @returns Wether or not the project was sucessfully created.
 */
export function showProjectCreationPopup(panelId: string): Promise<boolean>;

/**
 * Creates a new project after first showing a popup.
 * @param menuEntry The menu entry whose id will be assigned to the new panel.
 * @returns Wether or not the project was sucessfully created.
 */
export function showProjectCreationPopup(menuEntry: MenuEntry): Promise<boolean>;

// Main function called by both overloads
export async function showProjectCreationPopup(panelIdOrMenuEntry: string | MenuEntry): Promise<boolean> {
  let panelId: string;
  let menuEntry: MenuEntry | undefined;

  // Type guard to determine which overload was called
  if (typeof panelIdOrMenuEntry === 'string') {
    panelId = panelIdOrMenuEntry;
  } else {
    menuEntry = panelIdOrMenuEntry;
    if (!menuEntry?.panelId) return false;
    panelId = menuEntry.panelId;
  }

  const registryEntry = dockRegistry.find(item => item.id === panelId);
  if (!registryEntry?.projectType) return false;

  const projectType = getProjectType(registryEntry.projectType);

  popupService.open({
    projectPropsComponent: projectType.propsComponent,
    initialProps: projectType.projectClass?.defaultProps,
    onProjectCreate: async (props: any) => {
      if (!registryEntry.projectType) return;
      projectManager.createProject(props.name, registryEntry.projectType, props);
    },
  });
  return true;
}
