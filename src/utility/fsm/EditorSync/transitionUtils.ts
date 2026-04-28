import type { FsmNode, FsmTransition } from "@/projects/state-machine/FsmTypes";

/**
 * expand don't cares to all possible transitions (z.B. "0x1" -> ["001", "011"])
 */
export function expandInputs(inputWithDC: string): string[] {

  if (!inputWithDC || inputWithDC.length === 0) {
    return [];
  }

  const results: string[] = [];
  const len = inputWithDC.length;

  const generate = (current: string, index: number) => {
    if (index === len) {
      results.push(current);
      return;
    }
    const char = inputWithDC.charAt(index).toLowerCase();

    // recursively create possible transitions
   if (char === 'x' || char === '-') {
      generate(current + '0', index + 1);
      generate(current + '1', index + 1);
    } else {
      generate(current + char, index + 1);
    }
  };
  generate('', 0);

  return results;
}


/**
 * Ensures existence of one transition per {nodes} x {inputs} combination.
 * Undefined transitions are saved with don't cares as output and next state only.

 * @param nodes
 * @param existing
 * @param inputBitCount
 * @param outputBitCount
 * @returns
 */
export function fillMissingTransitions(
  nodes: FsmNode[],
  existing: FsmTransition[],
  inputBitCount: number,
  outputBitCount: number
): FsmTransition[] {
  const allPossibleInputs = expandInputs('x'.repeat(inputBitCount));
  const finalTransitions: FsmTransition[] = [];

  nodes.forEach(node => {
    allPossibleInputs.forEach(input => {
      const found = existing.find(t => t.fromNodeId === node.nodeId && t.input === input);

      if (found) {
        finalTransitions.push({ ...found });
      } else {
        finalTransitions.push({
          transitionId: 0,
          fromNodeId: node.nodeId,
          toNodeId: -1,
          input: input,
          mealyOutput: 'x'.repeat(outputBitCount)
        });
      }
    });
  });

  finalTransitions.sort((a, b) => {
    if (a.fromNodeId !== b.fromNodeId) return a.fromNodeId - b.fromNodeId;
    return a.input.localeCompare(b.input);
  });

  return finalTransitions.map((t, index) => ({
    ...t,
    transitionId: index + 1
  }));
}

/**
 * creates new nodes list using default parameters.
 */
export function createNodeWithDefaults(existingNodes: FsmNode[], isMoore: boolean): FsmNode[] {
  const newId = existingNodes.length;

  // create new node
  const newNode: FsmNode = {
    nodeId: newId,  // increment max current id as new node id
    name: `Z${newId}`, // set default state name
    isInitial: newId === 0, // set as initial if node id is zero
    isFinal: true, // set newest (current) node as final
    editorCoordX: 100 + (newId * 50), // fallback for editor
    editorCoordY: 100,
    mooreOutput: isMoore ? 'x' : undefined // set to x per default if fsm model is moore
  };

  // update existing nodes
  const updatedNodes = existingNodes.map(node => ({
    ...node,
    isFinal: false // set other nodes as non-final
  }));

  return [...updatedNodes, newNode];
}

