<template>
    <div class="relative" ref="dropdownContainer">
        <div class="bg-surface-2 rounded border border-surface-3 p-0.5">
            <button @click="toggleDropdown"
                class="px-2.5 py-1.5 rounded-xs text-white hover:bg-primary transition-colors text-sm items-center gap-2"
                :class="showDropdown ? 'bg-primary' : ''" title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 24 24"
                    fill="white">
                    <path
                        d="M 9.6660156 2 L 9.1757812 4.5234375 C 8.3516137 4.8342536 7.5947862 5.2699307 6.9316406 5.8144531 L 4.5078125 4.9785156 L 2.171875 9.0214844 L 4.1132812 10.708984 C 4.0386488 11.16721 4 11.591845 4 12 C 4 12.408768 4.0398071 12.832626 4.1132812 13.291016 L 4.1132812 13.292969 L 2.171875 14.980469 L 4.5078125 19.021484 L 6.9296875 18.1875 C 7.5928951 18.732319 8.3514346 19.165567 9.1757812 19.476562 L 9.6660156 22 L 14.333984 22 L 14.824219 19.476562 C 15.648925 19.165543 16.404903 18.73057 17.068359 18.185547 L 19.492188 19.021484 L 21.826172 14.980469 L 19.886719 13.291016 C 19.961351 12.83279 20 12.408155 20 12 C 20 11.592457 19.96113 11.168374 19.886719 10.710938 L 19.886719 10.708984 L 21.828125 9.0195312 L 19.492188 4.9785156 L 17.070312 5.8125 C 16.407106 5.2676813 15.648565 4.8344327 14.824219 4.5234375 L 14.333984 2 L 9.6660156 2 z M 11.314453 4 L 12.685547 4 L 13.074219 6 L 14.117188 6.3945312 C 14.745852 6.63147 15.310672 6.9567546 15.800781 7.359375 L 16.664062 8.0664062 L 18.585938 7.40625 L 19.271484 8.5917969 L 17.736328 9.9277344 L 17.912109 11.027344 L 17.912109 11.029297 C 17.973258 11.404235 18 11.718768 18 12 C 18 12.281232 17.973259 12.595718 17.912109 12.970703 L 17.734375 14.070312 L 19.269531 15.40625 L 18.583984 16.59375 L 16.664062 15.931641 L 15.798828 16.640625 C 15.308719 17.043245 14.745852 17.36853 14.117188 17.605469 L 14.115234 17.605469 L 13.072266 18 L 12.683594 20 L 11.314453 20 L 10.925781 18 L 9.8828125 17.605469 C 9.2541467 17.36853 8.6893282 17.043245 8.1992188 16.640625 L 7.3359375 15.933594 L 5.4140625 16.59375 L 4.7285156 15.408203 L 6.265625 14.070312 L 6.0878906 12.974609 L 6.0878906 12.972656 C 6.0276183 12.596088 6 12.280673 6 12 C 6 11.718768 6.026742 11.404282 6.0878906 11.029297 L 6.265625 9.9296875 L 4.7285156 8.59375 L 5.4140625 7.40625 L 7.3359375 8.0683594 L 8.1992188 7.359375 C 8.6893282 6.9567546 9.2541467 6.6314701 9.8828125 6.3945312 L 10.925781 6 L 11.314453 4 z M 12 8 C 9.8034768 8 8 9.8034768 8 12 C 8 14.196523 9.8034768 16 12 16 C 14.196523 16 16 14.196523 16 12 C 16 9.8034768 14.196523 8 12 8 z M 12 10 C 13.111477 10 14 10.888523 14 12 C 14 13.111477 13.111477 14 12 14 C 10.888523 14 10 13.111477 10 12 C 10 10.888523 10.888523 10 12 10 z">
                    </path>
                </svg>
            </button>
        </div>

        <div v-if="showDropdown"
            class="absolute right-0 mt-2 p-2 bg-surface-2 rounded shadow-lg border border-surface-3 z-50">
            <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                    <label class="text-xs opacity-70">Input Variables</label>
                    <MultiToggleSwitch :values="inputVars" :initialSelected="inputSelection"
                        :onToggle="handleInputSelectionChange" :min-selected="1">
                    </MultiToggleSwitch>
                </div>

                <div v-if="showOutputVarSelector" class="flex flex-col gap-1">
                    <label class="text-xs opacity-70">Output Variable</label>
                    <MultiSelectSwitch :values="outputVars" :initialSelected="selectedOutputIndex"
                        :onSelect="handleOutputChange">
                    </MultiSelectSwitch>
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-xs opacity-70">Function Type</label>
                    <MultiSelectSwitch :values="functionTypes" :initialSelected="selectedFunctionTypeIndex"
                        :onSelect="handleFunctionTypeChange">
                    </MultiSelectSwitch>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MultiSelectSwitch from './MultiSelectSwitch.vue'
import MultiToggleSwitch from './MultiToggleSwitch.vue'
import { FunctionType } from '@/utility/types'
import { stateManager } from '@/projects/stateManager'
import { updateTruthTable } from '@/utility/truthtable/interpreter'

interface Props {
    inputVars: string[]
    outputVars: string[]
    functionTypes: FunctionType[]
    selectedOutputIndex: number
    selectedFunctionType: FunctionType
    inputSelection: boolean[]
}

interface Emits {
    (e: 'update:selectedOutputIndex', value: number): void
    (e: 'update:selectedFunctionType', value: FunctionType): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showDropdown = ref(false)
const dropdownContainer = ref<HTMLElement | null>(null)

const showOutputVarSelector = computed(() => props.outputVars.length > 1)
const selectedFunctionTypeIndex = computed(() => props.functionTypes.indexOf(props.selectedFunctionType))

const toggleDropdown = () => {
    showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
    showDropdown.value = false
}

const handleInputSelectionChange = (index: number, value: boolean, selected: boolean[]) => {
    if (!stateManager.state.truthTable) return
    stateManager.state.truthTable.inputSelection = [...selected];
    updateTruthTable()
}

const handleOutputChange = (value: unknown, index: number) => {
    if (!stateManager.state.truthTable) return
    stateManager.state.truthTable.outputVariableIndex = index;
    updateTruthTable()
}

const handleFunctionTypeChange = (value: unknown, index: number) => {
    if (!stateManager.state.truthTable) return
    stateManager.state.truthTable.functionType = value as FunctionType;
    updateTruthTable()
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
    if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
        closeDropdown()
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>
