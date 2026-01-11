<template>
    <div v-if="inputVars.length && outputVars.length" ref="searchBarRef"
        class="group flex items-center gap-2 p-0.5 border border-surface-3 hover:border-primary bg-surface-2 rounded transition-colors duration-100"
        @blur.capture="handleBlur" @click.capture="focusFirstEmpty" @mousedown.stop>
        <div
            class="flex gap-2 px-2 py-1.5 group-hover:bg-primary group-focus-within:bg-primary transition-colors rounded-xs">
            <!-- Icon: Search or Edit -->
            <div class="translate-y-0.5">
                <SearchIcon v-if="searchStep === 1" />
                <PencilIcon v-else />
            </div>

            <!-- Hint Text -->
            <span class="text-sm whitespace-nowrap select-none">{{ searchHint }}</span>
        </div>

        <!-- Individual Bit Boxes -->
        <div class="flex gap-1 pr-1.5">
            <input v-for="index in numBits" :key="index - 1" :ref="el => inputRefs[index - 1] = el as HTMLInputElement"
                type="text" maxlength="1" :value="getValueAtIndex(index - 1)"
                class="bit-box-input w-6 h-6 text-center bg-surface-1 border border-surface-3 rounded outline-none focus:border-primary font-mono text-shadow-2xs cursor-default"
                @mousedown.prevent="focusFirstEmpty" @input="e => handleInput(index - 1, e)"
                @keydown.enter.prevent="() => resetSearch(false)" @keydown.escape.prevent="() => resetSearch(false)"
                @keydown.backspace.prevent="e => handleBackspace(index - 1, e)" />
        </div>
    </div>
</template>

<style scoped></style>

<script setup lang="ts">
import type { TruthTableData } from '@/projects/truth-table/TruthTableProject';
import SearchIcon from '@/components/icons/SearchIcon.vue';
import PencilIcon from '@/components/icons/PencilIcon.vue'
import { computed, watch, ref, nextTick } from 'vue'

const props = defineProps<{
    inputVars: string[]
    outputVars: string[]
    values: TruthTableData
    showAllOutputVars?: boolean
    outputVariableIndex?: number
}>()

const emit = defineEmits<{
    (e: 'valuesChanged', value: TruthTableData): void
    (e: 'highlightedRowChanged', value: number | null): void
    (e: 'blinkGreenRowChanged', value: number | null): void
}>();

defineExpose({ exit })

const searchInput = ref('')
const searchStep = ref<1 | 2>(1) // 1 = search for row, 2 = edit values
const highlightedRow = ref<number | null>(null)
const blinkGreenRow = ref<number | null>(null)
const inputRefs = ref<HTMLInputElement[]>([])
const searchBarRef = ref<HTMLElement | null>(null)

const searchHint = computed(() => {
    return searchStep.value === 1 ? 'Search' : 'Edit'
})

/**
 * Number of bits for current step
 */
const numBits = computed(() => {
    if (searchStep.value === 1) {
        return props.inputVars.length
    }
    // Step 2: if showAllOutputVars is false, only edit the selected output variable
    return props.showAllOutputVars === false ? 1 : props.outputVars.length
})

/**
 * Helper to update individual bit at index
 */
function updateBitAtIndex(index: number, value: string) {
    const chars = searchInput.value.split('')
    while (chars.length <= index) {
        chars.push('')
    }

    chars[index] = value
    searchInput.value = chars.join('')
    console.log('[updateBitAtIndex] new searchInput:', searchInput.value)
}

function getValueAtIndex(index: number): string {
    const val = searchInput.value[index] || ''
    return val
}

/**
 * Focus the first empty input field
 */
function focusFirstEmpty() {
    nextTick(() => {
        for (let i = 0; i < inputRefs.value.length; i++) {
            if (!getValueAtIndex(i)) {
                inputRefs.value[i]?.focus()
                return
            }
        }

        // If all filled, focus the last one
        if (inputRefs.value.length > 0) {
            inputRefs.value[inputRefs.value.length - 1]?.focus()
        }
    })
}

/**
 * Appropiately handle a bit input
 * @param index The index of the digit
 */
function handleInput(index: number, e: Event) {
    const target = e.target as HTMLInputElement;
    // Get only the last character typed
    const newChar = target.value.slice(-1);
    const filtered = newChar.replace(/[^01]/g, '');

    // Update the value at this index
    updateBitAtIndex(index, filtered);

    // Force update the input field value
    target.value = filtered;

    if (filtered && index < numBits.value - 1) {
        console.log('[handleInput] moving to next input, index + 1 =', index + 1)
        // Move to next input
        nextTick(() => {
            inputRefs.value[index + 1]?.focus();
        });
    }
}

/**
 * Clears current digit and moves focus back by one digit if possible
 */
function handleBackspace(index: number, e: KeyboardEvent) {
    if (!getValueAtIndex(index) && index > 0) {
        updateBitAtIndex(index - 1, '');
        inputRefs.value[index - 1]?.focus();
    } else {
        updateBitAtIndex(index, '');
    }
}

/**
 * Clear all input bits
 * @param shouldRefocus Wether to focus first digit afterwards
 */
function resetSearch(shouldRefocus: boolean = false) {
    searchInput.value = ''
    searchStep.value = 1
    highlightedRow.value = null
    emit('highlightedRowChanged', null)

    if (shouldRefocus) {
        nextTick(() => {
            inputRefs.value[0]?.focus()
        })
    } else {
        // Blur the currently focused input
        document.activeElement instanceof HTMLElement && document.activeElement.blur()
    }
}

/**
 * Reset search only if focus left the container
 */
function handleBlur(e: FocusEvent) {
    // Check if the new focus target is still within the search container
    const relatedTarget = e.relatedTarget as HTMLElement
    const currentTarget = e.currentTarget as HTMLElement

    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
        // Focus left the container entirely
        resetSearch(false)
    }
}

/**
 * Defocus and reset search
 */
function exit(e: MouseEvent) {
    if (!searchBarRef.value) {
        return
    }

    const contains = searchBarRef.value.contains(e.target as Node)

    if (!contains) {
        resetSearch(false)
    }
}

// Auto-advance when input is complete
watch(searchInput, (newValue, oldValue) => {
    if (searchStep.value === 1 && newValue.length === props.inputVars.length) {
        console.log('[watch searchInput] Step 1 complete, moving to step 2')
        // Step 1 complete: move to step 2
        const rowIndex = parseInt(newValue, 2)
        if (rowIndex >= 0 && rowIndex < props.values.length) {
            highlightedRow.value = rowIndex
            emit('highlightedRowChanged', rowIndex)
            searchInput.value = ''
            searchStep.value = 2
        }
    } else if (searchStep.value === 2 && newValue.length === numBits.value) {
        console.log('[watch searchInput] Step 2 complete, updating values')
        // Step 2 complete: update values and reset
        const rowIdx = highlightedRow.value
        if (rowIdx !== null) {
            const newValues = props.values.map(row => [...row])
            const outputRow = newValues[rowIdx]
            if (outputRow) {
                if (props.showAllOutputVars === false && typeof props.outputVariableIndex === 'number') {
                    // Only edit the selected output variable
                    const char = newValue[0]
                    outputRow[props.outputVariableIndex] = char === '1' ? 1 : char === '0' ? 0 : '-'
                } else {
                    // Edit all output variables
                    for (let i = 0; i < newValue.length; i++) {
                        const char = newValue[i]
                        outputRow[i] = char === '1' ? 1 : char === '0' ? 0 : '-'
                    }
                }
                emit('valuesChanged', newValues);

                // Blink green
                blinkGreenRow.value = rowIdx
                emit('blinkGreenRowChanged', rowIdx)
                setTimeout(() => {
                    blinkGreenRow.value = null
                    emit('blinkGreenRowChanged', null)
                }, 300)
            }
        }
        resetSearch()
    }
})

// Auto-focus first input when step changes
watch(searchStep, () => {
    focusFirstEmpty()
})
</script>
