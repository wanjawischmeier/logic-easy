<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { IDockviewPanelProps } from 'dockview-vue'

const props = defineProps<{ params: IDockviewPanelProps }>()
const wasmPath: string = '/logic-easy/espresso.wasm';

const title = ref('')
let disposable: { dispose?: () => void } | null = null

// Worker and UI state for running the Espresso wasm worker
let espressoWorker: Worker | null = null
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

  // Create a worker instance. Vite will handle bundling the worker when
  // referenced with `new URL(..., import.meta.url)`.
  try {
    espressoWorker = new Worker(new URL('../workers/Espresso-Wasm-Web/worker.js', import.meta.url), { type: 'module' })
  } catch (e) {
    console.error('Failed to create Espresso worker', e)
    espressoWorker = null
  }
})

onBeforeUnmount(() => {
  disposable?.dispose?.()
  espressoWorker?.terminate()
})

/** Run the worker with the provided input and args. This wrapper is single-call-at-a-time.
 *  If you need concurrent runs, modify the worker to accept an `id` and echo it back.
 */
function runEspresso(args: string[] = []) {
  if (!espressoWorker) {
    return Promise.reject(new Error('Worker not available'))
  }
  if (running.value) return Promise.reject(new Error('Already running'))

  running.value = true
  stdout.value = ''
  stderr.value = ''
  exitCode.value = null

  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent) => {
      running.value = false
      espressoWorker?.removeEventListener('message', onMessage)
      espressoWorker?.removeEventListener('error', onError)

      const data = ev.data ?? {}
      stdout.value = data.stdout ?? ''
      stderr.value = data.stderr ?? ''
      exitCode.value = typeof data.exitCode === 'number' ? data.exitCode : null
      resolve(data)
    }

    const onError = (ev: ErrorEvent) => {
      running.value = false
      espressoWorker?.removeEventListener('message', onMessage)
      espressoWorker?.removeEventListener('error', onError)
      reject(ev.message)
    }

    espressoWorker.addEventListener('message', onMessage)
    espressoWorker.addEventListener('error', onError)

    espressoWorker.postMessage({ input: input.value, args, wasmPath: wasmPath.value })
  })
}
</script>

<template>
  <div class="h-full text-white flex flex-col gap-2 p-2">
    <div class="font-semibold">{{ title }}</div>

    <label class="text-sm">Espresso input</label>
    <textarea v-model="input" placeholder="Enter Espresso source here"
      class="w-full min-h-[140px] font-mono bg-gray-900 text-white p-2 rounded border border-gray-700"></textarea>

    <div class="flex items-center gap-2">
      <button @click="runEspresso()" :disabled="running"
        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded">Run</button>
      <button @click="runEspresso(['--help'])" :disabled="running"
        class="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded">Run --help</button>
      <span v-if="running" class="ml-2 text-sm">Running…</span>
    </div>

    <div class="text-sm">
      <strong>Exit code:</strong> {{ exitCode }}
    </div>

    <div>
      <strong>Stdout</strong>
      <pre class="bg-gray-800 text-white p-2 rounded overflow-auto">{{ stdout }}</pre>
    </div>

    <div>
      <strong>Stderr</strong>
      <pre class="bg-red-900 text-white p-2 rounded overflow-auto">{{ stderr }}</pre>
    </div>
  </div>
</template>

<style scoped></style>
