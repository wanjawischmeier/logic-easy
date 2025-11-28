/**
 * Espresso WASM wrapper - provides a clean API for executing Espresso logic minimization
 */

export interface EspressoResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface EspressoOptions {
  wasmPath?: string
}

/**
 * EspressoRunner - manages Espresso execution via Web Worker or direct calls
 */
export class EspressoRunner {
  private worker: Worker | null = null
  private wasmPath: string

  constructor(options: EspressoOptions = {}) {
    this.wasmPath = options.wasmPath || '/logic-easy/espresso.wasm'
  }

  /**
   * Initialize the worker (call this in browser contexts)
   */
  initWorker(): void {
    if (this.worker) return

    this.worker = new Worker(
      new URL('../workers/Espresso-Wasm-Web/worker.js', import.meta.url),
      { type: 'module' }
    )
  }

  /**
   * Execute Espresso with the given input and arguments
   */
  async execute(input: string, args: string[] = []): Promise<EspressoResult> {
    // If worker is available, use it
    if (this.worker) {
      return this.executeViaWorker(input, args)
    }

    // Otherwise, call the function directly (useful for tests)
    return this.executeDirect(input, args)
  }

  /**
   * Execute via Web Worker
   */
  private executeViaWorker(input: string, args: string[]): Promise<EspressoResult> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized'))
    }

    const worker = this.worker

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        resolve(event.data)
      }

      const onError = (error: ErrorEvent) => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        reject(new Error(error.message))
      }

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.postMessage({ input, args, wasmPath: this.wasmPath })
    })
  }

  /**
   * Execute by directly importing and calling the worker function
   * (Used in test environments or when worker isn't available)
   */
  private async executeDirect(input: string, args: string[]): Promise<EspressoResult> {
    // @ts-expect-error - importing worker JS module
    const { executeEspresso } = await import('../workers/Espresso-Wasm-Web/worker.js')
    return executeEspresso(input, args, this.wasmPath)
  }

  /**
   * Terminate the worker
   */
  dispose(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

/**
 * Convenience function for one-off executions
 */
export async function runEspresso(
  input: string,
  args: string[] = [],
  options: EspressoOptions = {}
): Promise<EspressoResult> {
  const runner = new EspressoRunner(options)
  try {
    return await runner.execute(input, args)
  } finally {
    runner.dispose()
  }
}
