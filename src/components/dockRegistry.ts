import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue'
import TruthTablePanel from '@/panels/TruthTablePanel.vue'
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue'
import MealyAutomatPanel from '@/panels/MealyAutomatPanel.vue'

type DockEntry = {
  id: string
  label: string
  component: unknown
}

export const dockRegistry: DockEntry[] = [
  { id: 'truth-table', label: 'Truth Table', component: TruthTablePanel },
  { id: 'kv-diagram', label: 'KV Diagram', component: KVDiagramPanel },
  { id: 'espresso-testing', label: 'Espresso Testing Panel', component: EspressoTestingPanel },
  { id: 'mealy-automat', label: 'Mealy-Automat', component: MealyAutomatPanel },
]

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  dockRegistry.map((e) => [e.id, e.component]),
) as Record<string, unknown>
