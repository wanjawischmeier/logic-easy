<template>
  <header class="h-full text-on-surface">
    <div class="flex items-center justify-between px-1 h-full">
      <div class="flex items-center gap-4 select-none">
        <!-- logo + title -->
        <a href="/logic-easy/" class="mx-2">
          <div class="flex gap-2">
            <img src="/iti-logo.png" alt="logo" class="h-6">
            <p class="font-medium">LogicEasy</p>
          </div>
        </a>


        <HeaderMenuBar />
      </div>

      <div v-if="currentProjectInfo" class="flex bg-surface-2 rounded-t-xs mt-1">
        <div title="Rename Project" class="w-45 flex items-center shrink-0 max-w-full
  border border-transparent rounded-xs
  hover:border-gray-300
  focus-within:border-primary
  focus-within:hover:border-primary">
          <!-- TODO: Move into svg file -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" class="mx-1 fill-primary-variant">
            <path
              d="M 6 2 C 4.9057453 2 4 2.9057453 4 4 L 4 20 C 4 21.094255 4.9057453 22 6 22 L 18 22 C 19.094255 22 20 21.094255 20 20 L 20 8 L 14 2 L 6 2 z M 6 4 L 13 4 L 13 9 L 18 9 L 18 20 L 6 20 L 6 4 z" />
          </svg>

          <input ref="projectInput" type="text" placeholder="Project Name" maxlength="40" v-model="projectValue"
            class="flex-1 bg-transparent outline-none min-w-0 p-0.5 truncate text-primary-variant focus-within:text-on-surface"
            @keydown.enter="handleProjectEnter" />
        </div>

        <button type="button" @click="stateManager.closeCurrentProject" title="Close project"
          class="h-full px-3 text-xl rounded-xs border border-transparent hover:bg-red-900 hover:border-on-surface">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import HeaderMenuBar from './HeaderMenuBar.vue';
import { projectManager } from '@/projects/projectManager';
import { stateManager } from '@/states/stateManager';

const projectInput = ref<HTMLInputElement>()
const currentProjectInfo = computed(() => projectManager.currentProjectInfo)
const projectValue = ref(currentProjectInfo.value?.name)

// Watch for external changes to project name
watch(currentProjectInfo, (newInfo) => {
  projectValue.value = newInfo?.name
}, { deep: true, immediate: true })

watch(projectValue, (newVal) => {
  if (!newVal) return;

  // Strip out invalid chars
  projectValue.value = newVal.replace(/[^A-Za-z0-9\s_\\-\\(\\)]/g, '')
})

const handleProjectEnter = (event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement

  // Blur to defocus and reset scroll to beginning
  input.scrollLeft = 0
  projectInput.value?.blur()

  const projectInfo = projectManager.currentProjectInfo
  if (projectInfo && projectValue.value) {
    projectManager.renameProject(projectInfo.id, projectValue.value)
  }
}
</script>
