import type { DockviewApi } from 'dockview-vue'

/**
 * Service for controlling dockview visibility and state
 */
class DockviewService {
  private minimizeCallback: (() => void) | null = null
  private api: DockviewApi | null = null

  /**
   * Register the dockview API (called by DockView component on mount)
   */
  registerApi(api: DockviewApi): void {
    this.api = api
  }

  /**
   * Get the dockview API
   */
  getApi(): DockviewApi | null {
    return this.api
  }

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
   * Unregister callbacks (called by DockView component on unmount)
   */
  unregister(): void {
    this.minimizeCallback = null
    this.api = null
  }
}

export const dockviewService = new DockviewService()
