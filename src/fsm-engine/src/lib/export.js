import { getDefaultStore } from "jotai";
import { node_list, transition_list } from "./stores";

const store = getDefaultStore();

export function extractFsmData() {
  const nodes = store.get(node_list) ?? [];
  const transitions = store.get(transition_list) ?? [];

  return {
    states: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      initial: !!n.type?.initial,
      final: !!n.type?.final,
    })),
    transitions: transitions.map((t) => ({
      id: t.id,
      from: t.from,      
      label: t.name,
    })),
  };
}

export function sendExportToParent() {
  const fsm = extractFsmData();
  window.parent.postMessage({ action: "export", fsm }, "*");
}

export function importFsmFromParent(fsm) {
  if (!fsm) return;

  const states = Array.isArray(fsm.states) ? fsm.states : [];
  const transitions = Array.isArray(fsm.transitions) ? fsm.transitions : [];

  const nodeAtoms = states.map((s, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);

    const baseX = 200;
    const baseY = 150;
    const dx = 220;
    const dy = 160;

    return {
      id: s.id,
      name: s.name ?? "",
      x: baseX + col * dx,
      y: baseY + row * dy,
      radius: 40,
      fill: "#1f2937", 
      type: {
        initial: !!s.initial,
        final: !!s.final,
      },
    };
  });

  const transitionAtoms = transitions.map((t, idx) => {
    return {
      id: t.id,
      from: t.from,
      to: t.to,
      name: t.label ?? "",
      stroke: "#ffffff",
      strokeWidth: 2,
      fill: "#ffffff",
      points: [0, 0, 100, 0],
      tension: 0,
      fontSize: 16,
      fontStyle: "normal",
      name_fill: "#000000",
      name_align: "center",
    };
  });

  store.set(node_list, nodeAtoms);
  store.set(transition_list, transitionAtoms);
}

export function clearFsmFromParent() {
  store.set(node_list, []);
  store.set(transition_list, []);
}
