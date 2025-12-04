type LoadOptions = {
  url?: string;
  content?: string;
};

class LogicCircuitsWrapper {
  preloadIFrame(src = '/logic-easy/logic-circuits/index.html') {
    const preloadIframe = document.createElement('iframe');
    preloadIframe.src = src;
    preloadIframe.style.cssText = 'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px;';
    document.body.appendChild(preloadIframe);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lc_preloaded_iframe = preloadIframe;
    console.log('Preloading Logic Circuits iframe...');
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

    // Get the preloaded iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iframe = (window as any).__lc_preloaded_iframe as HTMLIFrameElement | undefined;

    if (!iframe) {
      console.warn('LogicCircuitsLoader: Preloaded iframe not available yet');
      return false;
    }

    // Try to deliver to iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iframeWin = iframe.contentWindow as (Window & { LogicCircuits?: any }) | undefined;
    if (iframeWin && iframeWin.LogicCircuits && typeof iframeWin.LogicCircuits.loadFile === 'function') {
      iframeWin.LogicCircuits.loadFile(fileContent);
      console.log('LogicCircuitsLoader: Delivered file to iframe');
      return true;
    }

    console.warn('LogicCircuitsLoader: LogicCircuits API not available in iframe');
    return false;
  }
}

export const logicCircuits = new LogicCircuitsWrapper();
