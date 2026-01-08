<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, reactive, computed } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { useTruthTableState } from '@/states/truthTableState.ts'
import { Formula, FunctionType, defaultFunctionType } from '@/utility/types.ts'
import { logicCircuits } from '@/utility/logicCircuitsWrapper.ts'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'

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

// formulas: Record<string, Formula> (reactive plain object) for the currently selected normal form
const formulas = reactive<Record<string, Formula>>({})

type LCMethodType = 'AND/OR' | 'NAND' | 'NOR' | undefined
const lcMethodTypes: Array<LCMethodType> = ['AND/OR', 'NAND', 'NOR']
const selectedMethod = ref<LCMethodType>('NOR')

function handleMethodSelect(idx: number | null) {
  if (idx === null) return
  const val = lcMethodTypes[idx]
  selectedMethod.value = val
  updateFormulas()
}

function updateFormulas() {


  let fileContent = ''


  if (!state.value) {
    console.error('No truth table state available')
    return
  }

  switch (selectedMethod.value) {
    case 'AND/OR':
      fileContent = formulaToLC(state.value!).toString()
      break
    case 'NAND':
      fileContent = formulaToLC(state.value!, 'dnf', 'nand').toString()
      break
    case 'NOR':
      fileContent = formulaToLC(state.value!, 'dnf','nor').toString()
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
watch([() => state.value?.formulas, outputVars], updateFormulas, { immediate: true })

// UI for floating round selector
const showMethodPicker = ref(false)
const methodOptions = [
  { label: 'AND/OR', value: 'AND/OR' as LCMethodType },
  { label: 'NAND', value: 'NAND' as LCMethodType },
  { label: 'NOR', value: 'NOR' as LCMethodType },
]

function togglePicker() {
  showMethodPicker.value = !showMethodPicker.value
}

function selectMethod(option: LCMethodType) {
  const idx = lcMethodTypes.indexOf(option)
  handleMethodSelect(idx === -1 ? null : idx)
  showMethodPicker.value = false
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div ref="containerRef" class="flex-1 z-0 relative"></div>

    <teleport to="body">
      <div class="fixed z-50 bottom-3 left-3 flex flex-col items-start">
        <transition enter-active-class="transition-opacity duration-150" leave-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
          <div v-if="showMethodPicker" class="mb-2 w-44 rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-sm p-1.5" role="menu">
            <button v-for="option in methodOptions" :key="option.value" type="button" class="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-100 hover:bg-white/10 transition" :class="{ 'bg-white/15 text-white': selectedMethod === option.value }" role="menuitemradio" :aria-checked="selectedMethod === option.value" @click="selectMethod(option.value)">
              {{ option.label }}
            </button>
          </div>
        </transition>

        <button type="button" :aria-expanded="showMethodPicker" aria-label="Select logic circuit method" @click="togglePicker" class="w-7 h-7 rounded-full border border-white/20 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100 text-xs font-semibold shadow-lg hover:shadow-xl hover:border-white/35 transition transform ">
        </button>
      </div>
    </teleport>
  </div>
</template>
