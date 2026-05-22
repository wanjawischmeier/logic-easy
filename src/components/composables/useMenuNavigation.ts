import { ref, computed } from 'vue'
import type { MenuEntry } from '@/router/dockRegistry'
import { dropdownService } from '@/utility/dropdownService'
import { createPanel } from '@/utility/dockview/integration'
import { showProjectCreationPopup } from '@/utility/popupService'
import { shouldMenuBeDisabled } from './useHeaderMenus'

export function useMenuNavigation(menusComputed: () => Record<string, MenuEntry[]>) {
  const activeMenu = ref<string>('')
  const openPath = ref<number[]>([])

  const disabledMenus = computed<Set<string>>(() => {
    const disabled = new Set<string>()

    Object.entries(menusComputed()).forEach(([menuName, items]) => {
      if (shouldMenuBeDisabled(menuName, items)) {
        disabled.add(menuName)
      }
    })

    return disabled
  })

  function toggleMenu(name: string): void {
    const isOpening = activeMenu.value !== name

    if (isOpening) {
      // When opening, notify the dropdown service to close others
      dropdownService.open(closeMenu)
      activeMenu.value = name
    } else {
      // When closing, notify the service
      dropdownService.close()
      activeMenu.value = ''
    }

    openPath.value = []
  }

  function maybeSwitch(name: string): void {
    if (activeMenu.value && activeMenu.value !== name && !disabledMenus.value.has(name)) {
      activeMenu.value = name
      openPath.value = []
    }
  }

  function showSubmenu(level: number, idx: number): void {
    openPath.value = [...openPath.value.slice(0, level), idx]
  }

  function hideSubmenu(level: number): void {
    openPath.value = openPath.value.slice(0, level)
  }

  function isOpen(level: number, idx: number): boolean {
    return openPath.value[level] === idx
  }

  function runAction(entry: MenuEntry): void {
    if (entry.action) {
      entry.action()
      dropdownService.close()
      return
    }

    if (entry.panelId) {
      if (entry.createProject ?? false) {
        showProjectCreationPopup(entry)
      } else {
        createPanel(entry.panelId, entry.label)
      }

      dropdownService.close()
      return
    }

    dropdownService.close()
  }

  function closeMenu(): void {
    activeMenu.value = ''
    openPath.value = []
  }

  return {
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
  }
}
