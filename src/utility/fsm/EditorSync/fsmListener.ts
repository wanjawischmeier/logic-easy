/* eslint-disable @typescript-eslint/no-explicit-any */
import { effectScope, watch, type EffectScope } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { calcBinaryID, normalizeBits } from '../bitOperations'

let isSyncing = false
let isInitialized = false
let syncScope: EffectScope | null = null
let iframeReadyHandler: ((event: Event) => void) | null = null
let suppressIncomingEditorExport = false
let suppressIncomingEditorExportTimeout: ReturnType<typeof setTimeout> | null = null

function markSuppressIncomingEditorExport(): void {
  suppressIncomingEditorExport = true
  // Safety: if the editor never sends a response (e.g. still loading,
  // crashed, or the postMessage was lost), reset the flag after 3s so
  // future user-initiated exports aren't permanently blocked.
  if (suppressIncomingEditorExportTimeout) clearTimeout(suppressIncomingEditorExportTimeout)
  suppressIncomingEditorExportTimeout = setTimeout(() => {
    suppressIncomingEditorExport = false
    suppressIncomingEditorExportTimeout = null
  }, 3000)
}

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
    transitions: newFsm.transitions.map((t) => {
      const nodeBits = newFsm.nodeIdBitCount || 1
      const inBits = newFsm.inputBitCount || 1
      const outBits = newFsm.outputBitCount || 1
      const toBinary = normalizeBits(
        t.toBinaryId ?? (t.toNodeId >= 0 ? calcBinaryID(t.toNodeId, nodeBits) : ''),
        nodeBits,
        'x',
        'left',
      )
      const inputNorm = normalizeBits(t.input, inBits, 'x', 'right')
      const outputNorm = normalizeBits(
        newFsm.fsmModel === 'moore' ? '' : (t.mealyOutput ?? ''),
        outBits,
        'x',
        'right',
      )
      return {
        toBinaryId: toBinary,
        id: t.transitionId,
        groupId: (t as any).groupId ?? t.transitionId,
        from: t.fromNodeId,
        to: t.toNodeId,
        input: inputNorm,
        output: newFsm.fsmModel === 'moore' ? '' : outputNorm,
        mealy_output: newFsm.fsmModel === 'moore' ? '' : outputNorm,
      }
    }),
    fsmType: newFsm.fsmModel,
  }

  // Table-driven syncs should not be treated as editor-originated changes.
  // Otherwise the editor can export a derived payload back and trigger a false
  // roundtrip overwrite while we only intended to mirror table edits.
  markSuppressIncomingEditorExport()

  fsmIframe.contentWindow.postMessage(
    {
      action: 'fsmimport',
      fsm: editorPayload,
    },
    window.location.origin,
  )
}

// force a single sync to the editor, ignoring the flags
export function forceSyncTableToEditor(): void {
  const newFsm = stateManager.state.fsm
  if (!newFsm) return

  const fsmIframe = (window as any).__fsm_preloaded_iframe
  if (!fsmIframe?.contentWindow) return

  // mark that the next incoming editor export (in response) should be ignored
  markSuppressIncomingEditorExport()

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
    transitions: newFsm.transitions.map((t) => {
      const nodeBits = newFsm.nodeIdBitCount || 1
      const inBits = newFsm.inputBitCount || 1
      const outBits = newFsm.outputBitCount || 1
      return {
        toBinaryId: normalizeBits(
          t.toBinaryId ??
            (t.toNodeId >= 0 ? calcBinaryID(t.toNodeId, nodeBits) : ''),
          nodeBits,
          'x',
          'left',
        ),
        id: t.transitionId,
        groupId: (t as any).groupId ?? t.transitionId,
        from: t.fromNodeId,
        to: t.toNodeId,
        input: normalizeBits(t.input, inBits, 'x', 'right'),
        output:
          newFsm.fsmModel === 'moore'
            ? ''
            : normalizeBits(t.mealyOutput ?? '', outBits, 'x', 'right'),
        mealy_output:
          newFsm.fsmModel === 'moore'
            ? ''
            : normalizeBits(t.mealyOutput ?? '', outBits, 'x', 'right'),
      }
    }),
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

// returns true if the export was suppressed
export function consumeSuppressIncomingEditorExport(): boolean {
  const v = suppressIncomingEditorExport
  suppressIncomingEditorExport = false
  if (suppressIncomingEditorExportTimeout) {
    clearTimeout(suppressIncomingEditorExportTimeout)
    suppressIncomingEditorExportTimeout = null
  }
  return v
}

export function initFsmSyncService() {
  if (isInitialized) {
    disposeFsmSyncService()
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
