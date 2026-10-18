export function closeFsmEditorPopups(): void {
  const iframe = (window as Window & { __fsm_preloaded_iframe?: HTMLIFrameElement })
    .__fsm_preloaded_iframe
  iframe?.contentWindow?.postMessage({ action: 'close-popups' }, window.location.origin)
}
