import { iframeManager } from '@/utility/iframeManager'

type LoadOptions = {
  url?: string
  content?: string
}

type LogicCircuitsWindow = Window & {
  __lc_preloaded_iframe?: HTMLIFrameElement
  lcText?: string
  LogicCircuits?:
    | {
        loadFile?: (text: string) => void
        simulatorController?: {
          simulator?: {
            gateArray: unknown[]
            wireNodeArray: unknown[]
            wireArray: unknown[]
            textArray: unknown[]
            camera: unknown
            deleteAll?: () => void
          }
        }
        FileHandler?: {
          simulatorToFile?: (
            gateArray: unknown[],
            wireNodeArray: unknown[],
            wireArray: unknown[],
            textArray: unknown[],
            camera: unknown,
          ) => string
        } | null
      }
    | undefined
}

class LogicCircuitsWrapper {
  async loadFile(options: LoadOptions): Promise<boolean> {
    const { url, content } = options

    // Must have either url or content
    if (!url && !content) {
      console.warn('LogicCircuitsLoader: No url or content provided')
      return false
    }

    let fileContent: string

    // Prefer content, fallback to url
    if (content) {
      fileContent = content
    } else if (url) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('Fetch failed: ' + resp.status)
        fileContent = await resp.text()
      } catch (err) {
        console.error('LogicCircuitsLoader: Failed to fetch from url', err)
        return false
      }
    } else {
      return false
    }

    // Store in window for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).lcText = fileContent
    console.log('LogicCircuitsLoader: Loaded file (length:', fileContent.length, ')')

    // Fast path: replace contents in the currently running iframe first.
    const existingIframe = iframeManager.getIframe('__lc_preloaded_iframe')
    if (existingIframe && this.replacePayloadInIframe(existingIframe, fileContent)) {
      console.log('LogicCircuitsLoader: Replaced file without iframe reset')
      return true
    }

    // Create a fresh iframe and deliver the file as part of the reset operation.
    // resetIFrame will create the new iframe, wait for it to be ready and deliver the payload once.
    try {
      const newIframe = await this.resetIFrame(undefined, fileContent)
      if (!newIframe) {
        console.warn('LogicCircuitsLoader: Failed to reset iframe before delivering file')
        return false
      }
      console.log('LogicCircuitsLoader: resetIFrame completed and should have delivered payload')
      return true
    } catch (err) {
      console.error('LogicCircuitsLoader: Error during resetIFrame delivery', err)
      return false
    }
  }

  async resetIFrame(
    src = '/logic-easy/logic-circuits/index.html',
    fileContent?: string,
  ): Promise<HTMLIFrameElement | null> {
    const newIframe = await iframeManager.resetIframe('__lc_preloaded_iframe', src)

    if (!newIframe) {
      return null
    }

    // Deliver payload if provided or if window.lcText exists
    const w = window as unknown as LogicCircuitsWindow
    const payload = fileContent ?? w.lcText

    if (payload) {
      const delivered = this.deliverPayloadToIframe(newIframe, payload, 'new iframe')
      if (!delivered) {
        console.error('LogicCircuitsLoader: Failed to deliver payload to new iframe')
      }
    }

    return newIframe
  }

  private deliverPayloadToIframe(
    iframe: HTMLIFrameElement,
    payload: string,
    targetLabel: string,
  ): boolean {
    try {
      const win = iframe.contentWindow
      if (!win) {
        return false
      }

      if ((win as LogicCircuitsWindow)?.LogicCircuits?.loadFile) {
        try {
          ;(win as LogicCircuitsWindow).LogicCircuits!.loadFile!(payload)
          console.log(`LogicCircuitsLoader: Delivered file to ${targetLabel} via API call`)
          return true
        } catch (err) {
          console.error(
            `LogicCircuitsLoader: API delivery failed on ${targetLabel}, falling back to postMessage`,
            err,
          )
          win.postMessage({ type: 'logic-load', text: payload }, '*')
          return true
        }
      }

      win.postMessage({ type: 'logic-load', text: payload }, '*')
      console.log(`LogicCircuitsLoader: Posted file to ${targetLabel} via postMessage`)
      return true
    } catch (error) {
      console.error(`LogicCircuitsLoader: Payload delivery failed on ${targetLabel}`, error)
      return false
    }
  }

  private replacePayloadInIframe(iframe: HTMLIFrameElement, payload: string): boolean {
    const win = iframe.contentWindow as LogicCircuitsWindow | null
    const simulator = win?.LogicCircuits?.simulatorController?.simulator

    if (!simulator || typeof simulator.deleteAll !== 'function') {
      return false
    }

    try {
      simulator.deleteAll()
    } catch (error) {
      console.error('LogicCircuitsLoader: Failed to clear existing circuit before load', error)
      return false
    }

    return this.deliverPayloadToIframe(iframe, payload, 'existing iframe')
  }

  async exportCurrentLC(): Promise<string | null> {
    const iframe = iframeManager.getIframe('__lc_preloaded_iframe')
    const win = iframe?.contentWindow as LogicCircuitsWindow | null
    if (!win) {
      return null
    }

    try {
      const simulator = win.LogicCircuits?.simulatorController?.simulator
      const toFile = win.LogicCircuits?.FileHandler?.simulatorToFile

      if (!simulator || typeof toFile !== 'function') {
        return null
      }

      return toFile(
        simulator.gateArray,
        simulator.wireNodeArray,
        simulator.wireArray,
        simulator.textArray,
        simulator.camera,
      )
    } catch (error) {
      console.error('LogicCircuitsLoader: Failed to export current LC content', error)
      return null
    }
  }
}

export const logicCircuits = new LogicCircuitsWrapper()
