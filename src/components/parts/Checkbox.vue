<template>
    <div class="inline-flex items-center gap-2">
        <span v-if="label" class="text-on-surface-variant select-none">{{ label }}</span>
        <div class="inline-flex items-center gap-0.5 rounded bg-surface-2 p-0.5 border border-surface-3">
            <label class="cursor-pointer">
                <button type="button"
                    class="w-8 h-8 p-2 rounded-xs transition-colors duration-100 flex items-center justify-center"
                    :class="isChecked
                        ? 'bg-primary border-primary text-white'
                        : 'bg-surface-2 text-on-surface-variant hover:bg-surface-3 border border-surface-3 text-on-surface-disabled'"
                    @click="isChecked = !isChecked">
                    <svg v-if="isChecked" fill="currentColor" viewBox="1 1 22 22">
                        <path
                            d="M 20.292969 5.2929688 L 9 16.585938 L 4.7070312 12.292969 L 3.2929688 13.707031 L 9 19.414062 L 21.707031 6.7070312 L 20.292969 5.2929688 z">
                        </path>
                    </svg>

                    <svg v-else fill="currentColor" viewBox="0 0 50 50">
                        <path
                            d="M 9.15625 6.3125 L 6.3125 9.15625 L 22.15625 25 L 6.21875 40.96875 L 9.03125 43.78125 L 25 27.84375 L 40.9375 43.78125 L 43.78125 40.9375 L 27.84375 25 L 43.6875 9.15625 L 40.84375 6.3125 L 25 22.15625 Z">
                        </path>
                    </svg>
                </button>
            </label>
        </div>
    </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    modelValue?: boolean
    label?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>()

const isChecked = computed({
    get: () => !!props.modelValue,
    set: (value) => emit('update:modelValue', value)
})
</script>
