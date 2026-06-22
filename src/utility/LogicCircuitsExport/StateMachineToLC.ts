import { LCFile } from './LCFile'
import type { Node } from './Nodes'
import type { Formula } from '@/utility/types'
import { QMC, type Operation } from 'logi.js'
import { flattenCouplingTermsToFormula } from '@/utility/truthtable/expressionParser'
import type { FsmState, StateEncoding, FlipFlopType } from '@/projects/state-machine/FsmTypes'
import { fillMissingTransitions } from '@/utility/fsm/EditorSync/editorTransitionUtils'
import { calcBinaryID, calcBitNumber } from '@/utility/fsm/bitOperations'

type Bit = '0' | '1' | '-'

export interface StateMachineToLCOptions {
  encoding: StateEncoding
  flipFlopType: FlipFlopType
}

// LC element type IDs per FF type
const FF_ELEMENT_TYPE: Record<FlipFlopType, number> = { D: 19, JK: 18, RS: 17 }

// row def for transition table
interface Row {
  pattern: Bit[]
  currentState: Bit[]
  nextState: Bit[]
  output: Bit[]
}

const toBit = (c: string): Bit => (c === '1' ? '1' : c === '0' ? '0' : '-')
const invert = (b: Bit): Bit => (b === '1' ? '0' : b === '0' ? '1' : '-')

const oneHot = (id: number, width: number): Bit[] =>
  Array.from({ length: width }, (_, i) => (i === id ? '1' : '0'))

// canonical DNF from transition table
function canonicalFormula(inputVars: string[], rows: Row[], valueOf: (row: Row) => Bit): Formula {
  const terms: Formula['terms'] = []
  for (const row of rows) {
    if (valueOf(row) !== '1') continue
    terms.push({
      literals: inputVars.map((variable, idx) => ({ variable, negated: row.pattern[idx] === '0' })),
    })
  }
  return { type: 'Disjunctive', terms }
}

// minimize formula via QMC, fallback to canonical
function minimizedFormula(inputVars: string[], rows: Row[], valueOf: (row: Row) => Bit): Formula {
  const n = inputVars.length
  const onSet = new Set<number>()
  const dontCare = new Set<number>()
  const covered = new Set<number>()
  for (const row of rows) {
    const idx = parseInt(row.pattern.join(''), 2) // pattern[0] is the MSB
    covered.add(idx)
    const v = valueOf(row)
    if (v === '1') onSet.add(idx)
    else if (v === '-') dontCare.add(idx)
  }
  if (onSet.size === 0) return { type: 'Disjunctive', terms: [] }

  // uncovered minterms are don't-cares
  if (n <= 16) {
    for (let i = 0; i < 1 << n; i++) if (!covered.has(i)) dontCare.add(i)
  }
  const dc = [...dontCare].filter((i) => !onSet.has(i))

  try {
    const detailed = new QMC().solve([...onSet], dc, true, true, n) as { expressions?: Operation[] }
    const expr = detailed.expressions?.[0]
    if (expr) {
      const node = expr as { priority?: number; name?: unknown; value?: unknown }
      if (node.priority === 0 && node.name == null) {
        return node.value
          ? { type: 'Disjunctive', terms: [{ literals: [{ variable: '1', negated: false }] }] }
          : { type: 'Disjunctive', terms: [] }
      }
      const flat = flattenCouplingTermsToFormula(expr, 'Disjunctive', {
        preserveVariableCase: true,
      })
      // map logi.js a-z vars back to original names
      const terms = flat.terms.map((t) => ({
        literals: t.literals.map((l) => {
          const idx = (l.variable ?? '').toLowerCase().charCodeAt(0) - 97
          return { variable: inputVars[idx] ?? l.variable, negated: l.negated }
        }),
      }))
      // skip if QMC result is faulty (references unknown vars)
      const valid = terms.every(
        (t) =>
          t.literals.length > 0 &&
          t.literals.every(
            (l) => l.variable === '0' || l.variable === '1' || inputVars.includes(l.variable),
          ),
      )
      if (valid) return { type: 'Disjunctive', terms }
    }
  } catch {
    // -> canonical fallback
  }
  return canonicalFormula(inputVars, rows, valueOf)
}

/**
 *
 * @param fsm FSMState
 * @param options  Options
 * @param lcHeader lc header (to keep zoom, etc.)
 * @returns LCFile with fsm implemented in logic circuits
 */
export function stateMachineToLC(
  fsm: FsmState,
  options: StateMachineToLCOptions,
  lcHeader?: string,
): LCFile {
  const lc = new LCFile(lcHeader)

  const nodes = fsm.nodes ?? []
  const nodeCount = nodes.length
  if (nodeCount === 0) return lc

  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)
  const oneHotEncoding = options.encoding === 'One-Hot'
  const binaryStateBits = calcBitNumber(nodeCount)
  const stateBits = oneHotEncoding ? nodeCount : binaryStateBits

  const encodeState = (nodeId: number): Bit[] =>
    oneHotEncoding
      ? oneHot(nodeId, stateBits)
      : (calcBinaryID(nodeId, binaryStateBits).split('') as Bit[])

  const stateVars = Array.from({ length: stateBits }, (_, i) => `Z${stateBits - 1 - i}`)
  const inputVarNames = Array.from({ length: inputBits }, (_, j) => `X${inputBits - 1 - j}`)
  const inputVars = [...stateVars, ...inputVarNames]

  // build transition rows
  const transitions = fillMissingTransitions(nodes, fsm.transitions ?? [], inputBits, outputBits)
  const rows: Row[] = []
  for (const tr of transitions) {
    const currentState = encodeState(tr.fromNodeId)
    const inputBitsArr = tr.input.split('').map(toBit)

    const nextState: Bit[] =
      tr.toNodeId >= 0
        ? encodeState(tr.toNodeId)
        : oneHotEncoding
          ? Array.from({ length: stateBits }, () => '-')
          : (tr.toBinaryId ?? '').padStart(binaryStateBits, '-').split('').map(toBit)

    const output = (tr.mealyOutput ?? '')
      .padEnd(outputBits, '-')
      .slice(0, outputBits)
      .split('')
      .map(toBit)

    rows.push({
      pattern: [...currentState, ...inputBitsArr],
      currentState,
      nextState,
      output,
    })
  }

  // build output logic (Moore uses state only, Mealy uses state + inputs)
  const isMoore = fsm.fsmModel === 'moore'
  const mooreRows: Row[] = nodes.map((node) => {
    const currentState = encodeState(node.nodeId)
    const output = (node.mooreOutput ?? '')
      .padEnd(outputBits, '-')
      .slice(0, outputBits)
      .split('')
      .map(toBit)
    return { pattern: currentState, currentState, nextState: [], output }
  })
  const outputVars = isMoore ? stateVars : inputVars
  const outputRows = isMoore ? mooreRows : rows

  // preload FFs with initial state (e.g. when q1 is selected as first state instead of q0)
  const initialNode = nodes.find((n) => n.isInitial)
  const initialState = initialNode ? encodeState(initialNode.nodeId) : null

  /*
    Layout 
      */
  const ffType = FF_ELEMENT_TYPE[options.flipFlopType]
  const dataInputsPerFF = options.flipFlopType === 'D' ? 1 : 2

  // gate port offsets match LogicCircuits Constants.ts
  const gateHeight = (n: number) => (n > 3 ? 20 * n : n === 3 ? 80 : 40 * n)
  const portY = (gateY: number, port: number, inputs: number) =>
    gateY + (port + 0.5) * (gateHeight(inputs) / inputs)

  // layout constants
  const PORT_DY = 40
  // tallest possible AND gate + margin
  const AND_V = gateHeight(inputVars.length) + 20
  const FORMULA_GAP = 30
  const FF_HEIGHT = 120
  const FF_WIDTH = 165 // Q output sits at +167

  // horizontal connections near the top, one per signal, kinda like a bus
  const CONNECTION_TOP = 60
  const CONNECTION_DY = 40
  const connectionVars = [...inputVarNames, ...stateVars]
  const connectionY = (name: string) =>
    CONNECTION_TOP + (1 + connectionVars.indexOf(name)) * CONNECTION_DY
  const CLOCK_CONNECTION_Y = CONNECTION_TOP
  const BTN_OUT_DY = 17

  const BTN_X = 40
  const LANE_DX = 45
  const CHANNEL = inputVars.length * LANE_DX

  // next state logic
  const G_LANE_X0 = 220
  const G_AND_X = G_LANE_X0 + CHANNEL + 40
  const G_OR_X = G_AND_X + 180
  const FF_X = G_OR_X + 200

  // FF backwiring
  const FB_X0 = FF_X + FF_WIDTH + 30
  const FB_DX = 35
  const riserX = (i: number) => FB_X0 + i * FB_DX

  // output logic
  const F_LANE_X0 = FB_X0 + stateBits * FB_DX + 20
  const F_AND_X = F_LANE_X0 + CHANNEL + 40
  const F_OR_X = F_AND_X + 180
  const LAMP_X = F_OR_X + 180

  const CLOCK_X = FF_X - 90
  const GATE_TOP = CONNECTION_TOP + connectionVars.length * CONNECTION_DY + 25

  type Demand = { conn: Node; tapY: number }
  type Block = { andX: number; orX: number; laneX0: number; demands: Map<string, Demand[]> }
  const gBlock: Block = { andX: G_AND_X, orX: G_OR_X, laneX0: G_LANE_X0, demands: new Map() }
  const fBlock: Block = { andX: F_AND_X, orX: F_OR_X, laneX0: F_LANE_X0, demands: new Map() }
  const laneX = (block: Block, name: string) => block.laneX0 + inputVars.indexOf(name) * LANE_DX
  const addDemand = (block: Block, v: string, conn: Node, tapY: number) => {
    const list = block.demands.get(v)
    const d = { conn, tapY }
    if (list) list.push(d)
    else block.demands.set(v, [d])
  }

  // build AND-OR gate block for a DNF formula
  // keep track of needed lane conns
  const buildFormula = (
    block: Block,
    formula: Formula,
    topY: number,
  ): { out: Node | null; outY: number; height: number; span: number; invert: boolean } => {
    // constant 0/1 from minimizer
    const constLit =
      formula.terms.length === 1 && formula.terms[0]!.literals.length === 1
        ? formula.terms[0]!.literals[0]!.variable
        : null
    if (formula.terms.length === 0 || constLit === '0') {
      return { out: null, outY: topY, height: AND_V, span: PORT_DY, invert: false }
    }
    if (constLit === '1') {
      const high = lc.createHigh(block.andX, topY)
      return {
        out: high.getOutConnectors()[0]!,
        outY: topY + 20,
        height: AND_V,
        span: PORT_DY,
        invert: false,
      }
    }

    // AND gate per term for multi literal or simple conn for single literal, output collection in or
    type TermOut =
      | { kind: 'gate'; node: Node; centerY: number }
      | { kind: 'wire'; variable: string; negated: boolean }
    const termOuts: TermOut[] = formula.terms.map((term, t): TermOut => {
      if (term.literals.length === 1) {
        const lit = term.literals[0]!
        return { kind: 'wire', variable: lit.variable, negated: lit.negated }
      }
      const y = topY + t * AND_V
      const inPorts = term.literals.map((l) => (l.negated ? 'i' : 'n')).join('')
      const gate = lc.createAndGate(block.andX, y, 0, inPorts, 'n')
      const inputs = term.literals.length
      term.literals.forEach((lit, k) =>
        addDemand(block, lit.variable, gate.getInConnectors()[k]!, portY(y, k, inputs)),
      )
      return {
        kind: 'gate',
        node: gate.getOutConnectors()[0]!,
        centerY: y + gateHeight(inputs) / 2,
      }
    })

    const height = formula.terms.length * AND_V
    const gateBottom = (terms: Formula['terms']) =>
      Math.max(
        0,
        ...terms.map((t, i) =>
          t.literals.length > 1 ? i * AND_V + gateHeight(t.literals.length) : 0,
        ),
      )

    if (termOuts.length === 1) {
      const only = termOuts[0]!
      if (only.kind === 'gate') {
        const n = formula.terms[0]!.literals.length
        return { out: only.node, outY: only.centerY, height, span: gateHeight(n), invert: false }
      }

      const y = topY + 20
      const node = lc.createNode(block.andX, y)
      addDemand(block, only.variable, node, y)
      return { out: node, outY: y, height, span: PORT_DY, invert: only.negated }
    }

    // OR as collector
    const centerY = topY + ((formula.terms.length - 1) * AND_V) / 2
    const orH = gateHeight(termOuts.length)
    const orTopY = centerY - orH / 2
    const inPorts = termOuts.map((o) => (o.kind === 'wire' && o.negated ? 'i' : 'n')).join('')
    const orGate = lc.createORGate(block.orX, orTopY, 0, inPorts, 'n')
    termOuts.forEach((o, t) => {
      const port = orGate.getInConnectors()[t]!
      if (o.kind === 'gate') o.node.addTarget(port)
      else addDemand(block, o.variable, port, portY(orTopY, t, termOuts.length))
    })
    const span = Math.max(gateBottom(formula.terms), centerY + orH / 2 - topY)
    return { out: orGate.getOutConnectors()[0]!, outY: centerY, height, span, invert: false }
  }

  // route formula output to output or back to FF input
  const routeTo = (out: Node, sink: Node, sinkX: number, sinkY: number, outY: number) => {
    if (outY === sinkY) {
      out.addTarget(sink)
      return
    }
    const bend = lc.createNode(sinkX - 80, sinkY)
    out.addTarget(bend)
    bend.addTarget(sink)
  }

  // build FFs and output gates
  const excitation = (type: FlipFlopType, i: number): { value: (row: Row) => Bit }[] => {
    const next = (row: Row) => row.nextState[i]!
    const q = (row: Row) => row.currentState[i]!
    switch (type) {
      case 'D':
        return [{ value: next }]
      case 'JK':
        return [
          { value: (r) => (q(r) === '0' ? next(r) : '-') }, // J
          { value: (r) => (q(r) === '1' ? invert(next(r)) : '-') }, // K
        ]
      case 'RS':
        return [
          {
            value: (r) => {
              const n = next(r)
              if (n === '-') return '-'
              return q(r) === '1' ? (n === '1' ? '-' : '0') : n
            },
          }, // S
          {
            value: (r) => {
              const n = next(r)
              if (n === '-') return '-'
              return q(r) === '0' ? (n === '0' ? '-' : '0') : invert(n)
            },
          }, // R
        ]
    }
  }

  // D/J/S at top of FF, K/R at bottom of FF
  const dataPortOffset = (k: number) => (dataInputsPerFF === 1 || k === 0 ? 15 : FF_HEIGHT - 15)

  // collect FF Q outputs and clock inputs
  const stateSource = new Map<string, { conn: Node; y: number }>()
  const clockTaps: { conn: Node; y: number }[] = []
  const Q_OUT_DY = 20

  // next state logic + FF conn
  let gCursor = GATE_TOP
  let prevFfBottom = -Infinity
  stateVars.forEach((name, i) => {
    const built = excitation(options.flipFlopType, i).map((signal) => {
      const b = buildFormula(gBlock, minimizedFormula(inputVars, rows, signal.value), gCursor)
      gCursor += b.span + FORMULA_GAP
      return b
    })
    // align FF with its input gates
    const aligned = built
      .map((b, k) => (b.out ? b.outY - dataPortOffset(k) : null))
      .filter((v): v is number => v !== null)
    const wantedY =
      (aligned.length ? aligned : built.map((b) => b.outY)).reduce((sum, v) => sum + v, 0) /
      (aligned.length || built.length)
    const ffY = Math.max(wantedY, prevFfBottom + 20)
    prevFfBottom = ffY + FF_HEIGHT
    const ff = lc.createFlipFlop(ffType, FF_X, ffY, dataInputsPerFF, 0, initialState?.[i] === '1')
    ff.addText(`${name}^n`, 1)
    built.forEach((b, k) => {
      const py = ffY + dataPortOffset(k)
      if (b.out) {
        routeTo(b.out, ff.getInConnectors()[k]!, FF_X, py, b.outY)
        if (b.invert) ff.setInPortAt(k, 'i') // negate FF input if carried from before
      } else {
        lc.createLow(FF_X - 140, py)
          .getOutConnectors()[0]!
          .addTarget(ff.getInConnectors()[k]!)
      }
    })
    clockTaps.push({ conn: ff.getInConnectors()[dataInputsPerFF]!, y: ffY })
    stateSource.set(name, { conn: ff.getOutConnectors()[0]!, y: ffY + Q_OUT_DY })
  })

  // output logic + output lamps
  const OUTPUT_GAP = 30
  let fCursor = GATE_TOP
  for (let j = 0; j < outputBits; j++) {
    const b = buildFormula(
      fBlock,
      minimizedFormula(outputVars, outputRows, (row) => row.output[j]!),
      fCursor,
    )
    const lamp = lc.createLamp(LAMP_X, b.outY, 0)
    lamp.addText(`Y${outputBits - 1 - j}`, 1)
    if (b.out) {
      b.out.addTarget(lamp.getInConnectors()[0]!)
      if (b.invert) lamp.setInPorts('i') // if not negated but needed, do here
    } else {
      lc.createLow(LAMP_X - 140, b.outY)
        .getOutConnectors()[0]!
        .addTarget(lamp.getInConnectors()[0]!)
    }
    fCursor += b.span + OUTPUT_GAP
  }

  const connectionEntry = new Map<string, { node: Node; x: number }>()

  // input buttons
  inputVarNames.forEach((name) => {
    const y = connectionY(name)
    const btn = lc.createButton(BTN_X, y - BTN_OUT_DY, 0)
    btn.addText(name, 3)
    const x = BTN_X + 42
    const node = lc.createNode(x, y)
    btn.getOutConnectors()[0]!.addTarget(node)
    connectionEntry.set(name, { node, x })
  })

  // FF backwiring
  stateVars.forEach((name, i) => {
    const src = stateSource.get(name)!
    const ry = connectionY(name)
    const rx = riserX(i)
    const n1 = lc.createNode(rx, src.y)
    const n2 = lc.createNode(rx, ry)
    src.conn.addTarget(n1)
    n1.addTarget(n2)
    connectionEntry.set(name, { node: n2, x: rx })
  })

  // wiring from input (left "bus")
  for (const name of inputVars) {
    const entry = connectionEntry.get(name)
    if (!entry) continue
    const ry = connectionY(name)
    const heads = [gBlock, fBlock]
      .filter((b) => (b.demands.get(name) ?? []).length > 0)
      .map((b) => ({ b, x: laneX(b, name) }))
    const left = heads.filter((h) => h.x < entry.x).sort((a, b) => b.x - a.x)
    const right = heads.filter((h) => h.x >= entry.x).sort((a, b) => a.x - b.x)
    for (const side of [left, right]) {
      let tail = entry.node
      for (const h of side) {
        const head = lc.createNode(h.x, ry)
        tail.addTarget(head)
        tail = head
        // node before gate input
        const dem = (h.b.demands.get(name) ?? []).slice().sort((a, b) => a.tapY - b.tapY)
        let dtail: Node = head
        for (const d of dem) {
          const tap = lc.createNode(h.x, d.tapY)
          dtail.addTarget(tap)
          dtail = tap
          tap.addTarget(d.conn)
        }
      }
    }
  }

  // add clock
  if (clockTaps.length > 0) {
    const clockButton = lc.createButton(BTN_X, CLOCK_CONNECTION_Y - BTN_OUT_DY, 0)
    clockButton.addText('Clock', 3)
    const connectionNode = lc.createNode(CLOCK_X, CLOCK_CONNECTION_Y)
    clockButton.getOutConnectors()[0]!.addTarget(connectionNode)
    let tail: Node = connectionNode
    for (const tap of clockTaps.slice().sort((a, b) => a.y - b.y)) {
      const node = lc.createNode(CLOCK_X, tap.y + FF_HEIGHT / 2)
      tail.addTarget(node)
      tail = node
      node.addTarget(tap.conn)
    }
  }

  return lc
}
