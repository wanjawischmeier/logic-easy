/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runEspresso } from '@/utility/espresso'

// Mock @wasmer/wasi
vi.mock('@wasmer/wasi', () => {
  return {
    init: async () => { },
    WASI: class {
      opts: unknown
      fs: {
        open: (path: string, opts: unknown) => {
          writeString: (s: string) => void
          flush: () => void
        }
      }

      constructor(opts: unknown) {
        this.opts = opts
        this.fs = {
          open: (path: string, opts: unknown) => ({
            writeString: (s: string) => { },
            flush: () => { },
          }),
        }
      }

      getStdoutString() {
        return 'UC Berkeley, Espresso Version 1.0\nUsage: espresso [options]\n'
      }

      getStderrString() {
        return ''
      }

      start() {
        return 0
      }

      getImports(module: unknown) {
        return {}
      }

      async instantiate(instance: unknown, opts: unknown) {
        return
      }
    },
  }
})

describe('Espresso', () => {
  let originalFetch: typeof fetch
  let originalWebAssemblyCompileStreaming: typeof WebAssembly.compileStreaming
  let originalWebAssemblyInstantiate: typeof WebAssembly.instantiate

  beforeEach(() => {
    // Save originals
    originalFetch = globalThis.fetch
    originalWebAssemblyCompileStreaming = globalThis.WebAssembly.compileStreaming
    originalWebAssemblyInstantiate = globalThis.WebAssembly.instantiate

    // Mock fetch to avoid network calls
    globalThis.fetch = vi.fn(async () => {
      return new Response(new ArrayBuffer(8), { status: 200 })
    }) as typeof fetch

    // Mock WebAssembly methods to avoid real WASM operations
    globalThis.WebAssembly.compileStreaming = vi.fn(async () => ({} as WebAssembly.Module))
    // @ts-expect-error - Mocking WebAssembly.instantiate with simplified return type
    globalThis.WebAssembly.instantiate = vi.fn(async () =>
      ({ instance: {} as WebAssembly.Instance, module: {} as WebAssembly.Module })
    )
  })

  afterEach(() => {
    // Restore originals
    globalThis.fetch = originalFetch
    globalThis.WebAssembly.compileStreaming = originalWebAssemblyCompileStreaming
    globalThis.WebAssembly.instantiate = originalWebAssemblyInstantiate
  })

  it('executes with simple input', async () => {
    const input = `.i 1
.o 1
.ilb x
.ob y
0 1
1 1
.e`

    const result = await runEspresso(input)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBeDefined()
    expect(result.stderr).toBe('')
  })
})
