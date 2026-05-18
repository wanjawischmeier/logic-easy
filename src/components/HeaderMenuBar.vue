<template>
  <nav ref="rootRef" class="flex items-center gap-1 select-none text-sm">
    <div
      v-for="(items, menu) in menus"
      :key="menu"
      class="relative"
      @mouseenter="maybeSwitch(menu)"
    >
      <button
        class="border hover:border-surface-3 hover:bg-surface-2 disabled:text-on-surface-disabled disabled:bg-transparent disabled:border-transparent"
        :class="activeMenu === menu ? 'border-surface-3 bg-surface-2' : 'border-transparent'"
        :disabled="disabledMenus.has(menu)"
        @click.stop="toggleMenu(menu)"
        :aria-expanded="activeMenu === menu"
        :aria-haspopup="true"
        type="button"
      >
        {{ menu }}
      </button>

      <div
        v-if="activeMenu === menu"
        class="absolute left-0 mt-1 w-48 bg-surface-2 border border-surface-3 rounded z-20"
      >
        <MenuList
          :items="items"
          :level="0"
          :show-submenu="showSubmenu"
          :hide-submenu="hideSubmenu"
          :is-open="isOpen"
          :run-action="runAction"
        />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { dropdownService } from '@/utility/dropdownService'
import MenuList from './MenuList.vue'
import { useHeaderMenus } from './composables/useHeaderMenus'
import { useMenuNavigation } from './composables/useMenuNavigation'

const rootRef = ref<HTMLElement | null>(null)

async function openFileAction() {
  await stateManager.openFile()
  dropdownService.close()
}

const { menus } = useHeaderMenus(openFileAction)

const {
  activeMenu,
  openPath,
  disabledMenus,
  toggleMenu,
  maybeSwitch,
  showSubmenu,
  hideSubmenu,
  isOpen,
  runAction,
  closeMenu,
} = useMenuNavigation(() => menus.value)

function handleDocClick(e: MouseEvent): void {
  const root = rootRef.value
  if (!root) return
  const target = e.target as Node | null
  if (!target || !root.contains(target)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  dropdownService.close()
})
</script>
