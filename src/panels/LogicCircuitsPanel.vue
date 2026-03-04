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

const props = defineProps<Partial<IDockviewPanelProps>>()

const { inputVars, outputVars, formulas } = TruthTableProject.useState()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

const panelRef = ref<HTMLElement | null>(null)
const iframeContainer = ref<HTMLElement | null>(null)
const downloadButtonStyle = ref<{ right?: string; top?: string }>({})
let positionObserver: ResizeObserver | null = null

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
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')
  disposable?.dispose?.()
  positionObserver?.disconnect()
  window.removeEventListener('scroll', updateMethodPickerPosition, true)
  window.removeEventListener('resize', updateMethodPickerPosition)
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
  updateFormulas()
}

function updateFormulas() {
  let fileContent = ''

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

  const success = logicCircuits.loadFile({
    content: fileContent,
  })

  if (!success) {
    console.error('Failed to load file')
  }
}

// Keep the plain object in sync with state and selection
watch([() => formulas.value], updateFormulas, { immediate: true, deep: true })

const methodOptions = ['AND/OR', 'NAND', 'NOR'] as Array<Exclude<LCMethodType, undefined>>
</script>

<template>
  <div ref="panelRef" class="relative flex-1 h-full text-white flex flex-col gap-2 p-2">
    <div ref="iframeContainer" class="relative flex-1">
      <IframePanel
        iframe-key="__lc_preloaded_iframe"
        src="/logic-easy/logic-circuits/index.html"
        :visible="params.api.isVisible"
        class="flex-1"
      />
    </div>

    <teleport to="body">
      <div id="lc-download-button" class="fixed z-50 flex items-center gap-2 text-sm" :style="downloadButtonStyle">
        <SettingsButton
          :input-vars="inputVars"
          :output-vars="outputVars"
          :show-output-selection="false"
          :show-function-type-selection="false"
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
          :screenshot="{ enabled: false }"
          :files="logicCircuitDownloadFiles"
          :direct-download="true"
        />
      </div>
    </teleport>
  </div>
</template>
