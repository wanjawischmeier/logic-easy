<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'
import { runEspresso } from '@/utility/truthtable/espresso'

const props = defineProps<{ params: IDockviewPanelProps }>()

const title = ref('')
let disposable: { dispose?: () => void } | null = null

// UI state
const input = ref<string>('')
const stdout = ref<string>('')
const stderr = ref<string>('')
const exitCode = ref<number | null>(null)
const running = ref(false)

onMounted(() => {
  disposable = props.params.api.onDidTitleChange(() => {
    title.value = props.params.api.title ?? ''
  })
  title.value = props.params.api.title ?? ''
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
})

async function minify(args: string[] = []) {
  if (running.value) return

  running.value = true
  stdout.value = ''
  stderr.value = ''
  exitCode.value = null

  try {
    const result = await runEspresso(input.value, args)
    stdout.value = result.stdout
    stderr.value = result.stderr
    exitCode.value = result.exitCode
  } catch (error) {
    stderr.value = String(error)
    exitCode.value = 1
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold">{{ title }}</div>

    <textarea v-model="input" placeholder="Enter Espresso source here"
      class="w-full min-h-[140px] font-mono bg-gray-900 text-white p-2 rounded border border-gray-700"></textarea>

    <div class="flex items-center gap-2">
      <button @click="minify()" :disabled="running"
        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded">Run</button>
      <!-- A bit weird cause there is no -h option, but it does show the help -->
      <button @click="minify(['-h'])" :disabled="running"
        class="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded">Run --help</button>
      <span v-if="running" class="ml-2 text-sm">Running…</span>
    </div>

    <div class="text-sm">
      <strong>Exit code:</strong> {{ exitCode }}
    </div>

    <div class="flex flex-col flex-1 min-h-0">
      <strong>Stdout</strong>
      <pre class="bg-gray-800 text-white p-2 rounded overflow-auto flex-1">{{ stdout }}</pre>
    </div>

    <div class="flex flex-col min-h-[100px]">
      <strong>Stderr</strong>
      <pre class="bg-red-900 text-white p-2 rounded overflow-auto max-h-[150px]">{{ stderr }}</pre>
    </div>
  </div>
</template>

<style scoped></style>
