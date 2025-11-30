import { Buffer } from 'buffer'
import { init, WASI } from '@wasmer/wasi'

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer
}

export interface EspressoResult {
  exitCode: number
  stdout: string
  stderr: string
}

const WASM_PATH = '/logic-easy/espresso.wasm'
let isWasiInitialized = false
const moduleCache: Record<string, WebAssembly.Module> = {}

async function getModule(url: string): Promise<WebAssembly.Module> {
  if (moduleCache[url]) {
    return moduleCache[url]
  }

  const response = await fetch(url)
  const wasm = await WebAssembly.compileStreaming(response)
  moduleCache[url] = wasm
  return wasm
}

async function instantiateModule(wasi: WASI, url: string): Promise<void> {
  const module = await getModule(url)
  const instance = await WebAssembly.instantiate(module, wasi.getImports(module) as WebAssembly.Imports)
  await wasi.instantiate(instance, {})
}

/**
 * Execute Espresso with the given input and arguments
 */
export async function runEspresso(
  input: string,
  args: string[] = [],
): Promise<EspressoResult> {
  if (!isWasiInitialized) {
    await init()
    isWasiInitialized = true
  }

  const wasi = new WASI({
    env: {},
    args: ['espresso', ...args, '/input.esp'],
  })

  const file = wasi.fs.open('/input.esp', { read: true, write: true, create: true })
  file.writeString(input)
  file.flush()

  await instantiateModule(wasi, WASM_PATH)

  const exitCode = wasi.start()

  return {
    exitCode,
    stdout: wasi.getStdoutString(),
    stderr: wasi.getStderrString(),
  }
}
