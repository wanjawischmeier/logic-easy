import EspressoTestingPanel from '@/panels/EspressoTestingPanel.vue';
import TruthTablePanel from '@/panels/TruthTablePanel.vue';
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue';
import LogicCircuitsTestingPanel from '@/panels/LogicCircuitsTestingPanel.vue';
import { stateManager } from '@/utility/stateManager';

export type PanelRequirement = 'TruthTable' | 'TransitionTable' | 'Min2OutputVars';

type DockEntry = {
  id: string;
  label: string;
  component: unknown;
  requires?: PanelRequirement[];
};

export const dockRegistry: DockEntry[] = [
  { id: 'truth-table', label: 'Truth Table', component: TruthTablePanel, requires: ['TruthTable'] },
  { id: 'kv-diagram', label: 'KV Diagram', component: KVDiagramPanel, requires: ['TruthTable', 'Min2OutputVars'] },
  { id: 'espresso-testing', label: 'Espresso Testing Panel', component: EspressoTestingPanel },
  { id: 'lc-testing', label: 'Logic Circuits Panel', component: LogicCircuitsTestingPanel },
];

// mapping for :components prop consumed by dockview
export const dockComponents: Record<string, unknown> = Object.fromEntries(
  dockRegistry.map((e) => [e.id, e.component])
) as Record<string, unknown>;

export const checkPanelRequirement = (panel: DockEntry): boolean => {
  if (!panel.requires) return true;

  let checkPassed = true;

  panel.requires.forEach((requirement) => {
    console.log(requirement)
    switch (requirement) {
      case 'TruthTable':
        if (stateManager.state.truthTable === undefined) {
          checkPassed = false;
        }
        break;

      case 'Min2OutputVars':
        if ((stateManager.state.truthTable?.outputVars?.length ?? 0) < 2) {
          checkPassed = false;
        }
        break;

      default:
        break;
    }
  });
  return checkPassed;
}
