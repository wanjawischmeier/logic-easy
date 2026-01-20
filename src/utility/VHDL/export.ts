import type { TruthTableState } from '@/projects/truth-table/TruthTableProject.ts'

/**
 * Export truth table to VHDL using case when statements
 * @param truthTable
 * @param project_name
 *
 * Format:
 * library IEEE;
 * use IEEE.STD_LOGIC_1164.ALL;
 *
 * entity NAME is
 * Port ( InX : in STD_LOGIC;
 * ...
 * InZ : in STD_LOGIC;
 * OutA : out STD_LOGIC;
 * ...
 * OutC : out STD_LOGIC);
 * end NAME;
 *
 * architecture Behavioral of NAME is
 * signal inputs : STD_LOGIC_VECTOR(N-1 downto 0);
 * signal outputs : STD_LOGIC_VECTOR(M-1 downto 0);
 * begin
 * inputs <= InX & ... & InZ;
 * OutA <= outputs(M-1);
 * ...
 * OutC <= outputs(0);
 * process(inputs)
 * begin
 *  case inputs is
 *     when "00...0" => outputs <= "00...0";
 *     ...
 *     when "11...1" => outputs <= "11...1";
 *     when others => outputs <= "00...0";
 *     end case;
 * end process;
 * end Behavioral;
 *
 */
export function exportTruthTableTOVHDLcaseWhen(
  truthTable: TruthTableState | undefined,
  project_name: string,
) {
  if (!truthTable) {
    console.error('No truth table data to export.')
    return
  }
  const vhdlLines: string[] = []

  const numInputs = truthTable.inputVars.length
  const numOutputs = truthTable.outputVars.length

  const entityName = project_name.replace(/\s+/g, '_')

  //vhdl header
  vhdlLines.push('library IEEE;')
  vhdlLines.push('use IEEE.STD_LOGIC_1164.ALL;\n')

  //add entity definition
  vhdlLines.push(getVHDLEntity(truthTable.inputVars, truthTable.outputVars, entityName) + '\n')

  //entity behavioral architecture using case when
  vhdlLines.push('architecture Behavioral of ' + entityName + ' is')

  vhdlLines.push('signal inputs : STD_LOGIC_VECTOR(' + (numInputs - 1).toString() + ' downto 0);')
  vhdlLines.push('signal outputs : STD_LOGIC_VECTOR(' + (numOutputs - 1).toString() + ' downto 0);')

  vhdlLines.push('begin')

  vhdlLines.push(
    'inputs <= ' +
      truthTable.inputVars.map((inputVar) => 'in' + inputVar.toUpperCase()).join(' & ') +
      ';',
  )

  vhdlLines.push(
    truthTable.outputVars
      .map(
        (outputVar, outputIdx) =>
          'Out' +
          outputVar.toUpperCase() +
          ' <= outputs(' +
          (numOutputs - 1 - outputIdx).toString() +
          ');',
      )
      .join('\n'),
  )

  vhdlLines.push('process(inputs)')

  vhdlLines.push('begin')

  vhdlLines.push('  case inputs is')

  //when, basically the truth table
  truthTable.values.forEach((cell, i) => {
    vhdlLines.push(
      '    when "' +
        truthTable.inputVars
          .map((_, colIdx) => getInputValue(i, colIdx, numInputs).toString())
          .join('') +
        '" => outputs <="' +
        cell.map((outputVal) => outputVal.toString()).join('') +
        '";',
    )
  })

  vhdlLines.push('    when others => outputs <= "' + '0'.repeat(numOutputs) + '";')

  vhdlLines.push('  end case;')

  vhdlLines.push('end process;')

  vhdlLines.push('end Behavioral;')

  downloadAsFile(vhdlLines.join('\n'), project_name + '.vhdl')
}

/**
 * Export truth table to VHDL using direct assignments from DNF formulas
 * @param truthTable
 * @param project_name
 * @param type (cnf or dnf)
 *
 * Format:
 * library IEEE;
 * use IEEE.STD_LOGIC_1164.ALL;
 *
 * entity NAME is
 * Port ( InX : in STD_LOGIC;
 * ...
 * InZ : in STD_LOGIC;
 * OutA : out STD_LOGIC;
 * ...
 * OutC : out STD_LOGIC);
 * end NAME;
 *
 * architecture Behavioral of NAME is
 * begin
 * OutA <= dnf or cnf expression;
 * ...
 * OutC <= dnf or cnf expression;
 * end Behavioral;
 */
export function exportTruthTableTOVHDLboolExpr(
  truthTable: TruthTableState | undefined,
  project_name: string,
  type: 'dnf' | 'cnf' = 'dnf',
) {
  if (!truthTable) {
    console.error('No truth table data to export.')
    return
  }
  const vhdlLines: string[] = []

  const entityName = project_name.replace(/\s+/g, '_')

  //vhdl header
  vhdlLines.push('library IEEE;')
  vhdlLines.push('use IEEE.STD_LOGIC_1164.ALL;\n')

  //add entity definition
  vhdlLines.push(getVHDLEntity(truthTable.inputVars, truthTable.outputVars, entityName) + '\n')

  //entity behavioral architecture using direct assignments
  vhdlLines.push('architecture Behavioral of ' + entityName + ' is')

  vhdlLines.push('begin')

  if (!truthTable.formulas) {
    console.error('No formulas to export.')
    return
  }

  truthTable.outputVars.forEach((outputVar) => {
    let formularLine = `  Out${outputVar.toUpperCase()} <= `
    const formula = truthTable.selectedFormula
    if (!formula || !Array.isArray(formula.terms)) { // TODO: why wouldn't it be an array?
      console.warn(`No DNF terms for output ${outputVar}.`)
      return // continue to next outputVar
    }

    const termsExpr = formula.terms
      .map((term) => {
        const literalExpr = term.literals
          .map((literal) =>
            literal.variable != '0'
              ? literal.negated
                ? `not(In${literal.variable.toUpperCase()})`
                : `In${literal.variable.toUpperCase()}`
              : '0',
          )
          .join(' and ')
        return term.literals.length > 1 ? `(${literalExpr})` : literalExpr
      })
      .join(' or ')
    formularLine += termsExpr
    vhdlLines.push(formularLine + ';')
  })

  vhdlLines.push('end Behavioral;')

  downloadAsFile(vhdlLines.join('\n'), project_name + '.vhdl')
}
/**
 * Generate VHDL entity definition
 * @param inputVars
 * @param outputVars
 * @param name
 *
 *
 * Format:
 * entity NAME is
 * Port ( InX : in STD_LOGIC;
 * ...
 * InZ : in STD_LOGIC;
 * OutA : out STD_LOGIC;
 * ...
 * OutC : out STD_LOGIC);
 * end NAME;
 */
function getVHDLEntity(inputVars: string[], outputVars: string[], name: string): string {
  const entityLines: string[] = []

  entityLines.push('entity ' + name + ' is')
  entityLines.push('Port (')

  const portLines: string[] = []

  inputVars.forEach((inputVar) => {
    portLines.push('  In' + inputVar.toUpperCase() + ' : in STD_LOGIC;')
  })

  outputVars.forEach((outputVar, idx) => {
    const lineEnding = idx === outputVars.length - 1 ? '' : ';'
    portLines.push('  Out' + outputVar.toUpperCase() + ' : out STD_LOGIC' + lineEnding)
  })

  entityLines.push(portLines.join('\n'))

  entityLines.push(');')
  entityLines.push('end ' + name + ';')

  return entityLines.join('\n')
}

function getInputValue(rowIdx: number, colIdx: number, inputVarCount: number) {
  // MSB is at index 0
  const shiftAmount = inputVarCount - 1 - colIdx
  return (rowIdx >> shiftAmount) & 1
}

/**
 * Download content as a file
 * @param content
 * @param filename
 */
const downloadAsFile = (content: string, filename: string) => {
  const blob = new Blob([content], {
    type: 'text/vhdl',
  })

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
