<template>
  <div class="flex items-center relative h-[calc(100vh-40px-16px)] m-4 ml-12 text-on-surface">
    <!-- GitHub Logo-->
    <div class="absolute flex flex-row justify-end items-end gap-4 w-full h-full select-none">
      <a class="bg-surface-2 hover:bg-surface-3 p-0! mb-4 rounded-full shadow-2xl"
        href="https://github.com/wanjawischmeier/logic-easy" target="_blank" rel="noopener noreferrer">
        <img src="/GithubLogo.png" alt="GitHub Logo" class="w-12 aspect-auto invert">
      </a>
      <a class="bg-surface-2 hover:bg-surface-3 p-0! mb-4 w-12 aspect-square rounded-full shadow-2xl text-3xl font-semibold flex justify-center items-center"
        href="/logic-easy/docs" target="_blank" rel="noopener noreferrer">
        ?
      </a>
    </div>

    <div class="absolute rounded-xs bg-elevated p-10 shadow-2xl"
      :class="(recentProjectEntries.length > 0) ? 'pr-[15%]' : 'pr-[25%]'">
      <p class="text-4xl mb-4 select-none text-primary-variant">Getting started</p>

      <div class="flex gap-20">
        <DirectoryStyleList :title="'New Project'" :entries="newProjectEntries" />
        <DirectoryStyleList v-if="recentProjectEntries.length > 0" :title="'Recently opened'"
          :entries="recentProjectEntries" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, type ComputedRef } from 'vue';
import { newMenu, type MenuEntry } from '@/router/dockRegistry';
import DirectoryStyleList from '@/components/parts/DirectoryStyleList.vue';
import { projectManager } from '@/projects/projectManager';
import { showProjectCreationPopup } from '@/utility/popupService';

interface ListEntry {
  label: string;
  action: () => void;
  disabled?: boolean;
  subtitle?: string;
}

export default defineComponent({
  name: 'GettingStartedView',
  components: { DirectoryStyleList },
  setup() {
    function formatDate(timestamp: number): string {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

      // For older dates, show the actual date
      const date = new Date(timestamp);
      return date.toLocaleDateString();
    }

    const newProjectEntries: ComputedRef<ListEntry[]> = computed(() =>
      newMenu.value.map((menuEntry: MenuEntry) => ({
        label: menuEntry.label,
        disabled: menuEntry.disabled,
        action: () => showProjectCreationPopup(menuEntry),
      }))
    );

    const recentProjectEntries: ComputedRef<ListEntry[]> = computed(() => {
      const projects = projectManager.listProjects();

      // Group projects by name to identify duplicates
      const projectsByName = new Map<string, typeof projects>();
      projects.forEach((project) => {
        const existing = projectsByName.get(project.name) || [];
        existing.push(project);
        projectsByName.set(project.name, existing);
      });

      // For each group with duplicates, sort by ID and assign numbers
      const nameNumbers = new Map<number, number>();
      projectsByName.forEach((group) => {
        if (group.length > 1) {
          // Sort by ID to get consistent numbering
          const sorted = [...group].sort((a, b) => a.id - b.id);
          sorted.forEach((project, index) => {
            nameNumbers.set(project.id, index + 1);
          });
        }
      });

      return projects.map((project) => {
        const number = nameNumbers.get(project.id);
        const displayName = number ? `${project.name} (${number})` : project.name;
        const dateStr = formatDate(project.lastModified);

        // Get project type name
        const subtitle = `${dateStr}`;

        return {
          label: displayName,
          subtitle,
          action: () => {
            projectManager.openProject(project.id);
          },
        };
      });
    });

    return { newMenu, runAction: showProjectCreationPopup, newProjectEntries, recentProjectEntries };
  },
});
</script>
