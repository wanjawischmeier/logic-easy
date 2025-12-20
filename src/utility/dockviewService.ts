/**
 * Service for controlling dockview visibility and state
 */
class DockviewService {
  private minimizeCallback: (() => void) | null = null

  /**
   * Register the minimize callback (called by DockView component on mount)
   */
  registerMinimize(callback: () => void): void {
    this.minimizeCallback = callback
  }

  /**
   * Immediately minimize the dockview (set height to 0)
   */
  minimize(): void {
    if (this.minimizeCallback) {
      this.minimizeCallback()
    }
  }

  /**
   * Unregister the minimize callback (called by DockView component on unmount)
   */
  unregister(): void {
    this.minimizeCallback = null
  }
}

export const dockviewService = new DockviewService()
