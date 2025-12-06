<template>
    <Teleport to="body">
        <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center">
            <!-- Barrier -->
            <div class="absolute inset-0 bg-black/20" @click="onBarrierClick"></div>

            <!-- Popup Content -->
            <div class="relative bg-surface-1 border border-surface-3 rounded-xs shadow-xl max-w-2xl w-full pt-4 pb-2 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                @keydown.enter="onEnterPress">
                <!-- Project Name Input -->
                <input v-focus ref="projectInput" type="text" placeholder="Project Name" maxlength="40"
                    v-model="projectName" class="pl-6 outline-none truncate text-3xl text-on-surface mb-4" />

                <!-- Project-Specific Configuration -->
                <div class="flex-1 overflow-auto px-6 py-4">
                    <slot :project-name="projectName"></slot>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-end gap-2 px-6 py-4">
                    <button @click="onCancel" class="px-2 py-1 rounded-xs font-medium text-on-surface bg-surface-2"
                        type="button">
                        Cancel
                    </button>
                    <button @click="onCreate" :disabled="!isValid" :class="createButtonClass" type="button">
                        Create
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

defineProps<{
    visible: boolean;
    isValid?: boolean;
}>();

const emit = defineEmits<{
    close: [];
    create: [projectName: string];
}>();

const projectInput = ref<HTMLInputElement>();
const projectName = ref('');

watch(projectName, (newVal) => {
    projectName.value = newVal.replace(/[^A-Za-z0-9\s_\-()]/g, '');
});

const createButtonClass = computed(() => {
    const baseClass = 'px-2 py-1 rounded-xs font-medium text-on-surface';
    return projectName.value === ''
        ? `${baseClass} bg-surface-2 text-on-surface-disabled cursor-not-allowed`
        : `${baseClass} bg-primary`;
});

function onBarrierClick() {
    emit('close');
}

function onCancel() {
    emit('close');
}

function onCreate() {
    if (projectName.value !== '') {
        emit('create', projectName.value);
    }
}

function onEnterPress() {
    onCreate();
}
</script>
