import type { FsmState, FsmTransition } from '@/projects/state-machine/FsmTypes'
import { downloadFile } from '@/utility/downloadFile'

/**
 * Export an FSM (Mealy) to VHDL
 *
 * Format:
 * library IEEE;
 * use IEEE.STD_LOGIC_1164.ALL;
 *
 * entity NAME is
 * Port ( x     : in  STD_LOGIC;   -- or STD_LOGIC_VECTOR(n-1 downto 0)
 *        reset : in  STD_LOGIC;
 *        clock : in  STD_LOGIC;
 *        y     : out STD_LOGIC ); -- or STD_LOGIC_VECTOR(m-1 downto 0)
 * end NAME;
 *
 * architecture Behavioral of NAME is
 * type state_typ is (S0, S1, ...);
 * signal state      : state_typ := S0;
 * signal next_state : state_typ := S0;
 * begin
 *   -- process_State_Logic, process_State_Register, process_State_Output
 * end Behavioral;
 */
export function exportFsmToVHDL(fsm: FsmState | undefined, project_name: string) {
  if (fsm?.fsmModel === 'moore') exportFsmToVHDLmoore(fsm, project_name)
  else exportFsmToVHDLmealy(fsm, project_name)
}

export function exportFsmToVHDLmealy(fsm: FsmState | undefined, project_name: string) {
  if (!fsm) {
    console.error('No FSM data to export.')
    return
  }

  const nodes = fsm.nodes ?? []
  if (nodes.length === 0) {
    console.error('FSM has no states to export.')
    return
  }

  const transitions = fsm.transitions ?? []
  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)
  const entityName = project_name.replace(/\s+/g, '_')

  // stable nodeId -> VHDL enum literal map
  const literalOf = new Map<number, string>()
  const usedLiterals = new Set<string>()
  nodes.forEach((node) => {
    let literal = sanitizeIdentifier(node.name) || `S${node.nodeId}`
    while (usedLiterals.has(literal)) literal = `${literal}_${node.nodeId}`
    usedLiterals.add(literal)
    literalOf.set(node.nodeId, literal)
  })

  const initialNode = nodes.find((n) => n.isInitial) ?? nodes[0]!
  const initialLiteral = literalOf.get(initialNode.nodeId)!

  const lines: string[] = []

  // header
  lines.push('library IEEE;')
  lines.push('use IEEE.STD_LOGIC_1164.ALL;\n')

  // entity
  lines.push(`entity ${entityName} is`)
  lines.push('Port (')
  lines.push(`  x     : in  ${vhdlType(inputBits)};`)
  lines.push('  reset : in  STD_LOGIC;')
  lines.push('  clock : in  STD_LOGIC;')
  lines.push(`  y     : out ${vhdlType(outputBits)}`)
  lines.push(');')
  lines.push(`end ${entityName};\n`)

  // architecture head
  lines.push(`architecture Behavioral of ${entityName} is`)
  lines.push(`type state_typ is (${nodes.map((n) => literalOf.get(n.nodeId)).join(', ')});`)
  lines.push(`signal state      : state_typ := ${initialLiteral};`)
  lines.push(`signal next_state : state_typ := ${initialLiteral};`)
  lines.push('begin\n')

  // process_State_Logic: next-state logic (combinational, state + x)
  lines.push('process_State_Logic : process (state, x)')
  lines.push('begin')
  lines.push('  next_state <= state;')
  lines.push('  case state is')
  nodes.forEach((node) => {
    lines.push(`    when ${literalOf.get(node.nodeId)} =>`)
    const outgoing = transitions.filter((t) => t.fromNodeId === node.nodeId)
    lines.push(
      ...transitionBranches(outgoing, inputBits, (t) => {
        const target = literalOf.get(t.toNodeId)
        return target ? `next_state <= ${target};` : null
      }),
    )
  })
  lines.push('  end case;')
  lines.push('end process process_State_Logic;\n')

  // process_State_Register: clocked state register with async reset
  lines.push('process_State_Register : process (clock, reset)')
  lines.push('begin')
  lines.push(`  if reset = '1' then`)
  lines.push(`    state <= ${initialLiteral};`)
  lines.push('  elsif rising_edge(clock) then')
  lines.push('    state <= next_state;')
  lines.push('  end if;')
  lines.push('end process process_State_Register;\n')

  // process_State_Output: Mealy output logic (combinational, state + x)
  lines.push('process_State_Output : process (state, x)')
  lines.push('begin')
  lines.push(`  y <= ${zeroLiteral(outputBits)};`)
  lines.push('  case state is')
  nodes.forEach((node) => {
    lines.push(`    when ${literalOf.get(node.nodeId)} =>`)
    const outgoing = transitions.filter((t) => t.fromNodeId === node.nodeId)
    lines.push(
      ...transitionBranches(outgoing, inputBits, (t) => {
        const out = bitLiteral(t.mealyOutput, outputBits)
        return out ? `y <= ${out};` : null
      }),
    )
  })
  lines.push('  end case;')
  lines.push('end process process_State_Output;\n')

  lines.push('end Behavioral;')

  downloadFile(lines.join('\n'), entityName + '.vhdl', 'text/vhdl')
}

function exportFsmToVHDLmoore(fsm: FsmState, project_name: string) {
  const nodes = fsm.nodes ?? []
  if (nodes.length === 0) {
    console.error('FSM has no states to export.')
    return
  }

  const transitions = fsm.transitions ?? []
  const inputBits = Math.max(1, fsm.inputBitCount ?? 1)
  const outputBits = Math.max(1, fsm.outputBitCount ?? 1)
  const entityName = project_name.replace(/\s+/g, '_')

  const literalOf = new Map<number, string>()
  const usedLiterals = new Set<string>()
  nodes.forEach((node) => {
    let literal = sanitizeIdentifier(node.name) || `S${node.nodeId}`
    while (usedLiterals.has(literal)) literal = `${literal}_${node.nodeId}`
    usedLiterals.add(literal)
    literalOf.set(node.nodeId, literal)
  })

  const initialNode = nodes.find((n) => n.isInitial) ?? nodes[0]!
  const initialLiteral = literalOf.get(initialNode.nodeId)!

  const lines: string[] = []

  lines.push('library IEEE;')
  lines.push('use IEEE.STD_LOGIC_1164.ALL;\n')

  lines.push(`entity ${entityName} is`)
  lines.push('Port (')
  lines.push(`  x     : in  ${vhdlType(inputBits)};`)
  lines.push('  reset : in  STD_LOGIC;')
  lines.push('  clock : in  STD_LOGIC;')
  lines.push(`  y     : out ${vhdlType(outputBits)}`)
  lines.push(');')
  lines.push(`end ${entityName};\n`)

  lines.push(`architecture Behavioral of ${entityName} is`)
  lines.push(`type state_typ is (${nodes.map((n) => literalOf.get(n.nodeId)).join(', ')});`)
  lines.push(`signal state      : state_typ := ${initialLiteral};`)
  lines.push(`signal next_state : state_typ := ${initialLiteral};`)
  lines.push('begin\n')

  // process_State_Logic
  lines.push('process_State_Logic : process (state, x)')
  lines.push('begin')
  lines.push('  next_state <= state;')
  lines.push('  case state is')
  nodes.forEach((node) => {
    lines.push(`    when ${literalOf.get(node.nodeId)} =>`)
    const outgoing = transitions.filter((t) => t.fromNodeId === node.nodeId)
    lines.push(
      ...transitionBranches(outgoing, inputBits, (t) => {
        const target = literalOf.get(t.toNodeId)
        return target ? `next_state <= ${target};` : null
      }),
    )
  })
  lines.push('  end case;')
  lines.push('end process process_State_Logic;\n')

  // process_State_Register
  lines.push('process_State_Register : process (clock, reset)')
  lines.push('begin')
  lines.push(`  if reset = '1' then`)
  lines.push(`    state <= ${initialLiteral};`)
  lines.push('  elsif rising_edge(clock) then')
  lines.push('    state <= next_state;')
  lines.push('  end if;')
  lines.push('end process process_State_Register;\n')

  // process_State_Output: Moore — depends only on state, not x
  lines.push('process_State_Output : process (state)')
  lines.push('begin')
  lines.push('  case state is')
  nodes.forEach((node) => {
    const out = bitLiteral(node.mooreOutput, outputBits) ?? zeroLiteral(outputBits)
    lines.push(`    when ${literalOf.get(node.nodeId)} => y <= ${out};`)
  })
  lines.push('  end case;')
  lines.push('end process process_State_Output;\n')

  lines.push('end Behavioral;')

  downloadFile(lines.join('\n'), entityName + '.vhdl', 'text/vhdl')
}

/** STD_LOGIC for a single bit, STD_LOGIC_VECTOR otherwise. */
function vhdlType(bits: number): string {
  return bits === 1 ? 'STD_LOGIC' : `STD_LOGIC_VECTOR(${bits - 1} downto 0)`
}

/** Zero default value: '0' for a single bit, "00.." for a vector. */
function zeroLiteral(bits: number): string {
  return bits === 1 ? `'0'` : `"${'0'.repeat(bits)}"`
}

/**
 * VHDL literal for a concrete bit string, or null when the value is missing
 */
function bitLiteral(value: string | undefined, bits: number): string | null {
  if (!value) return null
  const v = value.padStart(bits, 'x').slice(-bits)
  if (!/^[01]+$/.test(v)) return null
  return bits === 1 ? `'${v}'` : `"${v}"`
}

/**
 * Build the per-state body
 */
function transitionBranches(
  transitions: FsmTransition[],
  inputBits: number,
  assignFor: (t: FsmTransition) => string | null,
): string[] {
  const lines: string[] = []
  let started = false
  let fallback: string | null = null

  for (const t of transitions) {
    const assignment = assignFor(t)
    if (!assignment) continue

    const pattern = bitLiteral(t.input, inputBits)
    if (!pattern) {
      // don't-care input: applies regardless of x
      fallback = assignment
      continue
    }

    lines.push(`      ${started ? 'elsif' : 'if'} x = ${pattern} then`)
    lines.push(`        ${assignment}`)
    started = true
  }

  if (fallback) {
    lines.push(started ? '      else' : '      -- unconditional')
    lines.push(`        ${fallback}`)
  }

  if (started) lines.push('      end if;')
  if (!started && !fallback) lines.push('      null;')

  return lines
}

/** Make a node name a legal VHDL identifier (letters/digits/_, not starting with a digit). */
function sanitizeIdentifier(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (!cleaned) return ''
  return /^[0-9]/.test(cleaned) ? `S_${cleaned}` : cleaned
}
