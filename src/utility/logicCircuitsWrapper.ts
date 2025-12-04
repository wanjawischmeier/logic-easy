type LoadOptions = {
  url?: string;
  content?: string;
};

// Lightweight local window augmentation to avoid `any`
type LogicCircuitsWindow = Window & {
  __lc_preloaded_iframe?: HTMLIFrameElement;
  lcText?: string;
  LogicCircuits?: { loadFile?: (text: string) => void } | undefined;
};

class LogicCircuitsWrapper {
  preloadIFrame(src = '/logic-easy/logic-circuits/index.html') {
    // reuse resetIFrame to create the iframe (fire-and-forget)
    void this.resetIFrame(src);
  }

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
      // resetIFrame already attempts delivery (API call or postMessage).
      console.log('LogicCircuitsLoader: resetIFrame completed and should have delivered payload');
      return true;
    } catch (err) {
      console.error('LogicCircuitsLoader: Error during resetIFrame delivery', err);
      return false;
    }
  }

  // Replace sync resetIFrame with an async version that waits for load and then swaps frames.
  async resetIFrame(src = '/logic-easy/logic-circuits/index.html', fileContent?: string): Promise<HTMLIFrameElement | null> {
    try {
      const w = window as unknown as LogicCircuitsWindow;
      const old = w.__lc_preloaded_iframe;

      // Create and hide the new iframe (positioned offscreen)
      const newIframe = document.createElement('iframe');
      newIframe.src = src;
      newIframe.style.cssText = 'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none;';

      // Append then wait for load (with a timeout to avoid hanging)
      document.body.appendChild(newIframe);

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('iframe load timeout'));
        }, 8000);

        const onLoad = () => {
          clearTimeout(timeout);
          newIframe.removeEventListener('load', onLoad);
          resolve();
        };
        newIframe.addEventListener('load', onLoad);
      });

      // Preserve old display state (so visible panels keep iframe visible)
      const oldDisplay =
        old && typeof old.style !== 'undefined' ? old.style.display || 'none' : 'none';
      newIframe.style.display = oldDisplay;

      // Swap the global reference atomically
      w.__lc_preloaded_iframe = newIframe;

      // Notify listeners that a new iframe is ready
      const evt = new CustomEvent('lc-iframe-ready', { detail: { iframe: newIframe } });
      window.dispatchEvent(evt);

      // Remove old iframe after new one is ready
      if (old && old.parentElement && old !== newIframe) {
        try {
          old.remove();
        } catch (e) {
          console.warn('Failed to remove old preloaded iframe', e);
        }
      }

      // Deliver payload if provided or if window.lcText exists
      const payload = fileContent ?? w.lcText;

      if (payload) {
        try {
          const win = newIframe.contentWindow;
          // try API first (if injected by bundle)
          if ((win as LogicCircuitsWindow)?.LogicCircuits?.loadFile) {
            try {
              (win as LogicCircuitsWindow).LogicCircuits!.loadFile!(payload);
              console.log('LogicCircuitsLoader: Delivered file to new iframe via API call');
            } catch (err) {
              console.error('LogicCircuitsLoader: API delivery failed on new iframe, falling back to postMessage', err);
              win?.postMessage({ type: 'logic-load', text: payload }, '*');
            }
          } else {
            win?.postMessage({ type: 'logic-load', text: payload }, '*');
            console.log('LogicCircuitsLoader: Posted file to new iframe via postMessage');
          }
        } catch (e) {
          console.error('LogicCircuitsLoader: Failed to deliver payload to new iframe', e);
        }
      } else {
        console.log('LogicCircuitsLoader: new iframe ready (no payload)');
      }

      // load finished
      window.dispatchEvent(new CustomEvent('lc-iframe-ready', { detail: { iframe: newIframe } }));
      console.log('Preloading Logic Circuits iframe (async reset) complete');
      return newIframe;
    } catch (err) {
      console.error('resetIFrame error', err);
      window.dispatchEvent(new CustomEvent('lc-iframe-ready'));
      return null;
    }
  }
}

export const logicCircuits = new LogicCircuitsWrapper();
