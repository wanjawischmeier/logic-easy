import { describe, expect, it } from 'vitest'
import { editorCore, editorHistory } from './support/editorHarness'

// ---------------------------------------------------------------------------
// Editor internals: the Konva/jotai side the app cannot reach directly
// ---------------------------------------------------------------------------

type TweenConfig = { onFinish?: () => void }

// Loads the konva instance the editor submodule itself resolves, so its tweens can be stubbed
async function loadEditorKonva(): Promise<Record<string, unknown>> {
  // konva from the submodule when installed, otherwise from the app
  const submoduleEntry = '../../../public/fsm-engine/node_modules/konva/lib/index.js'
  try {
    const mod = await import(/* @vite-ignore */ submoduleEntry)
    return mod.default as unknown as Record<string, unknown>
  } catch {
    const mod = await import('konva')
    return mod.default as unknown as Record<string, unknown>
  }
}

// Stubs Konva.Tween/Animation so a layout run can be driven without a real canvas
async function withStubbedKonva<T>(run: (tweens: TweenConfig[]) => Promise<T> | T): Promise<T> {
  const konva = await loadEditorKonva()
  const realTween = konva.Tween
  const realAnimation = konva.Animation
  const tweens: TweenConfig[] = []

  Object.defineProperty(konva, 'Tween', {
    value: class {
      constructor(config: TweenConfig) {
        tweens.push(config)
      }
      play() {}
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(konva, 'Animation', {
    value: class {
      start() {}
      stop() {}
    },
    configurable: true,
    writable: true,
  })

  try {
    return await run(tweens)
  } finally {
    Object.defineProperty(konva, 'Tween', { value: realTween, configurable: true, writable: true })
    Object.defineProperty(konva, 'Animation', {
      value: realAnimation,
      configurable: true,
      writable: true,
    })
  }
}

// Minimal Konva stage double; `missingId` simulates a state whose shape is not drawn (yet)
function fakeStage(missingId: number | null = null) {
  return {
    width: () => 800,
    height: () => 600,
    x: () => 0,
    y: () => 0,
    scaleX: () => 1,
    findOne: (selector: string) =>
      selector === `#state_${missingId}` ? null : { x: () => 0, y: () => 0 },
  }
}

// Swap in a fake parent frame for one call and always put jsdom's own window back,
// so a late editor timer never posts into an undefined parent
function withCapturedParentMessages(run: () => void): unknown[] {
  const messages: unknown[] = []
  const original = Object.getOwnPropertyDescriptor(window, 'parent')
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: { postMessage: (message: unknown) => messages.push(message) },
  })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(window, 'parent', original)
    else delete (window as unknown as Record<string, unknown>).parent
  }
  return messages
}

// The drawn node positions after one layout run
function laidOutPositions(nodes: unknown[]): Array<[number, number] | undefined> {
  return (nodes as Array<{ x: number; y: number } | undefined>).map((node) =>
    node ? [node.x, node.y] : undefined,
  )
}

describe('editor internals', () => {
  it('asks the app to create a state instead of minting an id itself', async () => {
    const { editor, stores } = await editorCore()
    const { store, node_list, editor_state } = stores

    store.set(node_list, [])
    store.set(editor_state, 'Add')

    const clickEvent = {
      target: {
        getStage: () => ({
          findOne: () => ({ getRelativePointerPosition: () => ({ x: 10, y: 20 }) }),
        }),
      },
    }

    const messages = withCapturedParentMessages(() => editor.HandleEditorClick(clickEvent))

    // the editor asks, it does not create
    expect(messages).toEqual([{ action: 'add-state-request', x: 10, y: 20 }])
    expect(store.get(node_list)).toEqual([])
  })

  it('asks the app to remove a state instead of deleting it locally', async () => {
    const { editor, stores } = await editorCore()
    const { store, node_list, editor_state } = stores

    store.set(node_list, [
      { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
      { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
    ])
    store.set(editor_state, 'Remove')

    const messages = withCapturedParentMessages(() =>
      editor.HandleStateClick({ cancelBubble: false, evt: { button: 0 } }, 1),
    )

    expect(messages).toEqual([{ action: 'remove-state-request', id: 1 }])
    // the app removes the state, so the editor keeps its nodes
    expect(store.get(node_list)).toHaveLength(2)
  })

  it('auto layout ignores hidden don\u2019t-care edges', async () => {
    await withStubbedKonva(async (tweens) => {
      const { editor, stores } = await editorCore()
      const { store, node_list, transition_list, stage_ref } = stores

      const layout = (transitions: unknown[]) => {
        store.set(stage_ref, fakeStage())
        store.set(node_list, [
          { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
          { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
        ])
        store.set(transition_list, transitions)
        tweens.length = 0
        editor.HandleAutoLayout()
        tweens.forEach((tween) => tween.onFinish?.())
        return laidOutPositions(store.get(node_list))
      }

      const edge = { id: 1, from: 0, to: 1, points: [], label: '0/0' }
      const hidden = { id: 2, from: 0, to: -1, points: [], label: '1/-', hiddenDontCare: true }

      const withoutHidden = layout([edge])
      const withHidden = layout([edge, hidden])

      // a hidden don't-care row has no target state and must not distort the layout
      expect(withHidden).toEqual(withoutHidden)
    })
  })

  it('auto layout still commits positions when a node shape is missing', async () => {
    await withStubbedKonva(async (tweens) => {
      const { editor, stores } = await editorCore()
      const { store, node_list, transition_list, stage_ref } = stores

      const layout = (missingId: number | null) => {
        store.set(stage_ref, fakeStage(missingId))
        store.set(node_list, [
          { id: 0, name: 'q0', x: 0, y: 0, radius: 40, transitions: [] },
          { id: 1, name: 'q1', x: 0, y: 0, radius: 40, transitions: [] },
        ])
        store.set(transition_list, [{ id: 1, from: 0, to: 1, points: [], label: '0/0' }])
        tweens.length = 0
        editor.HandleAutoLayout()
        tweens.forEach((tween) => tween.onFinish?.())
        return laidOutPositions(store.get(node_list))
      }

      const complete = layout(null)
      const missingShape = layout(1)

      expect(complete[0]).not.toEqual([0, 0])
      // a state without a drawn shape must not swallow the whole commit
      expect(missingShape).toEqual(complete)
    })
  })
})

describe('editor history and settings', () => {
  it('undoes editor state changes from the pre-change snapshot', async () => {
    const { stores, settings, history } = await editorHistory()

    // jsdom has no canvas, so the undo must not try to animate a real stage
    stores.store.set(stores.stage_ref, null)
    history.clearHistory()
    stores.store.set(stores.node_list, [
      {
        id: 0,
        name: 'q0',
        x: 0,
        y: 0,
        radius: 40,
        fill: '#4a6fae88',
        type: { initial: false, intermediate: true },
        transitions: [],
      },
    ])
    stores.store.set(stores.transition_list, [])
    stores.store.set(stores.current_selected, 0)
    stores.store.set(stores.initial_state, null)
    stores.store.set(stores.fsm_type, 'mealy')
    stores.store.set(stores.editor_state, 'settings')

    settings.HandleSaveSettings('renamed', '#4a6fae', { initial: false })
    expect(stores.store.get(stores.node_list)[0].name).toBe('renamed')

    history.undo(() => [])
    expect(stores.store.get(stores.node_list)[0].name).toBe('q0')
  })
})
