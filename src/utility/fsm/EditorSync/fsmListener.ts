/* eslint-disable @typescript-eslint/no-explicit-any */
import { effectScope, watch, type EffectScope } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { calcBinaryID, normalizeBits } from '../bitOperations'

let isSyncing = false
let isInitialized = false
let syncScope: EffectScope | null = null
let iframeReadyHandler: ((event: Event) => void) | null = null
function syncTableToEditor() {
  const newFsm = stateManager.state.fsm
  if (isSyncing || !newFsm) return

  const fsmIframe = (window as any).__fsm_preloaded_iframe
  if (!fsmIframe?.contentWindow) return

  const editorPayload = {
    states: newFsm.nodes.map((n) => ({
      id: n.nodeId,
      name: n.name,
      initial: n.isInitial,
      final: n.isFinal,
      x: n.editorCoordX,
      y: n.editorCoordY,
      moore_output: n.mooreOutput || '',
    })),
    transitions: newFsm.transitions.map((t) => ({
      toBinaryId: normalizeBits(
        t.toBinaryId ??
          (t.toNodeId >= 0 ? calcBinaryID(t.toNodeId, newFsm.nodeIdBitCount || 1) : ''),
        newFsm.nodeIdBitCount || 1,
        'x',
        'left',
      ),
      id: t.transitionId,
      from: t.fromNodeId,
      to: t.toNodeId,
      input: t.input,
      output: t.mealyOutput || '',
      mealy_output: t.mealyOutput || '',
    })),
    fsmType: newFsm.fsmModel,
  }

  fsmIframe.contentWindow.postMessage(
    {
      action: 'fsmimport',
      fsm: editorPayload,
    },
    window.location.origin,
  )
}

export function initFsmSyncService() {
  if (isInitialized) {
    syncTableToEditor()
    return
  }

  isInitialized = true

  iframeReadyHandler = () => syncTableToEditor()

  window.addEventListener('__fsm_preloaded_iframe-ready', iframeReadyHandler as EventListener)

  syncScope = effectScope()
  syncScope.run(() => {
    watch(
      () => stateManager.state.fsm,
      () => {
        // updates are handled centralized in project 
        syncTableToEditor()
      },
      { deep: true },
    )
  })

  syncTableToEditor()
}

export function disposeFsmSyncService() {
  if (iframeReadyHandler) {
    window.removeEventListener('__fsm_preloaded_iframe-ready', iframeReadyHandler as EventListener)
    iframeReadyHandler = null
  }

  syncScope?.stop()
  syncScope = null
  isInitialized = false
}

export function useFsmListener() {
  initFsmSyncService()
}

export function setIsSyncing(flag: boolean) {
  isSyncing = flag
}

export function getIsSyncing(): boolean {
  return isSyncing
}
