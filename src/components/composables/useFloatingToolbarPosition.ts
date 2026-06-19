import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { getDockviewApi } from '@/utility/dockview/integration'

// floating button (settings, etc.) positioner, etc. for iframes
export function useFloatingToolbarPosition(panelRef: Ref<HTMLElement | null>, offset = 8) {
  const style = ref<{ right?: string; top?: string }>({})
  let observer: ResizeObserver | null = null
  let layoutDisposable: { dispose?: () => void } | null | undefined = null

  function update() {
    if (!panelRef.value) return
    const rect = panelRef.value.getBoundingClientRect()
    style.value = {
      right: `${window.innerWidth - rect.right + offset}px`,
      top: `${rect.top + offset}px`,
    }
  }

  onMounted(() => {
    update()
    observer = new ResizeObserver(update)
    if (panelRef.value) observer.observe(panelRef.value)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    layoutDisposable = getDockviewApi()?.onDidLayoutChange(update)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
    layoutDisposable?.dispose?.()
    layoutDisposable = null
  })

  return { style }
}
