<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { getDockviewApi } from '@/utility/dockview/integration'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject.ts'
import { logicCircuits } from '@/utility/logicCircuitsWrapper.ts'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import IframePanel from '@/components/IFramePanel.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import { stateManager } from '@/projects/stateManager'
import { projectManager } from '@/projects/projectManager'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue'
import LogicCircuitsWarningPopup from '@/components/popups/LogicCircuitsWarningPopup.vue'
import { popupService } from '@/utility/popupService'
import type { LCFile } from '@/utility/LogicCircuitsExport/LCFile'

defineProps<Partial<IDockviewPanelProps>>()

const { inputVars, outputVars, formulas, functionType } = TruthTableProject.useState()

const title = ref('')
const disposable: { dispose?: () => void } | null = null
let layoutDisposable: any = null

const panelRef = ref<HTMLElement | null>(null)
const iframeContainer = ref<HTMLElement | null>(null)
type IframePanelExpose = {
  getIframe: () => HTMLIFrameElement | undefined
}
const iframePanelRef = ref<IframePanelExpose | null>(null)
const downloadButtonStyle = ref<{ right?: string; top?: string }>({})
let positionObserver: ResizeObserver | null = null
const editWarning = ref(false)
const editWarningMessage =
  'Manual edits in the inbuild LogicCircuits are not synced to LogicEasy. If you want to edit the circuit in LogicCircuits, export the .lc file, and import it to LogicCircuits.'
const editWarningInlineText = 'Manual edits are not synced to LogicEasy!'
let detachIframeGuards: (() => void) | null = null
let iframeReadyRebindHandler: EventListener | null = null
const LOGIC_CIRCUITS_PANEL_STATE_KEY = 'logicCircuits'

type LogicCircuitsPanelState = {
  hideManualEditWarning?: boolean
}

const hideManualEditWarning = computed(() => {
  return (
    stateManager.state.panelStates?.[LOGIC_CIRCUITS_PANEL_STATE_KEY]?.hideManualEditWarning === true
  )
})

function setHideManualEditWarning(value: boolean) {
  if (!stateManager.state.panelStates) {
    stateManager.state.panelStates = {}
  }
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

  const panelState = stateManager.state.panelStates[LOGIC_CIRCUITS_PANEL_STATE_KEY] ?? {}
  stateManager.state.panelStates[LOGIC_CIRCUITS_PANEL_STATE_KEY] = {
    ...panelState,
    hideManualEditWarning: value,
  } as LogicCircuitsPanelState
}

function downloadTextAsFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function exportEditedLCFromPopup() {
  const lcContent = await logicCircuits.exportCurrentLC()
  if (!lcContent) {
    downloadTextAsFile(createLcContent(selectedMethod.value), 'logic-circuit.lc', 'text/lc') //fallback to generated content
    return
  }

  const projectName = projectManager.getCurrentProject()?.name ?? 'logic-circuit'
  const filenameBase = sanitizeName(projectName) || 'logic-circuit'
  const filename = `${filenameBase}_edited.lc`
  downloadTextAsFile(lcContent, filename, 'text/lc')
}

function syncFromLogicEasyAndDiscardManualEdits(dontShowAgain = false) {
  if (dontShowAgain) {
    setHideManualEditWarning(true)
  }

  editWarning.value = false
  void updateFormulas()
}

function openEditWarningPopup() {
  const currentPopup = popupService.current.value
  if (
    currentPopup &&
    'component' in currentPopup &&
    currentPopup.component === LogicCircuitsWarningPopup
  ) {
    return
  }

  popupService.open({
    component: LogicCircuitsWarningPopup,
    props: {
      message: editWarningMessage,
      exportAction: exportEditedLCFromPopup,
      syncAction: syncFromLogicEasyAndDiscardManualEdits,
    },
  })
}

async function foundSignificantChanges(): Promise<boolean> {
  const newLC = await logicCircuits.exportCurrentLC()

  if (!newLC) return true
  if (!currentLCContent) return false

  console.log('new LC content:', newLC)
  console.log('current LC content:', currentLCContent)

  // check element changes
  const newElems = newLC.match(/\[([^\]]*)\]/g)?.[1]

  const lastElements = currentLCContent.elements.toString() // your already-parsed elements

  const newIs = (newElems?.match(/i/g) ?? []).length
  const newNs = (newElems?.match(/n/g) ?? []).length

  const lastIs = (lastElements.match(/i/g) ?? []).length
  const lastNs = (lastElements.match(/n/g) ?? []).length

  const newCoords = newElems
    ?.match(/\{([^}]*)\}/g)
    ?.map((s) =>
      s
        .slice(1, -1)
        .split(',')
        .slice(1, 3)
        .map((v) => v.trim().slice(0, -1))
        .join(''),
    )
    .join('')

  const lastCoords = lastElements
    .match(/\{([^}]*)\}/g)
    ?.map((s) =>
      s
        .slice(1, -1)
        .split(',')
        .slice(1, 3)
        .map((v) => v.trim().slice(0, -1))
        .join(''),
    )
    .join('')

  console.log('Change detection:', {
    newIs,
    newNs,
    lastIs,
    lastNs,
    newCoords,
    lastCoords,
  })

  if (newIs !== lastIs || newNs !== lastNs || newCoords !== lastCoords) return true

  // check node changes
  const newNodes = newLC.match(/\[([^\]]*)\]/g)?.[2]
  const lastNodes = currentLCContent.nodes.toString()

  const newNodeCount = (newNodes?.match(/{/g) ?? []).length
  const oldNodeCount = (lastNodes.match(/{/g) ?? []).length

  const newFreeNodes = (newNodes?.match(/\d+,\d+/g) ?? []).length
  const oldFreeNodes = (lastNodes.match(/\d+,\d+/g) ?? []).length

  console.log('Change detection - nodes:', {
    newNodeCount,
    oldNodeCount,
    newFreeNodes,
    oldFreeNodes,
  })

  if (newNodeCount !== oldNodeCount) return true
  if (newFreeNodes !== oldFreeNodes) return true

  // check connection changes
  const newConns = newLC.match(/\[([^\]]*)\]/g)?.[3]
  const lastConns = currentLCContent.connections.toString()

  const newConnCount = (newConns?.match(/{/g) ?? []).length
  const oldConnCount = (lastConns.match(/{/g) ?? []).length

  console.log('Change detection - connections:', {
    newConnCount,
    oldConnCount,
  })

  if (newConnCount !== oldConnCount) return true

  //check for text changes
  const newTexts = newLC.match(/\[([^\]]*)\]/g)?.[4]
  const lastTexts = currentLCContent.texts.toString()
  const extractLabels = (block: string) =>
    block.match(/\{[^}]+\}/g)?.map((s) => s.slice(1, -1).split(',')[4] ?? '') ?? []

  const newLabels = extractLabels(newTexts ?? '')
  const lastLabels = extractLabels(lastTexts)

  if (newLabels.join(',') !== lastLabels.join(',')) return true

  return false
}

let changeDetectionInFlight = false

async function refreshSignificantChangeWarning() {
  if (changeDetectionInFlight) {
    return
  }

  changeDetectionInFlight = true
  try {
    editWarning.value = await foundSignificantChanges()
  } finally {
    changeDetectionInFlight = false
  }
}

function installIframeInteractionGuards() {
  detachIframeGuards?.()
  detachIframeGuards = null

  const iframe = iframePanelRef.value?.getIframe?.()
  if (!iframe) return

  const bindToDocument = (doc: Document) => {
    const onChangeDetected = () => {
      void refreshSignificantChangeWarning()
    }

    let isDragging = false
    let zoomTimeout: ReturnType<typeof setTimeout> | null = null

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true
      }
    }

    const onMouseUp = () => {
      if (isDragging) {
        updateLCHeader()
        onChangeDetected()
      }
      isDragging = false
    }

    const onWheel = () => {
      if (zoomTimeout) clearTimeout(zoomTimeout)
      zoomTimeout = setTimeout(() => {
        updateLCHeader()
        zoomTimeout = null
      }, 150)
    }

    doc.addEventListener('click', onChangeDetected, true)
    doc.addEventListener('contextmenu', onChangeDetected, true)
    doc.addEventListener('wheel', onWheel, true)
    doc.addEventListener('mousedown', onMouseDown, true)
    doc.addEventListener('mouseup', onMouseUp, true)

    detachIframeGuards = () => {
      doc.removeEventListener('click', onChangeDetected, true)
      doc.removeEventListener('contextmenu', onChangeDetected, true)
      doc.removeEventListener('wheel', onWheel, true)
      doc.removeEventListener('mousedown', onMouseDown, true)
      doc.removeEventListener('mouseup', onMouseUp, true)
      if (zoomTimeout) clearTimeout(zoomTimeout)
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
  const offset = 8
  downloadButtonStyle.value = {
    right: `${window.innerWidth - rect.right + offset}px`,
    top: `${rect.top + offset}px`,
  }
}

let currentLCHeader: string | undefined = undefined

// adjust the view in future lc imports/exports to match the current view.
async function updateLCHeader() {
  console.log('LogicCircuits view updated via zoom or drag')
  const newLC = await logicCircuits.exportCurrentLC()

  if (!newLC) return

  currentLCHeader = newLC.match(/\[([^\]]*)\]/g)?.[0]
}

onMounted(() => {
  updateMethodPickerPosition()
  positionObserver = new ResizeObserver(() => updateMethodPickerPosition())
  if (panelRef.value) {
    positionObserver.observe(panelRef.value)
  }
  layoutDisposable = getDockviewApi()?.onDidLayoutChange(() => updateMethodPickerPosition())

  installIframeInteractionGuards()
  iframeReadyRebindHandler = () => installIframeInteractionGuards()
  window.addEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
})

onBeforeUnmount(() => {
  positionObserver?.disconnect()
  if (layoutDisposable) {
    layoutDisposable.dispose?.()
    layoutDisposable = null
  }
  detachIframeGuards?.()
  detachIframeGuards = null
  if (iframeReadyRebindHandler) {
    window.removeEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
    iframeReadyRebindHandler = null
  }
})

type LCMethodType = 'AND/OR' | 'NAND' | 'NOR'
const lcMethodTypes: LCMethodType[] = ['AND/OR', 'NAND', 'NOR']
const selectedMethod = ref<LCMethodType>('NOR')
const selectedMethodIndex = computed(() => lcMethodTypes.indexOf(selectedMethod.value))

const outTypeMap: Record<LCMethodType, 'and-or' | 'nand' | 'nor'> = {
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

let currentLCContent: LCFile | null = null

const createLcContent = (method: LCMethodType) => {
  currentLCContent = formulaToLC(
    formulas.value,
    inputVars.value,
    outputVars.value,
    'dnf',
    outTypeMap[method],
    currentLCHeader,
  )
  return currentLCContent.toString()
}

const logicCircuitDownloadFiles = computed(() => {
  if (!inputVars.value.length || !outputVars.value.length) {
    return []
  }

  const selected = selectedMethod.value

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
  if (idx == null || idx < 0 || idx >= lcMethodTypes.length) return
  selectedMethod.value = (value as LCMethodType) ?? lcMethodTypes[idx]
  void updateFormulas()
}

let lastFileContent = ''

async function updateFormulas() {
  if (editWarning.value && !hideManualEditWarning.value) {
    openEditWarningPopup()
    return
  }

  const fileContent = createLcContent(selectedMethod.value)

  // Avoid updating if content hasn't changed to prevent unnecessary reloads
  if (fileContent === lastFileContent) {
    return
  }

  const success = await logicCircuits.loadFile({
    content: fileContent,
  })

  if (!success) {
    console.error('Failed to load file')
    return
  }

  editWarning.value = false

  lastFileContent = fileContent
}

// Keep the plain object in sync with state and selection
watch(
  [() => formulas.value],
  () => {
    void updateFormulas()
  },
  { immediate: true, deep: true },
)

const methodOptions = lcMethodTypes
</script>

<template>
  <div ref="panelRef" class="relative flex-1 h-full text-white flex flex-col gap-2">
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
        <div
          v-if="editWarning"
          class="h-7 shrink-0 rounded-full border border-red-500 text-red-500 flex items-center gap-2 px-2.5 text-[11px] leading-none"
          title="Manual edits are not synced to LogicEasy"
        >
          <span
            class="h-5 w-5 rounded-full border-2 border-red-500 flex items-center justify-center font-black text-sm leading-none"
            aria-hidden="true"
          >
            !
          </span>
          <span class="whitespace-nowrap">{{ editWarningInlineText }}</span>
        </div>
        <SettingsButton
          :selected-function-type="functionType"
          :input-vars="inputVars"
          :output-vars="outputVars"
          :show-output-selection="false"
          :show-function-type-selection="true"
          :custom-setting-slot-labels="{ method: 'Gate Type' }"
        >
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
          :panel-id="params.api.id"
          :screenshot="{ enabled: false }"
          :files="logicCircuitDownloadFiles"
          :direct-download="true"
        />
      </div>
    </teleport>
  </div>
</template>
