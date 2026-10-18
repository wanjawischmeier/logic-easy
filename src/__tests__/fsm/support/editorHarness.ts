import { buildFsmImportPayload } from '@/utility/fsm/EditorSync/fsmListener'
import { importEditorPayload } from '@/projects/state-machine/fsmEditorImportHelpers'
import { ensureTransitionMatrix } from '@/utility/fsm/EditorSync/fsmStateTableUtils'
import type { FsmState } from '@/projects/state-machine/FsmTypes'

// The editor submodule ships plain JS without type declarations, so the module
// accessors are the single place where the missing types have to be silenced
export async function editorModules() {
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const stores = await import('../../../../public/fsm-engine/src/lib/stores.js')
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const exportModule = await import('../../../../public/fsm-engine/src/lib/export.js')
  return { stores, exportModule }
}

// The editor canvas and its state helpers
export async function editorCore() {
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const editor = await import('../../../../public/fsm-engine/src/lib/editor.js')
  const { stores } = await editorModules()
  return { stores, editor }
}

// The state settings popup and the undo history behind it
export async function editorHistory() {
  const { stores } = await editorModules()
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const settings = await import('../../../../public/fsm-engine/src/lib/settings.js')
  // @ts-expect-error - the editor submodule ships plain JS without type declarations
  const history = await import('../../../../public/fsm-engine/src/lib/history.js')
  return { stores, settings, history }
}

// Imports a payload the way the app posts it: no canvas, so the render cleanup stays out of the way
export async function importIntoEditor(payload: unknown) {
  const { stores, exportModule } = await editorModules()
  exportModule.clearFsmFromParent()
  stores.store.set(stores.stage_ref, null)
  exportModule.applyFsmImport(payload)
  return { stores, exportModule }
}

// End to end over the real wire format: app -> payload -> editor -> export -> app
export async function throughEditor(state: FsmState): Promise<FsmState> {
  const { stores, exportModule } = await editorModules()
  exportModule.clearFsmFromParent()
  // No canvas in the tests, so the render cleanup must stay out of the way
  stores.store.set(stores.stage_ref, null)
  exportModule.applyFsmImport(buildFsmImportPayload(state))
  const { nodes, transitions } = importEditorPayload(exportModule.extractFsmData(), state)

  const next: FsmState = { ...state, nodes, transitions }
  ensureTransitionMatrix(next)
  return next
}
