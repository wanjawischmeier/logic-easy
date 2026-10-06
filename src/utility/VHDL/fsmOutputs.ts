import type { Operation } from 'logi.js'
import type { FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import type { TruthTableState, TruthTableCell } from '@/projects/truth-table/TruthTableProject'
import { calcBitNumber, normalizeBits } from '@/utility/fsm/bitOperations'
import { Minimizer } from '@/utility/truthtable/minimizer'

/** Evaluate existing QMC expression tree on concrete binary inputs. */
function evaluate(expression: Operation, bits: string): boolean {
  const node = expression as unknown as {
    name?: string
    value?: number | boolean
    priority?: number
    args?: Operation[]
  }
  if (node.name === '0' || node.name === '1') return node.name === '1'
  if (node.name !== undefined) {
    const index = node.name.toLowerCase().charCodeAt(0) - 97
    if (node.name.length !== 1 || index < 0 || index >= bits.length) {
      throw new Error('The minimized output contains an unknown input variable.')
    }
    return bits[index] === '1'
  }
  if (node.priority === 0 && node.value !== undefined) return Boolean(node.value)
  if (node.priority === 15 && node.args?.length === 1) return !evaluate(node.args[0]!, bits)
  if (node.priority === 8 && node.args?.length) {
    return node.args.every((arg) => evaluate(arg, bits))
  }
  if (node.priority === 6 && node.args?.length) {
    return node.args.some((arg) => evaluate(arg, bits))
  }
  throw new Error('The minimized output contains an unsupported expression.')
}

export interface ResolvedFsmOutputs {
  valueAt: (nodeId: number, input: string) => string
}

/**
 * complete dont cares with minimization
 */
export async function resolveFsmOutputs(
  fsm: FsmState,
  transitions: FsmTransition[],
  isMoore: boolean,
  cached?: TruthTableState,
): Promise<ResolvedFsmOutputs> {
  const stateBits = calcBitNumber(Math.max(...fsm.nodes.map((node) => node.nodeId)) + 1)
  const inputBits = isMoore ? 0 : Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)
  const variableCount = stateBits + inputBits
  const rowCount = 2 ** variableCount
  const values: TruthTableCell[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: outputBits }, () => '-'),
  )
  const cells = (output: string | undefined): TruthTableCell[] =>
    normalizeBits(output?.toLowerCase(), outputBits, 'x', 'right')
      .split('')
      .map((bit) => (bit === '0' ? 0 : bit === '1' ? 1 : '-'))
  const rowOf = (nodeId: number, input: string) =>
    nodeId * 2 ** inputBits + parseInt(input || '0', 2)

  if (isMoore) {
    for (const node of fsm.nodes) values[node.nodeId] = cells(node.mooreOutput)
  } else {
    for (const transition of transitions) {
      values[rowOf(transition.fromNodeId, transition.input)] = cells(transition.mealyOutput)
    }
  }

  const table: TruthTableState = {
    inputVars: Array.from({ length: variableCount }, (_, index) => String.fromCharCode(97 + index)),
    outputVars: Array.from({ length: outputBits }, (_, index) => `Y${outputBits - 1 - index}`),
    values,
    formulas: {},
    outputVariableIndex: 0,
    variationIndex: {},
    functionType: fsm.functionType ?? cached?.functionType ?? 'Disjunctive',
    functionRepresentation: 'Minimal',
  }
  const resolved = Array.from({ length: rowCount }, () => '')
  for (let bit = 0; bit < outputBits; bit += 1) {
    if (values.every((row) => row[bit] !== '-')) {
      for (let row = 0; row < rowCount; row += 1) resolved[row] += String(values[row]![bit])
      continue
    }
    const hasZero = values.some((row) => row[bit] === 0)
    const hasOne = values.some((row) => row[bit] === 1)
    if (!hasZero || !hasOne) {
      const constant = hasOne ? '1' : '0'
      for (let row = 0; row < rowCount; row += 1) resolved[row] += constant
      continue
    }

    let expression: Operation | undefined
    const cachedColumn = (cached?.outputVars.length ?? 0) - outputBits + bit
    if (
      cached &&
      cached.inputVars.length === variableCount &&
      cached.values.length === rowCount &&
      cachedColumn >= 0 &&
      values.every((row, index) => cached.values[index]?.[cachedColumn] === row[bit])
    ) {
      const name = cached.outputVars[cachedColumn]!
      const selectedIndex = cached.variationIndex as Record<string, number> | number
      const index = typeof selectedIndex === 'number' ? selectedIndex : (selectedIndex?.[name] ?? 0)
      expression = cached.qmcResults?.[name]?.expressions[index]
      try {
        if (
          expression &&
          !values.every((row, index) =>
            row[bit] === '-'
              ? true
              : Number(evaluate(expression!, index.toString(2).padStart(variableCount, '0'))) ===
                row[bit],
          )
        )
          expression = undefined
      } catch {
        expression = undefined
      }
    }
    if (!expression) {
      const result = await Minimizer.runQMC({ ...table, outputVariableIndex: bit })
      expression = result?.expressions[0]
    }
    if (!expression) throw new Error('Could not minimize the FSM output. No VHDL was exported.')

    for (let row = 0; row < rowCount; row += 1) {
      const value = Number(evaluate(expression, row.toString(2).padStart(variableCount, '0')))
      if (values[row]![bit] !== '-' && values[row]![bit] !== value) {
        throw new Error('The minimized output disagrees with a specified output bit.')
      }
      resolved[row] += String(value)
    }
  }
  return { valueAt: (nodeId, input) => resolved[rowOf(nodeId, isMoore ? '' : input)]! }
}
