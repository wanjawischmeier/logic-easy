/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EspressoRunner } from '@/lib/espresso'

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

  it('returns help text with expected header', async () => {
    const espresso = new EspressoRunner({ wasmPath: '/logic-easy/espresso.wasm' })

    const result = await espresso.execute('', ['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('UC Berkeley, Espresso Version')
    expect(result.stderr).toBe('')

    espresso.dispose()
  })

  it('handles input and arguments correctly', async () => {
    const espresso = new EspressoRunner({ wasmPath: '/logic-easy/espresso.wasm' })

    const input = '.i 2\n.o 1\n'
    const result = await espresso.execute(input, ['-t'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBeTruthy()

    espresso.dispose()
  })

  it('executes without worker in test environment', async () => {
    const espresso = new EspressoRunner()

    // Don't initialize worker - should fall back to direct execution
    const result = await espresso.execute('', ['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('UC Berkeley, Espresso Version')
  })
})
