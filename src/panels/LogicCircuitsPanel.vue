<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject.ts'
import { logicCircuits } from '@/utility/logicCircuitsWrapper.ts'
import { formulaToLC } from '@/utility/LogicCircuitsExport/FormulasToLC.ts'
import IframePanel from '@/components/IFramePanel.vue'

const props = defineProps<Partial<IDockviewPanelProps>>()

const { outputVars, inputVars, formulas } = TruthTableProject.useState()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

const panelRef = ref<HTMLElement | null>(null)
const methodUpdaterStyle = ref<{ left?: string; bottom?: string }>({})
let positionObserver: ResizeObserver | null = null

function updateMethodPickerPosition() {
  if (!panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  const offset = 12
  methodUpdaterStyle.value = {
    left: `${rect.left + offset}px`,
    bottom: `${window.innerHeight - rect.bottom + offset}px`,
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
  panelRef.value && positionObserver.observe(panelRef.value)
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

function handleMethodSelect(idx: number | null) {
  if (idx === null) return
  const val = lcMethodTypes[idx]
  selectedMethod.value = val
  updateFormulas()
}

function updateFormulas() {

  let fileContent = ''

  switch (selectedMethod.value) {
    case 'AND/OR':
      fileContent = formulaToLC(formulas.value, inputVars.value, outputVars.value).toString()
      break
    case 'NAND':
      fileContent = formulaToLC(formulas.value, inputVars.value, outputVars.value, 'dnf', 'nand').toString()
      break
    case 'NOR':
      fileContent = formulaToLC(formulas.value, inputVars.value, outputVars.value, 'dnf','nor').toString()
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
  <div ref="panelRef" class="relative flex-1 h-full text-white flex flex-col gap-2 p-2">
    <IframePanel iframe-key="__lc_preloaded_iframe" src="/logic-easy/logic-circuits/index.html"
                 :visible="params.api.isVisible" class="flex-1" />

    <teleport to="body">
      <div id="lc-method-updater" class="fixed z-50 flex flex-col items-start" :style="methodUpdaterStyle">
        <div class="flex flex-col items-start gap-2">
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
      </div>
    </teleport>
  </div>
</template>
