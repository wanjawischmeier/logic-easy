import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { Minimizer } from '@/utility/truthtable/minimizer'
import { stateManager, STORAGE_VERSION } from '@/projects/stateManager'
import { TruthTableProject } from '@/projects/truth-table/TruthTableProject'
import { truthTableWorkerManager } from '@/utility/truthtable/truthTableWorkerManager'
import KVDiagramPanel from '@/panels/KVDiagramPanel.vue'
import QMCPanel from '@/panels/QMCPanel.vue'

if (typeof window !== 'undefined' && !(window as any).Worker) {
  (window as any).Worker = class {
    onmessage = () => {}
    postMessage = () => {}
    terminate = () => {}
    addEventListener = () => {}
    removeEventListener = () => {}
  }
}

function resetStateManager() {
  Object.keys(stateManager.state).forEach((key) => {
    if (key !== 'version') {
      delete (stateManager.state as Record<string, unknown>)[key]
    }
  })
  stateManager.state.version = STORAGE_VERSION
}

describe('Truth table, KV, and QMC sync', () => {
  beforeEach(() => {
    resetStateManager()
    TruthTableProject.createState({
      name: 'Truth Table',
      inputVariableCount: 2,
      outputVariableCount: 1,
    })
  })

  const FormulaRendererStub = defineComponent({
    props: {
      latexExpression: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      return () => h('span', { 'data-testid': 'formula-renderer' }, props.latexExpression)
    },
  })

  const KVDiagramStub = defineComponent({
    props: {
      values: {
        type: Array,
        default: () => [],
      },
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'kv-diagram' }, String((props.values as unknown[]).length))
    },
  })

  const QMCGroupingTableStub = defineComponent({
    props: {
      values: {
        type: Array,
        default: () => [],
      },
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'grouping-table' }, String((props.values as unknown[]).length))
    },
  })

  const QMCPrimeImplicantChartStub = defineComponent({
    props: {
      couplingTermLatex: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'prime-chart' }, props.couplingTermLatex)
    },
  })

  const SettingsButtonStub = defineComponent({
    template: '<div data-testid="settings-button"><slot name="show-formula" /><slot name="show-highlights" /><slot /></div>',
  })

  const DownloadButtonStub = defineComponent({
    template: '<div data-testid="download-button"></div>',
  })

  const CheckboxStub = defineComponent({
    template: '<input data-testid="checkbox" type="checkbox" />',
  })

  const MultiSelectSwitchStub = defineComponent({
    template: '<div data-testid="multi-select-switch"></div>',
  })

  const LegendButtonStub = defineComponent({
    template: '<div data-testid="legend-button"></div>',
  })

  const panelMountOptions = {
    props: {
      params: {
        api: {
          id: 'panel-1',
          isActive: true,
        },
      },
    },
    global: {
      stubs: {
        KVDiagram: KVDiagramStub,
        FormulaRenderer: FormulaRendererStub,
        QMCGroupingTable: QMCGroupingTableStub,
        QMCPrimeImplicantChart: QMCPrimeImplicantChartStub,
        SettingsButton: SettingsButtonStub,
        DownloadButton: DownloadButtonStub,
        Checkbox: CheckboxStub,
        MultiSelectSwitch: MultiSelectSwitchStub,
        LegendButton: LegendButtonStub,
        'vue-latex': defineComponent({
          props: {
            expression: {
              type: String,
              default: '',
            },
          },
          setup(props) {
            return () => h('span', { 'data-testid': 'vue-latex' }, props.expression)
          },
        }),
      },
    },
  } as const

  it('KVDiagramPanel reflects coupling-term latex updates from shared truth-table state', async () => {
    const wrapper = mount(KVDiagramPanel, panelMountOptions)

    expect(wrapper.find('[data-testid="formula-renderer"]').text()).toBe('f_{DMF}(a, b) = 0')

    const formula = {
      type: 'Disjunctive' as const,
      terms: [{ literals: [{ variable: 'a', negated: false }] }],
    }

    ;(truthTableWorkerManager as any).handleWorkerResponse({
      id: 1,
      qmcResults: { p: Minimizer.emptyQMQResult },
      formulas: { p: formula },
      couplingTermLatex: 'f_{DMF}(a, b) = a',
      selectedFormula: formula,
      formulaTermColors: [],
    })

    await nextTick()

    expect(stateManager.state.truthTable?.couplingTermLatex).toBe('f_{DMF}(a, b) = a')
    expect(wrapper.find('[data-testid="formula-renderer"]').text()).toBe('f_{DMF}(a, b) = a')

    wrapper.unmount()
  })

  it('QMCPanel reflects qmc result updates from shared truth-table state', async () => {
    const wrapper = mount(QMCPanel, panelMountOptions)
    const interactiveView = wrapper.find('[data-screenshot-ignore]')

    expect(interactiveView.find('[data-testid="grouping-table"]').exists()).toBe(false)
    expect(interactiveView.find('[data-testid="formula-renderer"]').text()).toBe('f_{DMF}(a, b) = 0')

    const qmcResult = {
      ...Minimizer.emptyQMQResult,
      iterations: [{ step: 0 }],
      expressions: [{ name: 'a' } as never],
    }
    const selectedFormula = {
      type: 'Disjunctive' as const,
      terms: [{ literals: [{ variable: 'a', negated: false }] }],
    }

    ;(truthTableWorkerManager as any).handleWorkerResponse({
      id: 2,
      qmcResults: { p: qmcResult },
      formulas: { p: selectedFormula },
      couplingTermLatex: 'f_{DMF}(a, b) = a',
      selectedFormula,
      formulaTermColors: [],
    })

    await nextTick()

    expect(stateManager.state.truthTable?.qmcResult).toEqual(qmcResult)
    expect(interactiveView.find('[data-testid="grouping-table"]').exists()).toBe(true)
    expect(interactiveView.find('[data-testid="grouping-table"]').text()).toBe('4')
    expect(interactiveView.find('[data-testid="formula-renderer"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
