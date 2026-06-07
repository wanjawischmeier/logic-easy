import { stateManager } from '@/projects/stateManager'
import type { WorkerRequest, WorkerResponse } from './truthTableWorker'
import { toRaw } from 'vue'
import type { TruthTableState } from '@/projects/truth-table/TruthTableProject'

function toRawDeep<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const raw = toRaw(value) as object
  const cached = seen.get(raw)
  if (cached) {
    return cached as T
  }

  if (Array.isArray(raw)) {
    const clone: unknown[] = []
    seen.set(raw, clone)
    raw.forEach((item) => clone.push(toRawDeep(item, seen)))
    return clone as T
  }

  const clone: Record<string, unknown> = {}
  seen.set(raw, clone)
  Object.entries(raw).forEach(([key, item]) => {
    clone[key] = toRawDeep(item, seen)
  })
  return clone as T
}

/**
 * Manager for the truth table worker with cooldown and queuing.
 *
 * Features:
 * - Enforces a cooldown period of DEBOUNCE_MS between updates
 * - Updates run instantly if no recent update
 * - If an update just finished, queues next update for DEBOUNCE_MS later
 * - Only keeps the most recent queued update (discards intermediate ones)
 */
class TruthTableWorkerManager {
  private worker: Worker | null = null
  private requestId = 0
  private cooldownTimer: number | null = null
  private isRunning = false
  private hasQueuedUpdate = false
  private lastUpdateCompletedTime = 0
  private readonly DEBOUNCE_MS = 100

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    try {
      // Create worker from the worker file
      this.worker = new Worker(new URL('./truthTableWorker.ts', import.meta.url), {
        type: 'module',
      })

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        this.handleWorkerResponse(e.data)
      }

      this.worker.onerror = (error) => {
        console.error('[TruthTableWorkerManager] Worker error:', error)
        this.isRunning = false
        this.lastUpdateCompletedTime = Date.now()

        // If there's a queued update, try again
        if (this.hasQueuedUpdate) {
          this.hasQueuedUpdate = false
          this.scheduleUpdate()
        }
      }
    } catch (error) {
      console.error('[TruthTableWorkerManager] Failed to create worker:', error)
    }
  }

  private handleWorkerResponse(response: WorkerResponse) {
    console.log('[TruthTableWorkerManager] Received response:', response.id)

    // Update the state with the results
    if (stateManager.state.truthTable) {
      // Update formulas for all output variables
      for (const [outputVar, formula] of Object.entries(response.formulas)) {
        if (formula !== undefined) {
          stateManager.state.truthTable.formulas[outputVar] = formula
        }
      }

      // Update qmcResult for the currently selected output variable
      const currentOutputVar =
        stateManager.state.truthTable.outputVars[stateManager.state.truthTable.outputVariableIndex]
      if (currentOutputVar && response.qmcResults[currentOutputVar] !== undefined) {
        stateManager.state.truthTable.qmcResult = response.qmcResults[currentOutputVar]
      }

      // Update coupling term latex and selected formula for current output variable
      if (response.couplingTermLatex !== undefined) {
        stateManager.state.truthTable.couplingTermLatex = response.couplingTermLatex
      }
      if (response.selectedFormula !== undefined) {
        stateManager.state.truthTable.selectedFormula = response.selectedFormula
      }
      if (response.formulaTermColors !== undefined) {
        stateManager.state.truthTable.formulaTermColors = response.formulaTermColors
      }
      if (response.variations !== undefined) {
        stateManager.state.truthTable.variations = response.variations
        var variationIndex = stateManager.state.truthTable.variationIndex
        stateManager.state.truthTable.variationIndex = Object.fromEntries(
          Object.entries(response.variations).map(([outputVar, variations]) => {
            const current = variationIndex[outputVar] ?? 0
            const bounded = Math.min(current, variations.length - 1)
            return [outputVar, bounded]
          }),
        )
      }
    }

    // Mark as no longer running and record completion time
    this.isRunning = false
    this.lastUpdateCompletedTime = Date.now()

    // If there's a queued update, schedule it with cooldown
    if (this.hasQueuedUpdate) {
      console.log('[TruthTableWorkerManager] Processing queued update after cooldown')
      this.hasQueuedUpdate = false
      this.scheduleUpdate()
    }
  }

  private scheduleUpdate() {
    // Clear any existing cooldown timer
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer)
    }

    // Calculate time since last update completed
    const timeSinceLastUpdate = Date.now() - this.lastUpdateCompletedTime
    const cooldownRemaining = Math.max(0, this.DEBOUNCE_MS - timeSinceLastUpdate)

    if (cooldownRemaining > 0) {
      // Still in cooldown period, schedule for later
      console.log(`[TruthTableWorkerManager] Scheduling update in ${cooldownRemaining}ms`)
      this.cooldownTimer = window.setTimeout(() => {
        this.cooldownTimer = null
        this.executeUpdate()
      }, cooldownRemaining)
    } else {
      // Cooldown period has passed, execute immediately
      console.log('[TruthTableWorkerManager] Cooldown passed, executing immediately')
      this.executeUpdate()
    }
  }

  private executeUpdate() {
    if (!this.worker) {
      console.warn('[TruthTableWorkerManager] Worker not initialized')
      return
    }

    if (!stateManager.state.truthTable) {
      console.warn('[TruthTableWorkerManager] No truth table state found')
      return
    }

    // If already running, mark that we have a queued update
    if (this.isRunning) {
      console.log('[TruthTableWorkerManager] Update already running, queueing this one')
      this.hasQueuedUpdate = true
      return
    }

    // Mark as running and send to worker
    this.isRunning = true
    const id = ++this.requestId

    console.log('[TruthTableWorkerManager] Sending request:', id)

    // Serialize the truth table state to remove Vue reactivity proxies
    const truthTable = stateManager.state.truthTable
    const serializedTruthTable: TruthTableState = {
      inputVars: toRawDeep(truthTable.inputVars),
      outputVars: toRawDeep(truthTable.outputVars),
      values: toRawDeep(truthTable.values),
      formulas: toRawDeep(truthTable.formulas),
      outputVariableIndex: truthTable.outputVariableIndex,
      functionType: truthTable.functionType,
      functionRepresentation: truthTable.functionRepresentation,
      qmcResult: toRawDeep(truthTable.qmcResult),
      couplingTermLatex: truthTable.couplingTermLatex,
      selectedFormula: toRawDeep(truthTable.selectedFormula),
      variations: toRawDeep(truthTable.variations),
      variationIndex: toRawDeep(truthTable.variationIndex),
      fsmMode: truthTable.fsmMode,
    }

    const request: WorkerRequest = {
      id,
      truthTable: serializedTruthTable,
    }

    try {
      this.worker.postMessage(request)
    } catch (error) {
      console.error('[TruthTableWorkerManager] Failed to post worker request:', error)
      this.isRunning = false
      this.lastUpdateCompletedTime = Date.now()

      if (this.hasQueuedUpdate) {
        this.hasQueuedUpdate = false
        this.scheduleUpdate()
      }
    }
  }

  /**
   * Request a truth table update.
   * This will respect cooldown periods and queue appropriately.
   */
  public update() {
    console.log('[TruthTableWorkerManager] Update requested')

    // If currently running, just mark that we have a queued update
    if (this.isRunning) {
      this.hasQueuedUpdate = true
      // Don't schedule - we'll handle it when current finishes
      return
    }

    // Otherwise, schedule with cooldown check
    this.scheduleUpdate()
  }

  /**
   * Clean up the worker
   */
  public dispose() {
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// Export a singleton instance
export const truthTableWorkerManager = new TruthTableWorkerManager()
