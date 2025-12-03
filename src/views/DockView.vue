<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import DockViewHeader from '../components/DockViewHeader.vue'
import type { DockviewReadyEvent, DockviewApi } from 'dockview-vue'
import { minifyTruthTable } from '@/utility/espresso'
import { interpretMinifiedTable, type Formula } from '@/utility/truthTableInterpreter'
import type { TruthTableData } from '@/utility/types'
import { dockComponents } from '@/components/dockRegistry'
import { stateManager } from '@/utility/stateManager'

type DockviewApiMinimal = {
  addPanel: (opts: {
    id: string;
    component: string;
    title?: string;
    params?: Record<string, unknown>;
    position?: unknown;
  }) => void;
};

const componentsForDockview = dockComponents;
const dockviewApi = ref<DockviewApi | null>(null)
let layoutChangeDisposable: { dispose?: () => void } | null = null

const LAYOUT_STORAGE_KEY = 'dockview_layout'

const updateTruthTable = async (newValues: TruthTableData) => {
  stateManager.state.truthTable.values = newValues

  // Calculate formulas for each output variable
  const formulas: Record<string, Record<string, Formula>> = {}

  for (let outputIdx = 0; outputIdx < stateManager.state.truthTable.outputVars.length; outputIdx++) {
    const outputVar = stateManager.state.truthTable.outputVars[outputIdx]
    if (!outputVar) continue

    // Extract single output column
    const singleOutputValues = newValues.map(row => [row[outputIdx]]) as TruthTableData

    // 1. DNF: Minify ON-set
    const minifiedDNF = await minifyTruthTable(
      stateManager.state.truthTable.inputVars,
      [outputVar],
      singleOutputValues
    )

    // 2. CNF: Minify OFF-set (invert output)
    const invertedValues = singleOutputValues.map(row => {
      const val = row[0]
      if (val === 1) return [0]
      if (val === 0) return [1]
      return [val]
    }) as TruthTableData

    const minifiedCNF = await minifyTruthTable(
      stateManager.state.truthTable.inputVars,
      [outputVar],
      invertedValues
    )

    const castMinifiedDNF = minifiedDNF as unknown as TruthTableData
    const castMinifiedCNF = minifiedCNF as unknown as TruthTableData

    formulas[outputVar] = {
      DNF: interpretMinifiedTable(castMinifiedDNF, 'DNF', stateManager.state.truthTable.inputVars),
      CNF: interpretMinifiedTable(castMinifiedCNF, 'CNF', stateManager.state.truthTable.inputVars)
    }
  }

  stateManager.state.truthTable.formulas = formulas
}

const loadDefaultLayout = (api: DockviewApi) => {
  api.addPanel({
    id: 'panel_1',
    component: 'truth-table',
    title: 'Truth Table',
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable
    },
  })

  api.addPanel({
    id: 'panel_kv',
    component: 'kv-diagram',
    title: 'KV Diagram',
    position: { referencePanel: 'panel_1', direction: 'right' },
    params: {
      state: stateManager.state.truthTable,
      updateTruthTable
    },
  })
}

const onReady = (event: DockviewReadyEvent) => {
  console.log('dockview ready', event)
  dockviewApi.value = event.api

    // Expose dockview API and shared panel params so HeaderMenuBar can add panels
    ; (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api = event.api as unknown as DockviewApiMinimal;


  // Initial calculation
  updateTruthTable(stateManager.state.truthTable.values)

    // expose shared params for dynamic panels
    ; (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams = {
      state: stateManager.state.truthTable,
      updateTruthTable,
    };

  // Try to load saved layout
  let success = false
  const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)

  if (savedLayout) {
    try {
      const layout = JSON.parse(savedLayout)
      event.api.fromJSON(layout)
      success = true
      console.log('Loaded layout from localStorage')
    } catch (err) {
      console.error('Failed to load layout from localStorage:', err)
    }
  }

  // Load default layout if loading failed
  if (!success) {
    loadDefaultLayout(event.api)
  }

  // Setup auto-save on layout changes
  layoutChangeDisposable = event.api.onDidLayoutChange(() => {
    try {
      const layout = event.api.toJSON()
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
      console.log('Layout saved to localStorage')
    } catch (err) {
      console.error('Failed to save layout to localStorage:', err)
    }
  })
}

onBeforeUnmount(() => {
  layoutChangeDisposable?.dispose?.()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-1">
    <div class="h-[35px]">
      <DockViewHeader />
    </div>

    <div class="h-px bg-surface-2"></div>

    <div class="flex-1 min-h-0">
      <dockview-vue class="dockview-theme-abyss w-full h-[calc(100vh-36px)]" :components="componentsForDockview"
        @ready="onReady" />
    </div>
  </div>
</template>
