import { iframeManager } from '@/utility/iframeManager'

type LoadOptions = {
  url?: string;
  content?: string;
};

type LogicCircuitsWindow = Window & {
  __lc_preloaded_iframe?: HTMLIFrameElement;
  lcText?: string;
  LogicCircuits?: { loadFile?: (text: string) => void } | undefined;
};

class LogicCircuitsWrapper {
  async loadFile(options: LoadOptions): Promise<boolean> {
    const { url, content } = options;

    // Must have either url or content
    if (!url && !content) {
      console.warn('LogicCircuitsLoader: No url or content provided');
      return false;
    }

    let fileContent: string;

    // Prefer content, fallback to url
    if (content) {
      fileContent = content;
    } else if (url) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
        fileContent = await resp.text();
      } catch (err) {
        console.error('LogicCircuitsLoader: Failed to fetch from url', err);
        return false;
      }
    } else {
      return false;
    }

    // Store in window for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).lcText = fileContent;
    console.log('LogicCircuitsLoader: Loaded file (length:', fileContent.length, ')');

    // Create a fresh iframe and deliver the file as part of the reset operation.
    // resetIFrame will create the new iframe, wait for it to be ready and deliver the payload once.
    try {
      const newIframe = await this.resetIFrame(undefined, fileContent);
      if (!newIframe) {
        console.warn('LogicCircuitsLoader: Failed to reset iframe before delivering file');
        return false;
      }
      console.log('LogicCircuitsLoader: resetIFrame completed and should have delivered payload');
      return true;
    } catch (err) {
      console.error('LogicCircuitsLoader: Error during resetIFrame delivery', err);
      return false;
    }
  }

  async resetIFrame(src = '/logic-easy/logic-circuits/index.html', fileContent?: string): Promise<HTMLIFrameElement | null> {
    const newIframe = await iframeManager.resetIframe('__lc_preloaded_iframe', src)

    if (!newIframe) {
      return null
    }

    // Deliver payload if provided or if window.lcText exists
    const w = window as unknown as LogicCircuitsWindow
    const payload = fileContent ?? w.lcText

    if (payload) {
      try {
        const win = newIframe.contentWindow
        if ((win as LogicCircuitsWindow)?.LogicCircuits?.loadFile) {
          try {
            (win as LogicCircuitsWindow).LogicCircuits!.loadFile!(payload)
            console.log('LogicCircuitsLoader: Delivered file to new iframe via API call')
          } catch (err) {
            console.error('LogicCircuitsLoader: API delivery failed on new iframe, falling back to postMessage', err)
            win?.postMessage({ type: 'logic-load', text: payload }, '*')
          }
        } else {
          win?.postMessage({ type: 'logic-load', text: payload }, '*')
          console.log('LogicCircuitsLoader: Posted file to new iframe via postMessage')
        }
      } catch (e) {
        console.error('LogicCircuitsLoader: Failed to deliver payload to new iframe', e)
      }
    }

    return newIframe
  }
}

export const logicCircuits = new LogicCircuitsWrapper();
