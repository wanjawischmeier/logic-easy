<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, defineComponent, h, type Component } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import IframePanel from '@/components/IFramePanel.vue'
import LegendButton, { type LegendItem } from '@/components/parts/buttons/LegendButton.vue'
import {
  setIsSyncing,
  useFsmListener,
  forceSyncTableToEditor,
  consumeSuppressIncomingEditorExport,
} from '@/utility/fsm/EditorSync/fsmListener'
import { stateManager } from '@/projects/stateManager'
import { FsmProject } from '@/projects/state-machine/FsmProject'
import { getDockviewApi } from '@/utility/dockview/integration'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null
type IframePanelExpose = {
  getIframe: () => HTMLIFrameElement | undefined
}

const iframeRef = ref<IframePanelExpose | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const legendButtonStyle = ref<{ right?: string; top?: string }>({})

const StateIcon = defineComponent({
  template: `
    <div class="w-10 h-10 flex items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="#4a6fae88" />
      </svg>
    </div>
  `,
})

const TransitionIcon = defineComponent({
  template: `
    <div class="w-10 h-6 flex items-center justify-center">
      <svg width="40" height="14" viewBox="0 0 40 14" aria-hidden="true">
        <line x1="4" y1="7" x2="32" y2="7" stroke="#ffffffdd" stroke-width="2" />
        <polygon points="32,3 38,7 32,11" fill="#ffffffdd" />
      </svg>
    </div>
  `,
})

const MoveIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v18M3 12h18" />
        <path d="m12 3 3 3M12 3 9 6M12 21l3-3M12 21l-3-3M3 12l3 3M3 12l3-3M21 12l-3 3M21 12l-3-3" />
      </svg>
    </div>
  `,
})

const ConnectIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z" />
        <path d="M17 21v-2" />
        <path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10" />
        <path d="M21 21v-2" />
        <path d="M3 5V3" />
        <path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z" />
        <path d="M7 5V3" />
      </svg>
    </div>
  `,
})

const AddIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" fill="#ffffff10" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    </div>
  `,
})

const RemoveIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" fill="#ffffff10" />
        <path d="M7 12h10" />
      </svg>
    </div>
  `,
})

const SparklesIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" fill="#ffffff10" />
        <path d="M19 13l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13z" />
      </svg>
    </div>
  `,
})

const UndoIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 10H4V5" />
        <path d="M4 10c2-3 5-4 8-4 4 0 7 3 7 7s-3 7-7 7H9" />
      </svg>
    </div>
  `,
})

const RedoIcon = defineComponent({
  template: `
    <div class="w-6 h-6 flex items-center justify-center text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 10h5V5" />
        <path d="M20 10c-2-3-5-4-8-4-4 0-7 3-7 7s3 7 7 7h4" />
      </svg>
    </div>
  `,
})

function makeKeycap(text: string) {
  return defineComponent({
    name: `Keycap${text.replace(/[^a-zA-Z0-9]+/g, '')}`,
    template: `
      <div class="min-w-14 h-6 px-2 inline-flex items-center justify-center rounded-md border border-surface-3 bg-surface-2 text-white text-[10px] font-mono leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.45)]">
        ${text}
      </div>
    `,
  })
}

function makeActionWithShortcut(iconComponent: Component, shortcutComponent: Component) {
  return defineComponent({
    setup() {
      return () =>
        h('div', { class: 'flex items-center justify-center gap-2 whitespace-nowrap' }, [
          h(iconComponent),
          h(shortcutComponent),
        ])
    },
  })
}

const AltSKeycap = makeKeycap('Alt+S')
const AltRKeycap = makeKeycap('Alt+R')
const AltZKeycap = makeKeycap('Alt+Z')
const AltYKeycap = makeKeycap('Alt+Y')
const AltAKeycap = makeKeycap('Alt+A')

const AddAction = makeActionWithShortcut(AddIcon, AltSKeycap)
const RemoveAction = makeActionWithShortcut(RemoveIcon, AltRKeycap)
const AutoLayoutAction = makeActionWithShortcut(SparklesIcon, AltAKeycap)
const UndoAction = makeActionWithShortcut(UndoIcon, AltZKeycap)
const RedoAction = makeActionWithShortcut(RedoIcon, AltYKeycap)

const getFsmIframe = () => {
  const windowWithIframe = window as Window & { __fsm_preloaded_iframe?: HTMLIFrameElement }
  return iframeRef.value?.getIframe?.() ?? windowWithIframe.__fsm_preloaded_iframe
}

const legend: LegendItem[] = [
  {
    component: StateIcon,
    label: 'State',
    description:
      'Each circle represents a state. The state label is the state name or, additionally, the output bits in Moore mode',
  },
  {
    component: TransitionIcon,
    label: 'Transition',
    description:
      'Directed arrows connect states. The transition labels represent the input / output bits or, in Moore mode, only the output bits',
  },
  {
    component: MoveIcon,
    label: 'Move',
    description: 'Select the Move tool to reposition states by dragging them.',
  },
  {
    component: AddAction,
    label: 'Add state',
    description: 'Create a new state using the Add button or the Alt+S shortcut.',
  },
  {
    component: ConnectIcon,
    label: 'Connect',
    description: 'Select the Connect tool to create transitions between states.',
  },
  {
    component: RemoveAction,
    label: 'Remove',
    description: 'Delete the selected item using the Remove button or the Alt+R shortcut.',
  },
  {
    component: UndoAction,
    label: 'Undo',
    description: 'Revert the most recent change using the Undo button or the Alt+Z shortcut.',
  },
  {
    component: RedoAction,
    label: 'Redo',
    description:
      'Restore the most recently undone change using the Redo button or the Alt+Y shortcut.',
  },
  {
    component: AutoLayoutAction,
    label: 'Auto layout',
    description: 'Automatically rearrange the graph using the Auto Layout button or Alt+A.',
  },
]

let messageHandler: ((event: MessageEvent) => void) | null = null
let layoutDisposable: any = null

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  // Position the teleported legend button so it aligns with the panel
  const updateLegendPosition = () => {
    if (!panelRef.value) return
    const rect = panelRef.value.getBoundingClientRect()
    // read panel padding so the teleport aligns with the internal header layout
    const style = window.getComputedStyle(panelRef.value)
    const paddingTop = parseFloat(style.paddingTop || '0') || 0
    const paddingRight = parseFloat(style.paddingRight || '0') || 0

    // Align teleported header exactly with the panel content area
    const top = rect.top + paddingTop
    const right = window.innerWidth - rect.right + paddingRight

    legendButtonStyle.value = {
      right: `${right}px`,
      top: `${top}px`,
    }
  }

  const ro = new ResizeObserver(updateLegendPosition)
  if (panelRef.value) ro.observe(panelRef.value)
  window.addEventListener('scroll', updateLegendPosition, true)
  window.addEventListener('resize', updateLegendPosition)
  layoutDisposable = getDockviewApi()?.onDidLayoutChange(() => updateLegendPosition())

  // initial position
  updateLegendPosition()

  // store cleanup on beforeUnmount
  disposable = {
    dispose: () => {
      ro.disconnect()
      window.removeEventListener('scroll', updateLegendPosition, true)
      window.removeEventListener('resize', updateLegendPosition)
    },
  }
})

onMounted(() => {
  // Initialize FSM outbound sync when the FSM panel mounts.
  useFsmListener()

  // handle editor -> app exports: delegate concrete state handling to FsmProject
  messageHandler = (event: MessageEvent) => {
    const fsmIframe = getFsmIframe()
    if (!fsmIframe) return
    if (event.origin !== window.location.origin || event.source !== fsmIframe.contentWindow) return

    const data = event.data || {}
    if ((data.action === 'export' || data.action === 'editorToTableExport') && data.fsm) {
      // if we suppressed the next editor export (because we forced a sync), consume suppression and ignore
      if (consumeSuppressIncomingEditorExport()) {
        return
      }

      try {
        setIsSyncing(true)
        FsmProject.importEditorExport(data.fsm)
      } finally {
        // Always force-sync after an editor import. The importEditorExport
        // call renumbers node IDs sequentially, but the editor still holds
        // the original IDs. Without a sync-back the editor and app diverge,
        // causing broken transitions and stale states on every add/remove.
        // suppressIncomingEditorExport inside forceSyncTableToEditor prevents
        // the echo from re-entering this handler.
        setTimeout(() => {
          setIsSyncing(false)
          forceSyncTableToEditor()
        }, 50)
      }
    }
  }

  window.addEventListener('message', messageHandler)
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
  if (messageHandler) window.removeEventListener('message', messageHandler)
})
</script>

<template>
  <div class="h-full text-white flex flex-col p-2 bg-surface">
    <div ref="panelRef" class="flex justify-end items-center h-10 mb-2 gap-2">
      <!-- Legend button is teleported to body so it renders above the iframe like LogicCircuitsPanel -->
      <teleport to="body">
        <div class="fixed z-50 flex justify-end items-center h-10 gap-2" :style="legendButtonStyle">
          <div class="flex items-center h-10 gap-2">
            <LegendButton :legend="legend" />
          </div>
        </div>
      </teleport>
    </div>

    <IframePanel
      ref="iframeRef"
      iframe-key="__fsm_preloaded_iframe"
      src="/logic-easy/fsm-engine/dist/index.html"
      :visible="params.api.isVisible"
      class="flex-1 border-none"
    />
  </div>
</template>

<style scoped></style>
