import { iframeManager } from './iframeManager'

type KeydownHandler = (event: KeyboardEvent) => void

// Bind a keydown handler to all iframes, including those that are added later
export function bindIframeShortcuts(handler: KeydownHandler): () => void {
  const boundDocs = new Map<string, Document>()

  const bind = (key: string) => {
    const contentWindow = iframeManager.getIframe(key)?.contentWindow
    if (!contentWindow) return

    let doc: Document
    try {
      doc = contentWindow.document
    } catch {
      // Not same-origin, shortcuts stay inside that iframe
      return
    }

    // Re-bind when a navigation or reset swaps the document (about:blank -> app)
    if (boundDocs.get(key) === doc) return

    contentWindow.addEventListener('keydown', handler)
    boundDocs.set(key, doc)
  }

  const keys = iframeManager.getKeys()
  keys.forEach(bind)

  const readyHandlers = keys.map((key) => {
    const onReady = () => bind(key)
    window.addEventListener(`${key}-ready`, onReady)
    return { key, onReady }
  })

  return () => {
    readyHandlers.forEach(({ key, onReady }) => window.removeEventListener(`${key}-ready`, onReady))
    keys.forEach((key) => {
      const contentWindow = iframeManager.getIframe(key)?.contentWindow
      contentWindow?.removeEventListener('keydown', handler)
    })
    boundDocs.clear()
  }
}
