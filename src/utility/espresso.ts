import { Buffer } from 'buffer'
import { init, WASI } from '@wasmer/wasi'
import type { TruthTableData } from '@/utility/types'
import type { TruthTableCell } from './truthTableInterpreter'

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer
}

export interface EspressoResult {
  exitCode: number
  stdout: string
  stderr: string
}

// WebAssembly binary taken from https://github.com/wanjawischmeier/espresso-logic
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

  await instantiateModule(wasi, WASM_PATH)

  const exitCode = wasi.start()

  return {
    exitCode,
    stdout: wasi.getStdoutString(),
    stderr: wasi.getStderrString(),
  }
}

export async function minifyTruthTable(
  inputVars: string[],
  outputVars: string[],
  values: TruthTableData
): Promise<TruthTableData> {
  const numInputs = inputVars.length
  const numOutputs = outputVars.length

  let pla = `.i ${numInputs}\n.o ${numOutputs}\n.ilb ${inputVars.join(' ')}\n.ob ${outputVars.join(' ')}\n`
  pla += `.p ${values.length}\n`

  values.forEach((row, index) => {
    const inputBin = index.toString(2).padStart(numInputs, '0')
    const outputStr = row.map(v => v === '-' ? '-' : String(v)).join('')
    pla += `${inputBin} ${outputStr}\n`
  })

  pla += `.e`

  const result = await runEspresso(pla)

  if (result.exitCode !== 0) {
    console.error('Espresso failed', result.stderr)
    return []
  }

  const lines = result.stdout.split('\n')
  const minifiedTable: TruthTableData = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('.') || trimmed.startsWith('#')) continue

    const parts = trimmed.split(/\s+/)
    // Expecting input_part output_part
    if (parts.length >= 2) {
      const inputsStr = parts[0]!
      const outputsStr = parts[1]!

      if (inputsStr.length === numInputs && outputsStr.length === numOutputs) {
        const row: TruthTableCell[] = []
        for (const char of inputsStr) row.push(char === '-' ? '-' : (char === '0' ? 0 : 1))
        for (const char of outputsStr) row.push(char === '-' ? '-' : (char === '0' ? 0 : 1))
        minifiedTable.push(row)
      }
    }
  }

  return minifiedTable
}

