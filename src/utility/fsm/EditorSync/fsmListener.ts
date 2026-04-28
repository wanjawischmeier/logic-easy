/* eslint-disable @typescript-eslint/no-explicit-any */
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { stateManager } from '@/projects/stateManager'
import type { FsmNode, FsmTransition } from '@/projects/state-machine/FsmTypes';
import { expandInputs, fillMissingTransitions } from './transitionUtils'

let isSyncing = false;

export function useFsmListener() {
  const handler = (event: MessageEvent) => {
    if (event.data?.action === 'export' && event.data.fsm && stateManager.state.fsm) {
      const incoming = event.data.fsm;
      const current = stateManager.state.fsm;
      const isMoore = current.fsmModel === 'moore';

      // map incoming nodes into defined fsm interface
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

      isSyncing = true;
      stateManager.state.fsm = {
        ...current,
        nodes: mappedNodes,
        transitions: finalTransitions
      };
      setTimeout(() => { isSyncing = false; }, 50);
    }
  }

  // watcher for table -> editor sync
  watch(
    () => stateManager.state.fsm,
    (newFsm) => {
      if (isSyncing || !newFsm) return;

      const fsmIframe = (window as any).__fsm_preloaded_iframe;
      if (fsmIframe?.contentWindow) {
        // map fsm state to editor data model
        const editorPayload = {
          states: newFsm.nodes.map(n => ({
            id: n.nodeId,
            name: n.name,
            initial: n.isInitial,
            final: n.isFinal,
            x: n.editorCoordX,
            y: n.editorCoordY,
            moore_output: n.mooreOutput || ''
          })),
          transitions: newFsm.transitions.map(t => ({
            id: t.transitionId,
            from: t.fromNodeId,
            to: t.toNodeId,
            input: t.input,
            output: t.mealyOutput || '',
            mealy_output: t.mealyOutput || ''
          })),
          automatonType: newFsm.fsmModel
        };

        fsmIframe.contentWindow.postMessage({
          action: 'automatonimport',
          fsm: editorPayload
        }, window.location.origin);
      }
    },
    { deep: true }
  );

  onMounted(() => window.addEventListener('message', handler))
  onBeforeUnmount(() => window.removeEventListener('message', handler))
}
