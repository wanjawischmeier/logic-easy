<template>
    <div class="h-full text-on-surface flex flex-col p-2 overflow-auto">
        <div class="flex flex-wrap justify-center gap-12">
            <QMCGroupingTable :iterations="qmcResult?.iterations" :prime-implicants="qmcResult?.pis" />
            <QMCPrimeImplicantChart :minterms="qmcResult?.minterms" :prime-implicants="qmcResult?.pis"
                :chart="qmcResult?.chart" :input-vars="inputVars" />
            <FormulaRenderer :latex-expression="props.couplingTermLatex" v-if="props.couplingTermLatex">
            </FormulaRenderer>
        </div>
    </div>
</template>

<script setup lang="ts">
import QMCGroupingTable from './parts/QMCGroupingTable.vue'
import QMCPrimeImplicantChart from './parts/QMCPrimeImplicantChart.vue'
import FormulaRenderer from './FormulaRenderer.vue'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'

const props = defineProps<TruthTableState>()
</script>

<style scoped></style>
