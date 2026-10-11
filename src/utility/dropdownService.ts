import { closeFsmEditorPopups } from '@/utility/fsm/EditorSync/fsmOverlayBridge'

type CloseCallback = () => void

let currentlyOpenDropdown: CloseCallback | null = null

export const dropdownService = {
  /**
   * Open a dropdown. If another dropdown is open, close it first.
   */
  open(onClose: CloseCallback) {
    // Close the previously open dropdown
    if (currentlyOpenDropdown) {
      currentlyOpenDropdown()
    }
    // Store the new one
    currentlyOpenDropdown = onClose
    // A panel must never show a dropdown and an editor popup at the same time
    closeFsmEditorPopups()
  },

  /**
   * Close the currently open dropdown.
   */
  close() {
    if (currentlyOpenDropdown) {
      currentlyOpenDropdown()
      currentlyOpenDropdown = null
    }
  },

  /**
   * Check if any dropdown is currently open.
   */
  isAnyOpen() {
    return currentlyOpenDropdown !== null
  },
}
