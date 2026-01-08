import { Toast } from "./toastService"

type IframeConfig = {
  key: string
  src: string
  preload?: boolean
}

class IframeManager {
  private configs: Map<string, IframeConfig> = new Map()

  register(config: IframeConfig) {
    this.configs.set(config.key, config)
  }

  preloadAll() {
    this.configs.forEach((config) => {
      if (config.preload !== false) {
        this.preloadIframe(config.key, config.src)
      }
    })
  }

  preloadIframe(key: string, src: string) {
    const w = window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined }
    if (w[key]) {
      console.log(`Iframe ${key} already exists`)
      return
    }

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.cssText = 'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none; display: none;'
    document.body.appendChild(iframe)

    w[key] = iframe

    iframe.addEventListener('load', () => {
      console.log(`Iframe ${key} preloaded and ready`)
      const evt = new CustomEvent(`${key}-ready`, { detail: { iframe } })
      window.dispatchEvent(evt)
    })
  }

  getIframe(key: string): HTMLIFrameElement | undefined {
    const w = window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined }
    return w[key]
  }

  async resetIframe(key: string, src?: string): Promise<HTMLIFrameElement | null> {
    const config = this.configs.get(key)
    const iframeSrc = src || config?.src

    if (!iframeSrc) {
      console.error(`No src found for iframe ${key}`)
      Toast.error('Failed to reset iframe')
      return null
    }

    try {
      const w = window as unknown as Window & { [key: string]: HTMLIFrameElement | undefined }
      const old = w[key]

      const newIframe = document.createElement('iframe')
      newIframe.src = iframeSrc
      newIframe.style.cssText = 'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none;'

      document.body.appendChild(newIframe)

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('iframe load timeout'))
        }, 8000)

        const onLoad = () => {
          clearTimeout(timeout)
          newIframe.removeEventListener('load', onLoad)
          resolve()
        }
        newIframe.addEventListener('load', onLoad)
      })

      const oldDisplay = old && typeof old.style !== 'undefined' ? old.style.display || 'none' : 'none'
      newIframe.style.display = oldDisplay

      w[key] = newIframe

      const evt = new CustomEvent(`${key}-ready`, { detail: { iframe: newIframe } })
      window.dispatchEvent(evt)

      if (old && old.parentElement && old !== newIframe) {
        try {
          old.remove()
        } catch (e) {
          console.warn(`Failed to remove old iframe ${key}`, e)
        }
      }

      console.log(`Iframe ${key} reset complete`)
      return newIframe
    } catch (err) {
      console.error(`resetIframe error for ${key}`, err)
      Toast.error('Failed to reset iframe')
      window.dispatchEvent(new CustomEvent(`${key}-ready`))
      return null
    }
  }
}

export const iframeManager = new IframeManager()

// Register known iframes
iframeManager.register({
  key: '__lc_preloaded_iframe',
  src: '/logic-easy/logic-circuits/index.html',
  preload: true
})

iframeManager.register({
  key: '__fsm_preloaded_iframe',
  src: '/logic-easy/fsm-engine/dist/index.html',
  preload: true
})
