import { describe, expect, it } from 'vitest'
import { stateMachineToLC } from '@/utility/LogicCircuitsExport/StateMachineToLC'
import { validateFsm } from '@/utility/fsm/EditorSync/fsmValidation'
import { createState } from './support/fixtures'
import { FSM_SPECS, M2, M2_SNAPSHOT } from './support/specs'
import { snapshot } from './support/assertions'

// LC element type ids, see Elements.ts
const AND_GATE = 0
const OR_GATE = 1
const D_FLIPFLOP = 19
const JK_FLIPFLOP = 18

describe('logic circuits export follows the minimized KV functions', () => {
  const expectedFlipFlops: Record<string, number> = { M1: 2, M2: 2, M3: 2, M4: 3, M5: 2 }

  it('builds one D flip-flop per state bit for every FSM', () => {
    FSM_SPECS.forEach(({ name, spec }) => {
      const lc = stateMachineToLC(createState(spec), { encoding: 'Binary', flipFlopType: 'D' })
      const flipFlops = lc.elements.filter((element) => element.elementType === D_FLIPFLOP)
      expect(flipFlops).toHaveLength(expectedFlipFlops[name.slice(0, 2)] ?? -1)
    })
  })

  it('implements the minimized next-state term of M2 with three-literal ANDs', () => {
    const lc = stateMachineToLC(createState(M2), { encoding: 'Binary', flipFlopType: 'D' })
    const andGates = lc.elements.filter((element) => element.elementType === AND_GATE)
    // Z_1^(n+1) = !Z_1 !Z_0 X -> one AND with two inverted inputs, built once for the
    // flip flop data input and once for the Z_1^(n+1) lamp
    const threeInput = andGates.filter((element) => element.inPorts.length === 3)
    expect(threeInput).toHaveLength(2)
    threeInput.forEach((element) => expect([...element.inPorts].sort().join('')).toBe('iin'))
    // Z_0^(n+1) = !X and Y_1 = Y_0 = X need no multi-literal OR: extra terms would change the logic
    const multiInputOr = lc.elements.filter(
      (element) => element.elementType === OR_GATE && element.inPorts.length > 1,
    )
    expect(multiInputOr).toHaveLength(0)
    expect(andGates.every((element) => element.inPorts.length <= 3)).toBe(true)
  })

  it('follows the standard JK excitation table without changing the FSM', () => {
    const state = createState(M2)
    const lc = stateMachineToLC(state, { encoding: 'Binary', flipFlopType: 'JK' })
    expect(lc.elements.filter((element) => element.elementType === JK_FLIPFLOP)).toHaveLength(2)
    // the FSM itself stays untouched by building a circuit from it
    expect(snapshot(state)).toEqual(M2_SNAPSHOT)
    expect(validateFsm(state).valid).toBe(true)

    const twoLiteralAnds = lc.elements
      .filter((element) => element.elementType === AND_GATE && element.inPorts.length === 2)
      .map((element) => [...element.inPorts].sort().join(''))
      .sort()

    // Z_1^(n+1) = !Z_1 !Z_0 X and Z_0^(n+1) = !X, so
    //   J_1 = !Z_0 X (one literal inverted), K_1 = 1 (constant)
    //   J_0 = !X, K_0 = X, because the excitation is a don't care while the bit holds
    // Only J_1 needs a gate, and a wrong excitation table would change this set
    expect(twoLiteralAnds).toEqual(['in'])
  })
})
