import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @wasmer/wasi before importing the worker module
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

describe('Espresso worker', () => {
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

  it('returns help text that starts with the expected header', async () => {
    // Dynamically import the worker after mocking
    // @ts-expect-error - importing worker JS module for test
    const worker = await import('../workers/Espresso-Wasm-Web/worker.js')

    const result = await worker.executeEspresso('', ['--help'], '/logic-easy/espresso.wasm')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('UC Berkeley, Espresso Version')
    expect(result.stderr).toBe('')
  })

  it('handles input and arguments correctly', async () => {
    const worker = await import('../workers/Espresso-Wasm-Web/worker.js')

    const input = '.i 2\n.o 1\n'
    const result = await worker.executeEspresso(input, ['-t'], '/logic-easy/espresso.wasm')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBeTruthy()
  })
})
