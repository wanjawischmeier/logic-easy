import { createPanel } from '@/utility/dockview/integration'
import { Project, type BaseProjectProps } from '../Project'
import TruthTablePropsComponent from './TruthTablePropsComponent.vue'
import {
  defaultFunctionRepresentation,
  defaultFunctionType,
  type Formula,
  type FunctionRepresentation,
  type FunctionType,
  type FormulaVariation,
} from '@/utility/types'
import { computed } from 'vue'
import { stateManager, type AppState } from '@/projects/stateManager'
import { registerProjectType } from '@/projects/projectRegistry'
import { Minimizer, type QMCResult } from '@/utility/truthtable/minimizer'
import type { TermColor } from '@/utility/truthtable/colorGenerator'
import { getCouplingTermLatex } from '@/utility/truthtable/latexGenerator'

export type TruthTableCell = 0 | 1 | '-'
export type TruthTableData = TruthTableCell[][]

// Default values for TruthTableProps
export interface TruthTableProps extends BaseProjectProps {
  inputVariableCount: number
  outputVariableCount: number
  inputVarLabels?: string[]
  outputVarLabels?: string[]
}

export interface TruthTableState {
  inputVars: string[]
  outputVars: string[]
  inputVarLabels?: string[]
  outputVarLabels?: string[]
  values: TruthTableData
  formulas: Record<string, Formula>
  outputVariableIndex: number
  functionType: FunctionType
  functionRepresentation: FunctionRepresentation
  qmcResult?: QMCResult
  couplingTermLatex?: string
  selectedFormula?: Formula
  formulaTermColors?: TermColor[]
  variations?: Record<string, FormulaVariation[]>
  variationIndex: Record<string, number>
  fsmMode?: boolean
}

export class TruthTableProject extends Project {
  static override get defaultProps(): TruthTableProps {
    return {
      name: 'Combinatorial Circuit ',
      inputVariableCount: 4,
      outputVariableCount: 2,
      defaultLayout: 'TruthTable',
    }
  }

  static override useState() {
    const state = computed(() => stateManager.state.truthTable)

    const inputVars = computed(() => state.value?.inputVars ?? [])
    const outputVars = computed(() => state.value?.outputVars ?? [])
    const inputVarLabels = computed(() => state.value?.inputVarLabels)
    const outputVarLabels = computed(() => state.value?.outputVarLabels)
    const displayInputVars = computed(() =>
      inputVarLabels.value
        ? inputVars.value.map((v, i) => inputVarLabels.value![i] ?? v)
        : inputVars.value,
    )
    const displayOutputVars = computed(() =>
      outputVarLabels.value
        ? outputVars.value.map((v, i) => outputVarLabels.value![i] ?? v)
        : outputVars.value,
    )
    const values = computed(() => stateManager.state.truthTable?.values ?? [])
    const formulas = computed(() => state.value?.formulas ?? {})
    const outputVariableIndex = computed(() => state.value?.outputVariableIndex ?? 0)
    const functionType = computed(() => state.value?.functionType ?? defaultFunctionType)
    const functionRepresentation = computed(
      () => state.value?.functionRepresentation ?? defaultFunctionRepresentation,
    )
    const qmcResult = computed(() => state.value?.qmcResult)
    const couplingTermLatex = computed(() => state.value?.couplingTermLatex)
    const selectedFormula = computed(() => state.value?.selectedFormula)
    const formulaTermColors = computed(() => state.value?.formulaTermColors)
    const variations = computed(() => state.value?.variations)
    const variationIndex = computed(() => state.value?.variationIndex ?? {})

    const outputVar = computed(() => state.value?.outputVars[state.value.outputVariableIndex])

    return {
      state,
      inputVars,
      outputVars,
      inputVarLabels,
      outputVarLabels,
      displayInputVars,
      displayOutputVars,
      outputVar,
      values,
      formulas,
      outputVariableIndex,
      functionType,
      functionRepresentation,
      qmcResult,
      couplingTermLatex,
      selectedFormula,
      formulaTermColors,
      variations,
      variationIndex,
    }
  }

  static override restoreDefaultPanelLayout(props: TruthTableProps) {
    createPanel('truth-table', 'Truth Table')

    switch (props.defaultLayout) {
      case 'SplitKV':
        if (props.inputVariableCount >= 2) {
          createPanel('kv-diagram', 'Karnaugh-Veitch', {
            referencePanel: 'truth-table',
            direction: 'right',
          })
        }
        break

      case 'SplitQMC':
        // Add KV diagram if input count is between 2 and 4
        if (props.inputVariableCount >= 2 && props.inputVariableCount <= 4) {
          createPanel('qmc-visualization', 'Quine-McCluskey', {
            referencePanel: 'truth-table',
            direction: 'right',
          })
        }
        break

      default:
        break
    }
  }

  private static generateVariableNames(count: number, startCharCode: number): string[] {
    return Array.from({ length: count }, (_, i) => String.fromCharCode(startCharCode + i))
  }

  static override createState(props: TruthTableProps) {
    console.log('[TruthTableProject.createState] Initializing project state')

    // Generate variable names
    const inputVars = this.generateVariableNames(props.inputVariableCount, 97)
    const outputVars = this.generateVariableNames(props.outputVariableCount, 107)

    // create formulas
    const formulas: Record<string, Formula> = {}

    // number of rows = 2^n
    const rows = 1 << props.inputVariableCount

    // initialize all output values to zero
    const values = Array.from({ length: rows }, () =>
      Array.from({ length: props.outputVariableCount }, () => 0 as TruthTableCell),
    ) as TruthTableData

    const functionType: FunctionType = defaultFunctionType
    const functionRepresentation: FunctionRepresentation = defaultFunctionRepresentation
    const couplingTermLatex = getCouplingTermLatex(
      Minimizer.emptyQMQResult,
      functionType,
      functionRepresentation,
      inputVars,
      props.outputVarLabels?.[0] ?? outputVars[0]!,
    )

    // Initialize state
    stateManager.state.truthTable = {
      inputVars: inputVars,
      outputVars: outputVars,
      inputVarLabels: props.inputVarLabels,
      outputVarLabels: props.outputVarLabels,
      values: values,
      formulas: formulas,
      outputVariableIndex: 0,
      variationIndex: Object.fromEntries(outputVars.map((outputVar) => [outputVar, 0])),
      functionType: functionType,
      functionRepresentation: functionRepresentation,
      couplingTermLatex: couplingTermLatex,
      fsmMode: false,
    }

    console.log('[TruthTableProject.createState] State initialized:', {
      inputVars: inputVars,
      outputVars: outputVars,
      hasValues: !!values,
    })
  }

  static override validateState(state: AppState): boolean {
    return state.truthTable != undefined
  }
}

registerProjectType('combinatorial-circuit', {
  name: 'Combinatorial Circuit',
  propsComponent: TruthTablePropsComponent,
  projectClass: TruthTableProject,
})
