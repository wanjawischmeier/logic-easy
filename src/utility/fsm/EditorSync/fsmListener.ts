import { onMounted, onBeforeUnmount } from 'vue'
import { stateManager } from '@/projects/stateManager'
import type { FsmNode, FsmTransition } from '@/projects/state-machine/FsmTypes';
import { expandInputs, fillMissingTransitions } from './transitionUtils'

export function useFsmListener() {
  const handler = (event: MessageEvent) => {
    if (event.data?.action === 'export' && event.data.fsm && stateManager.state.fsm) {
      const incoming = event.data.fsm;
      const current = stateManager.state.fsm;
      const isMoore = current.fsmModel === 'moore';

      // map incoming nodes into defined fsm interface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedNodes: FsmNode[] = (incoming.states || []).map((s: any, index: number, array: any[]) => {
      const maxId = array.length > 0 ? Math.max(...array.map(n => n.id)) : -1;
      const isHighestId = s.id === maxId;

      return {
          nodeId: s.id,
          name: s.name || `Z${s.id}`,
          isInitial: s.id === 0,
          isFinal: isHighestId,
          editorCoordX: s.x,
          editorCoordY: s.y,
          mooreOutput: isMoore
            ? (s.moore_output || 'x'.repeat(current.outputBitCount ?? 1)).replace(/-/g, 'x')
            : undefined
        };
      });

      // expand transitions with don't cares
      const rawExpanded: FsmTransition[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (incoming.transitions || []).forEach((t: any) => {
        const pattern = (t.input || '').replace(/-/g, 'x').padStart(current.inputBitCount ?? 1, 'x');
        const outputs = expandInputs(pattern);
        const outStr = (t.mealy_output || t.output || 'x'.repeat(current.outputBitCount ?? 1)).replace(/-/g, 'x');

        outputs.forEach(concreteInput => {
          rawExpanded.push({
            transitionId: 0,
            fromNodeId: t.from,
            toNodeId: t.to,
            input: concreteInput,
            mealyOutput: !isMoore ? outStr : undefined
          });
        });
      });

      const finalTransitions = fillMissingTransitions(
        mappedNodes,
        rawExpanded,
        current.inputBitCount ?? 1,
        current.outputBitCount ?? 1
      );

      stateManager.state.fsm = {
        ...current,
        nodes: mappedNodes,
        transitions: finalTransitions
      };
    }
  }

  onMounted(() => window.addEventListener('message', handler))
  onBeforeUnmount(() => window.removeEventListener('message', handler))
}
