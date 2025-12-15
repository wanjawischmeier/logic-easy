<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, reactive } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { useTruthTableState } from '@/states/truthTableState.ts'
import { Formula, FunctionType, defaultFunctionType } from '@/utility/types.ts'
import { logicCircuits } from '@/utility/logicCircuitsWrapper.ts'
import {
  formularToLC,
} from '@/utility/LogicCircuitsExport/FormulasToLC.ts'

const props = defineProps<Partial<IDockviewPanelProps>>()

// Access state from params
const { state, inputVars, outputVars } = useTruthTableState()

const title = ref('')
const containerRef = ref<HTMLDivElement | null>(null)
let disposable: { dispose?: () => void } | null = null

// Keep a reference to the current iframe; update it when the wrapper swaps frames.
let preloadedIframe: HTMLIFrameElement | undefined

let iframeReadyHandler: EventListener | null = null

let resizeObserver: ResizeObserver | null = null
let pollInterval: number | null = null

function getGlobalIframe(): HTMLIFrameElement | undefined {
  return (window as Window & { __lc_preloaded_iframe?: HTMLIFrameElement }).__lc_preloaded_iframe
}

function updateIframePosition() {
  // always read current reference
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (!preloadedIframe || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  preloadedIframe.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: none;
    z-index: 1;
    pointer-events: auto;
  `
}

function setupIframe() {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (!preloadedIframe) return false
  // Show and position the iframe
  preloadedIframe.style.display = 'block'
  updateIframePosition()

  // Watch for container size/position changes
  resizeObserver = new ResizeObserver(() => updateIframePosition())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  // Also update on scroll (in case dockview moves)
  window.addEventListener('scroll', updateIframePosition, true)
  window.addEventListener('resize', updateIframePosition)

  return true
}

onMounted(() => {
  console.log('LogicCircuitsTestingPanel mounted')

  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''

  // Try to pick up the current global iframe, otherwise poll.
  preloadedIframe = getGlobalIframe()
  if (!preloadedIframe) {
    console.log('Preloaded iframe not yet available, waiting...')
    // Poll for iframe availability
    pollInterval = window.setInterval(() => {
      preloadedIframe = getGlobalIframe()
      if (preloadedIframe) {
        console.log('Preloaded iframe now available')
        if (pollInterval !== null) {
          clearInterval(pollInterval)
          pollInterval = null
        }
        setupIframe()
      }
    }, 100)
  } else {
    setupIframe()
  }

  // React to wrapper swaps (resetIFrame will dispatch 'lc-iframe-ready')
  const onIframeReady = (ev: Event) => {
    const ce = ev as CustomEvent<{ iframe?: HTMLIFrameElement }>
    // update local ref and re-run setup to ensure the new iframe is shown & positioned
    preloadedIframe = ce?.detail?.iframe ?? getGlobalIframe()
    console.log('LogicCircuitsTestingPanel: detected iframe swap')
    // tear down previous observers/listeners before re-setup
    resizeObserver?.disconnect()
    window.removeEventListener('scroll', updateIframePosition, true)
    window.removeEventListener('resize', updateIframePosition)
    setupIframe()
  }
  iframeReadyHandler = onIframeReady
  window.addEventListener('lc-iframe-ready', onIframeReady as EventListener)
})

onBeforeUnmount(() => {
  console.log('LogicCircuitsTestingPanel unmounted')

  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  // Hide iframe when panel closes
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.display = 'none'
  }

  resizeObserver?.disconnect()
  window.removeEventListener('scroll', updateIframePosition, true)
  window.removeEventListener('resize', updateIframePosition)
  // remove the lc-iframe-ready listener
  if (iframeReadyHandler) {
    window.removeEventListener('lc-iframe-ready', iframeReadyHandler)
    iframeReadyHandler = null
  }

  disposable?.dispose?.()
})

// Watch for panel visibility changes
watch(() => props.params.api.isVisible, (visible) => {
  preloadedIframe = preloadedIframe || getGlobalIframe()
  if (preloadedIframe) {
    preloadedIframe.style.display = visible ? 'block' : 'none'
  }
  if (visible) {
    updateIframePosition()
  }
})

// Selected function type (DNF / CNF)
const selectedType = ref<FunctionType>(defaultFunctionType)

// formulas: Record<string, Formula> (reactive plain object) for the currently selected normal form
const formulas = reactive<Record<string, Formula>>({})

let selectedMethod: 'AND/OR' | 'NAND' | 'NOR' = 'NOR'

function updateFormulas() {
  const formulasMap = state.value?.formulas || {}
  // clear previous keys
  for (const k of Object.keys(formulas)) delete formulas[k]

  for (const out of outputVars.value) {
    if (!out) continue
    formulas[out] = formulasMap?.[out]?.[selectedType.value] ?? Formula.empty
  }

  let fileContent: string = ''

  switch (selectedMethod) {
    case 'AND/OR':
      fileContent = formularToLC(inputVars.value, outputVars.value, formulas).toString()
      break
    case 'NAND':
      fileContent = formularToLC(inputVars.value, outputVars.value, formulas, 'nand').toString()
      break
    case 'NOR':
      fileContent = formularToLC(inputVars.value, outputVars.value, formulas, 'nor').toString()
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
watch([
  () => state.value?.formulas,
  outputVars,
  selectedType
], updateFormulas, { immediate: true })

</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div ref="containerRef" class="flex-1 z-0" style="position: relative"></div>
  </div>
</template>

<style scoped></style>
