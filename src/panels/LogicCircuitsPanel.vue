<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { logicCircuits } from '@/utility/logicCircuitsWrapper'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC'
import IframePanel from '@/components/IFramePanel.vue'
import DownloadButton from '@/components/parts/buttons/DownloadButton.vue'
import { stateManager } from '@/projects/stateManager'
import { projectManager } from '@/projects/projectManager'
import SettingsButton from '@/components/parts/buttons/SettingsButton.vue'
import MultiSelectSwitch from '@/components/parts/MultiSelectSwitch.vue'
import VariationSelector from '@/components/parts/VariationSelector.vue'
import LogicCircuitsWarningPopup from '@/components/popups/LogicCircuitsWarningPopup.vue'
import { popupService } from '@/utility/popupService'
import type { LCFile } from '@/utility/LogicCircuitsExport/LCFile'
import { hasSignificantChanges } from '@/utility/LogicCircuitsExport/lcChangeDetection'
import { Formula as FormulaDefaults, type Formula, type Term } from '@/utility/types'
import { useFloatingToolbarPosition } from '@/components/composables/useFloatingToolbarPosition'
import { downloadFile } from '@/utility/downloadFile'

defineProps<Partial<IDockviewPanelProps>>()

const {
  inputVars,
  outputVars,
  displayInputVars,
  displayOutputVars,
  formulas,
  values,
  functionType,
  functionRepresentation,
  variations,
  variationIndex,
} = TruthTableProject.useState()

const panelRef = ref<HTMLElement | null>(null)
const iframeContainer = ref<HTMLElement | null>(null)
type IframePanelExpose = {
  getIframe: () => HTMLIFrameElement | undefined
}
const iframePanelRef = ref<IframePanelExpose | null>(null)

// Pins the teleported toolbar to the panel's top-right corner.
const { style: toolbarStyle } = useFloatingToolbarPosition(panelRef)

/*

Changable settings

 */
type LCMethodType = 'AND/OR' | 'NAND' | 'NOR'
const lcMethodTypes: LCMethodType[] = ['AND/OR', 'NAND', 'NOR']
const selectedMethod = ref<LCMethodType>('NOR')
const selectedMethodIndex = computed(() => lcMethodTypes.indexOf(selectedMethod.value))

const outTypeMap: Record<LCMethodType, 'and-or' | 'nand' | 'nor'> = {
  'AND/OR': 'and-or',
  NAND: 'nand',
  NOR: 'nor',
}

function handleMethodSelect(value: unknown, idx: number) {
  if (idx == null || idx < 0 || idx >= lcMethodTypes.length) return
  selectedMethod.value = (value as LCMethodType) ?? lcMethodTypes[idx]
  void updateFormulas()
}

/*

Formula selection setting related stuff

*/
const variationRows = computed(() =>
  outputVars.value
    .map((outputVar, idx) => ({
      outputVar,
      displayLabel: displayOutputVars.value[idx] ?? outputVar,
      formulas: variations.value?.[outputVar]?.map((variation) => variation.latex) ?? [],
    }))
    .filter((row) => row.formulas.length > 0),
)

const settingsSlotLabels = computed<Record<string, string>>(() => {
  const labels: Record<string, string> = { method: 'Gate Type' }
  if (functionRepresentation.value === 'Minimal' && variationRows.value.length > 0) {
    labels.variations = 'Variations'
  }
  return labels
})

function getSelectedFormulaIndex(outputVar: string): number {
  const indexMap = variationIndex.value as Record<string, number> | number
  if (typeof indexMap === 'number') return indexMap
  return indexMap[outputVar] ?? 0
}

function setSelectedFormulaIndex(outputVar: string, value: number) {
  if (!stateManager.state.truthTable) return

  const current = stateManager.state.truthTable.variationIndex
  stateManager.state.truthTable.variationIndex = {
    ...(typeof current === 'number' ? {} : current),
    [outputVar]: value,
  }

  void updateFormulas()
}

/*

formula preperation for lc

*/

function generateCanonicalFormulas(): Record<string, Formula> {
  const canonicalFormulas: Record<string, Formula> = {}

  outputVars.value.forEach((outVar, outIdx) => {
    const terms: Term[] = []
    const isDNF = functionType.value === 'Disjunctive'
    const targetValue = isDNF ? 1 : 0

    values.value.forEach((row, rowIdx) => {
      if (row[outIdx] === targetValue) {
        const literals = inputVars.value.map((inVar, inIdx) => {
          // Find input bits using binary representation of row index
          const bitValue = (rowIdx >> (inputVars.value.length - 1 - inIdx)) & 1
          const negated = isDNF ? bitValue === 0 : bitValue === 1

          return { variable: inVar, negated }
        })
        terms.push({ literals })
      }
    })

    canonicalFormulas[outVar] = {
      type: functionType.value,
      terms,
    }
  })

  return canonicalFormulas
}

function generateSelectedVariationFormulas(): Record<string, Formula> {
  const selectedFormulas: Record<string, Formula> = {}

  outputVars.value.forEach((outputVar) => {
    const outputVariations = variations.value?.[outputVar]
    const selectedVariation = outputVariations?.[getSelectedFormulaIndex(outputVar)]
    selectedFormulas[outputVar] =
      selectedVariation?.formula ?? formulas.value[outputVar] ?? FormulaDefaults.empty
  })

  return selectedFormulas
}

/*
 lc generate related stuff
 */
let currentLCContent: LCFile | null = null
let currentLCHeader: string | undefined = undefined
let lastFileContent = ''

// adjust the view in future lc imports/exports to match the current view.
async function updateLCHeader() {
  const newLC = await logicCircuits.exportCurrentLC()

  if (!newLC) return

  currentLCHeader = newLC.match(/\[([^\]]*)\]/g)?.[0]
}

// Sanitize names for filenames: replace non-alphanumeric chars with '_' and collapse underscores
const sanitizeName = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

const createLcContent = (method: LCMethodType) => {
  const targetFormulas =
    functionRepresentation.value === 'Normal'
      ? generateCanonicalFormulas()
      : generateSelectedVariationFormulas()

  currentLCContent = formulaToLC(
    targetFormulas,
    inputVars.value,
    outputVars.value,
    outTypeMap[method],
    currentLCHeader,
    displayInputVars.value,
    displayOutputVars.value,
  )
  return currentLCContent.toString()
}

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
      label: selected + '-Circuit',
      // filename directly reflects the selected method (sanitized)
      filename: `${baseName}_${sanitizeName(String(selected))}-Circuit`,
      extension: 'lc',
      content: () => createLcContent(selected),
      mimeType: 'text/lc',
      appendDate: false,
    },
  ]
})

// Keep the iframe in sync with state and selection.
watch(
  [() => formulas.value, () => variations.value, () => variationIndex.value],
  () => {
    void updateFormulas()
  },
  { immediate: true, deep: true },
)

/*
Manual edit warning related stuff
*/
const editWarning = ref(false)
const editWarningMessage =
  'Manual edits in the inbuild LogicCircuits are not synced to LogicEasy. If you want to edit the circuit in LogicCircuits, export the .lc file, and import it to LogicCircuits.'
const editWarningInlineText = 'Manual edits are not synced to LogicEasy!'
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

  const panelState = stateManager.state.panelStates[LOGIC_CIRCUITS_PANEL_STATE_KEY] ?? {}
  stateManager.state.panelStates[LOGIC_CIRCUITS_PANEL_STATE_KEY] = {
    ...panelState,
    hideManualEditWarning: value,
  } as LogicCircuitsPanelState
}

async function exportEditedLCFromPopup() {
  const lcContent = await logicCircuits.exportCurrentLC()
  if (!lcContent) {
    downloadFile(createLcContent(selectedMethod.value), 'logic-circuit.lc', 'text/lc') //fallback to generated content
    return
  }

  const projectName = projectManager.getCurrentProject()?.name ?? 'logic-circuit'
  const filenameBase = sanitizeName(projectName) || 'logic-circuit'
  const filename = `${filenameBase}_edited.lc`
  downloadFile(lcContent, filename, 'text/lc')
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

/*

Iframe related stuff

*/
let detachIframeGuards: (() => void) | null = null
let iframeReadyRebindHandler: EventListener | null = null
let changeDetectionInFlight = false

async function refreshSignificantChangeWarning() {
  if (changeDetectionInFlight) {
    return
  }

  changeDetectionInFlight = true
  try {
    const newLC = await logicCircuits.exportCurrentLC()
    if (!newLC) editWarning.value = true
    else if (!currentLCContent) editWarning.value = false
    else editWarning.value = hasSignificantChanges(newLC, currentLCContent)
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

onMounted(() => {
  installIframeInteractionGuards()
  iframeReadyRebindHandler = () => installIframeInteractionGuards()
  window.addEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
})

onBeforeUnmount(() => {
  detachIframeGuards?.()
  detachIframeGuards = null
  if (iframeReadyRebindHandler) {
    window.removeEventListener('__lc_preloaded_iframe-ready', iframeReadyRebindHandler)
    iframeReadyRebindHandler = null
  }
})
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
        class="fixed z-10 flex items-center gap-2 text-sm"
        :style="toolbarStyle"
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
        <div v-for="row in variationRows" :key="row.outputVar" class="shrink-0">
          <VariationSelector
            v-if="row.formulas.length > 1"
            placement="bottom"
            :formulas="row.formulas"
            :selectedIndex="getSelectedFormulaIndex(row.outputVar)"
            :variableName="row.displayLabel"
            @update:selected-index="(value) => setSelectedFormulaIndex(row.outputVar, value)"
          />
        </div>
        <SettingsButton
          :selected-function-type="functionType"
          :input-vars="inputVars"
          :output-vars="displayOutputVars"
          :show-output-selection="false"
          :show-function-type-selection="true"
          :custom-setting-slot-labels="settingsSlotLabels"
          :selected-function-representation="functionRepresentation"
        >
          <template #method>
            <MultiSelectSwitch
              :values="lcMethodTypes"
              :initial-selected="selectedMethodIndex"
              :onSelect="handleMethodSelect"
            />
          </template>
        </SettingsButton>
        <DownloadButton
          :panel-id="params.api.id"
          :target-ref="iframeContainer"
          :screenshot="{ enabled: false }"
          :files="logicCircuitDownloadFiles"
          :direct-download="false"
        />
      </div>
    </teleport>
  </div>
</template>
