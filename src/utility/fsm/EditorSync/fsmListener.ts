/* eslint-disable @typescript-eslint/no-explicit-any */
import { effectScope, watch, type EffectScope } from 'vue'
import { stateManager } from '@/projects/stateManager'
import { calcBinaryID, normalizeBits } from '../bitOperations'
import { validateFsm } from './fsmValidation'

let isSyncing = false
let isInitialized = false
let syncScope: EffectScope | null = null
let iframeReadyHandler: ((event: Event) => void) | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

// Debounce table-driven syncs so fast toggling coalesces into one editor update
function scheduleTableSync() {
  console.log('[FSM] table changed, scheduling editor sync (120ms debounce)')
  const newFsm = stateManager.state.fsm
  if (newFsm && !validateFsm(newFsm).valid) {
    console.log('[FSM] table-to-editor sync paused while the FSM is invalid')
    if (syncTimer) {
      clearTimeout(syncTimer)
      syncTimer = null
    }
    return
  }
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncTableToEditor()
  }, 120)
}

function buildFsmImportPayload(newFsm: NonNullable<typeof stateManager.state.fsm>) {
  return {
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
    inputBitCount: newFsm.inputBitCount || 1,
    outputBitCount: newFsm.outputBitCount || 1,
  }
}

function syncTableToEditor() {
  const newFsm = stateManager.state.fsm
  if (isSyncing || !newFsm) return

  // Never push an invalid automaton back to the editor (the editor keeps its last valid state while locked)
  const validity = validateFsm(newFsm)
  console.log('[FSM] syncTableToEditor: validating table', {
    model: newFsm.fsmModel,
    nodes: newFsm.nodes,
    transitions: newFsm.transitions,
  })
  if (!validity.valid) {
    console.log('[FSM] syncTableToEditor: SKIPPED (invalid) ->', validity.reason)
    return
  }
  console.log('[FSM] syncTableToEditor: table valid, mirroring to editor')

  const fsmIframe = (window as any).__fsm_preloaded_iframe
  if (!fsmIframe?.contentWindow) return

  // One-way mirror: the editor suppresses its own echo while importing, so the
  // table stays the source of truth and no roundtrip can overwrite it
  const payload = buildFsmImportPayload(newFsm)
  console.log('[FSM] syncTableToEditor: sending fsmimport payload', payload)
  fsmIframe.contentWindow.postMessage(
    {
      action: 'fsmimport',
      fsm: payload,
    },
    window.location.origin,
  )
}

// force a single sync to the editor, ignoring the flags
export function forceSyncTableToEditor(): void {
  const newFsm = stateManager.state.fsm
  if (!newFsm) return

  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }

  // Never push an invalid automaton back to the editor 
  const validity = validateFsm(newFsm)
  console.log('[FSM] forceSyncTableToEditor: validating table', {
    model: newFsm.fsmModel,
    nodes: newFsm.nodes,
    transitions: newFsm.transitions,
  })
  if (!validity.valid) {
    console.log('[FSM] forceSyncTableToEditor: SKIPPED (invalid) ->', validity.reason)
    return
  }
  console.log('[FSM] forceSyncTableToEditor: table valid, forcing mirror to editor')

  const fsmIframe = (window as any).__fsm_preloaded_iframe
  if (!fsmIframe?.contentWindow) return

  const payload = buildFsmImportPayload(newFsm)
  console.log('[FSM] forceSyncTableToEditor: sending fsmimport payload', payload)
  fsmIframe.contentWindow.postMessage(
    {
      action: 'fsmimport',
      fsm: payload,
    },
    window.location.origin,
  )
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
        if (isSyncing) return
        scheduleTableSync()
      },
      { deep: true },
    )
  })

  syncTableToEditor()
}

export function disposeFsmSyncService() {
  isSyncing = false
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
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
