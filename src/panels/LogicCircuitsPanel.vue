<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject.ts'
import { logicCircuits } from '@/utility/logicCircuitsWrapper.ts'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import IframePanel from '@/components/IFramePanel.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import { projectManager } from '@/projects/projectManager'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue'
import Checkbox from '@/components/parts/Checkbox.vue'

const props = defineProps<Partial<IDockviewPanelProps>>()

const { inputVars, outputVars, formulas, functionType } = TruthTableProject.useState()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

const panelRef = ref<HTMLElement | null>(null)
const iframeContainer = ref<HTMLElement | null>(null)
type IframePanelExpose = {
  getIframe: () => HTMLIFrameElement | undefined
}
const iframePanelRef = ref<IframePanelExpose | null>(null)
const downloadButtonStyle = ref<{ right?: string; top?: string }>({})
let positionObserver: ResizeObserver | null = null
const allowEdits = ref(false)
const showLCSidebar = ref(false)
let detachIframeGuards: (() => void) | null = null
let iframeReadyRebindHandler: EventListener | null = null

function installIframeInteractionGuards() {
  detachIframeGuards?.()
  detachIframeGuards = null

  const iframe = iframePanelRef.value?.getIframe?.()
  if (!iframe) return

  const stopEvent = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    if (
      typeof (event as Event & { stopImmediatePropagation?: () => void })
        .stopImmediatePropagation === 'function'
    ) {
      ;(event as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation()
    }
  }

  const bindToDocument = (doc: Document) => {
    const onMouseDown = (event: MouseEvent) => {
      if (allowEdits.value) return
      if (event.button !== 0) stopEvent(event)
    }

    const onMouseMove = (event: MouseEvent) => {
      if (allowEdits.value) return
      // Block move gestures while a mouse button is held to avoid dragging edits.
      if (event.buttons !== 0) stopEvent(event)
    }

    const onWheel = () => {
      if (allowEdits.value) return
      // Keep zoom interactions enabled in locked mode.
      return
    }

    const onContextMenu = (event: MouseEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    const onAuxClick = (event: MouseEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    const onDragStart = (event: DragEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    const onTouchMove = (event: TouchEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (allowEdits.value) return
      stopEvent(event)
    }

    doc.addEventListener('mousedown', onMouseDown, true)
    doc.addEventListener('mousemove', onMouseMove, true)
    doc.addEventListener('wheel', onWheel, { capture: true, passive: false })
    doc.addEventListener('contextmenu', onContextMenu, true)
    doc.addEventListener('auxclick', onAuxClick, true)
    doc.addEventListener('dragstart', onDragStart, true)
    doc.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    doc.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    doc.addEventListener('keydown', onKeyDown, true)

    detachIframeGuards = () => {
      doc.removeEventListener('mousedown', onMouseDown, true)
      doc.removeEventListener('mousemove', onMouseMove, true)
      doc.removeEventListener('wheel', onWheel, true)
      doc.removeEventListener('contextmenu', onContextMenu, true)
      doc.removeEventListener('auxclick', onAuxClick, true)
      doc.removeEventListener('dragstart', onDragStart, true)
      doc.removeEventListener('touchstart', onTouchStart, true)
      doc.removeEventListener('touchmove', onTouchMove, true)
      doc.removeEventListener('keydown', onKeyDown, true)
    }
  }

  if (iframe.contentDocument) {
    bindToDocument(iframe.contentDocument)
    return
  }

  const onLoad = () => {
    iframe.removeEventListener('load', onLoad)
    if (iframe.contentDocument) {
      bindToDocument(iframe.contentDocument)
    }
  }
  iframe.addEventListener('load', onLoad)

  detachIframeGuards = () => {
    iframe.removeEventListener('load', onLoad)
  }
}

function updateMethodPickerPosition() {
  if (!panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  const offset = 12
  downloadButtonStyle.value = {
    right: `${window.innerWidth - rect.right + offset}px`,
    top: `${rect.top + offset}px`,
  }
}

onMounted(() => {
  console.log('LogicCircuitsTestingPanel mounted')

  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  updateMethodPickerPosition()
  positionObserver = new ResizeObserver(() => updateMethodPickerPosition())
  if (panelRef.value) {
    positionObserver.observe(panelRef.value)
  }
  window.addEventListener('scroll', updateMethodPickerPosition, true)
  window.addEventListener('resize', updateMethodPickerPosition)

  installIframeInteractionGuards()
  iframeReadyRebindHandler = () => installIframeInteractionGuards()
  window.addEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')
  disposable?.dispose?.()
  positionObserver?.disconnect()
  window.removeEventListener('scroll', updateMethodPickerPosition, true)
  window.removeEventListener('resize', updateMethodPickerPosition)
  detachIframeGuards?.()
  detachIframeGuards = null
  if (iframeReadyRebindHandler) {
    window.removeEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
    iframeReadyRebindHandler = null
  }
})

// formulas: Record<string, Formula> (reactive plain object) for the currently selected normal form

type LCMethodType = 'AND/OR' | 'NAND' | 'NOR' | undefined
const lcMethodTypes: Array<LCMethodType> = ['AND/OR', 'NAND', 'NOR']
const selectedMethod = ref<LCMethodType>('NOR')
const selectedMethodIndex = computed(() => lcMethodTypes.indexOf(selectedMethod.value))

const outTypeMap: Record<Exclude<LCMethodType, undefined>, 'and-or' | 'nand' | 'nor'> = {
  'AND/OR': 'and-or',
  NAND: 'nand',
  NOR: 'nor',
}

// Sanitize names for filenames: replace non-alphanumeric chars with '_' and collapse underscores
const sanitizeName = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

const createLcContent = (method: Exclude<LCMethodType, undefined>) => {
  return formulaToLC(
    formulas.value,
    inputVars.value,
    outputVars.value,
    'dnf',
    outTypeMap[method],
  ).toString()
}

const logicCircuitDownloadFiles = computed(() => {
  if (!inputVars.value.length || !outputVars.value.length) {
    return []
  }

  // Only export the currently selected method
  const selected = selectedMethod.value
  if (!selected) return []

  const projectName = projectManager.getCurrentProject()?.name ?? 'logic-circuit'
  const baseName = sanitizeName(projectName)

  // Offer only the currently selected method as the downloadable file.
  return [
    {
      label: selected,
      // filename directly reflects the selected method (sanitized)
      filename: `${baseName}_${sanitizeName(String(selected))}`,
      extension: 'lc',
      content: () => createLcContent(selected),
      mimeType: 'text/lc',
      appendDate: false,
    },
  ]
})

function handleMethodSelect(value: unknown, idx: number) {
  if (idx === null || idx < 0) return
  selectedMethod.value = (value as LCMethodType) ?? lcMethodTypes[idx]
}

let lastFileContent = ''

function updateFormulas() {
  let fileContent = ''

  // if manual edits are allowed, updates are disabled to prevent overwriting user changes.
  if (allowEdits.value) {
    return
  }

  switch (selectedMethod.value) {
    case 'AND/OR':
      fileContent = formulaToLC(formulas.value, inputVars.value, outputVars.value).toString()
      break
    case 'NAND':
      fileContent = formulaToLC(
        formulas.value,
        inputVars.value,
        outputVars.value,
        'dnf',
        'nand',
      ).toString()
      break
    case 'NOR':
      fileContent = formulaToLC(
        formulas.value,
        inputVars.value,
        outputVars.value,
        'dnf',
        'nor',
      ).toString()
      break
  }

  // Avoid updating if content hasn't changed to prevent unnecessary reloads
  if (fileContent === lastFileContent) {
    return
  }
  lastFileContent = fileContent

  const success = logicCircuits.loadFile({
    content: fileContent,
  })

  if (!success) {
    console.error('Failed to load file')
  }
}

// Keep the plain object in sync with state and selection
watch([() => formulas.value], updateFormulas, { immediate: true, deep: true })
watch(
  () => allowEdits.value,
  () => {
    // Rebind guards to the current iframe document and keep handlers in sync.
    installIframeInteractionGuards()
  },
)

const methodOptions = ['AND/OR', 'NAND', 'NOR'] as Array<Exclude<LCMethodType, undefined>>
</script>

<template>
  <div ref="panelRef" class="relative flex-1 h-full text-white flex flex-col gap-2 p-2">
    <div ref="iframeContainer" class="relative flex-1">
      <IframePanel
        ref="iframePanelRef"
        iframe-key="__lc_preloaded_iframe"
        src="/logic-easy/logic-circuits/index.html"
        :visible="params.api.isVisible"
        class="flex-1"
      />
    </div>

    <teleport to="body">
      <div
        id="lc-download-button"
        class="fixed z-50 flex items-center gap-2 text-sm"
        :style="downloadButtonStyle"
      >
        <SettingsButton
          :selected-function-type="functionType"
          :input-vars="inputVars"
          :output-vars="outputVars"
          :show-output-selection="false"
          :show-function-type-selection="true"
          :custom-setting-slot-labels="{ 'allow-edits': 'Allow manual edits', method: 'Gate Type' }"
        >
          <template #allow-edits>
            <div class="flex gap-2 items-center text-white" @click.stop>
              <Checkbox v-model="allowEdits" @update:model-value="updateFormulas" />
              <div class="text-xs min-w-25">
                <span v-if="allowEdits"
                  >manual edits enabled, automatic sync disabled.
                  <p class="text-red-200">
                    Your Edits in LogicCircuits will never be synched to LogicEasy!
                  </p></span
                >
                <span v-else>manual edits locked, automatic sync enabled</span>
              </div>
            </div>
          </template>
          <template #method>
            <MultiSelectSwitch
              :values="methodOptions"
              :initial-selected="selectedMethodIndex"
              :onSelect="handleMethodSelect"
            />
          </template>
        </SettingsButton>
        <DownloadButton
          :target-ref="iframeContainer"
          :screenshot="{ enabled: false }"
          :files="logicCircuitDownloadFiles"
          :direct-download="true"
        />
      </div>
    </teleport>
  </div>
</template>
