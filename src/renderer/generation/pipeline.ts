// Framework-agnostic generation pipeline.
// Encapsulates the full processing flow — file reading, chunking, LLM generation,
// deduplication — without any UI coupling. Emits structured events for the UI layer
// to consume. Designed for testability and debugging.

import type { SelectedFile, TrainingItem, ProcessFileResult } from "../../types/index.js"
import type Processor from "../processor.js"
import type { ProviderManager } from "../provider.js"
import type PromptManager from "../promptManager.js"
import { createOrchestrator, type OrchestratorSettings } from "../processing/orchestrator.js"
import { getCacheStats } from "../cache.js"
import { t } from "../i18n.js"

export interface PipelineEvents {
  /** Called when processing starts for a batch of files. */
  onStart?: (fileCount: number) => void
  /** Called when a file begins processing. */
  onFileStart?: (fileName: string, chunkCount: number) => void
  /** Called when a single chunk is processed successfully. */
  onChunkProcessed?: (event: ChunkProcessedEvent) => void
  /** Called when a single chunk fails. */
  onChunkFailed?: (event: ChunkFailedEvent) => void
  /** Called when a file completes (success or failure). */
  onFileComplete?: (event: FileCompleteEvent) => void
  /** Called when all files are processed. */
  onComplete?: (event: PipelineCompleteEvent) => void
  /** Called when processing is aborted. */
  onAbort?: () => void
  /** Called for log messages during processing. */
  onLog?: (message: string, level: "info" | "success" | "warning" | "error") => void
}

export interface ChunkProcessedEvent {
  fileName: string
  fileIndex: number
  fileTotal: number
  chunkIndex: number
  chunkTotal: number
  items: TrainingItem[]
  totalItemsSoFar: number
  totalTokensSoFar: number
  cacheHitRate: number
  latencyMs: number
}

export interface ChunkFailedEvent {
  fileName: string
  fileIndex: number
  fileTotal: number
  chunkIndex: number
  chunkTotal: number
  error: string
}

export interface FileCompleteEvent {
  fileName: string
  fileIndex: number
  fileTotal: number
  success: boolean
  items: TrainingItem[]
  error?: string
}

export interface PipelineCompleteEvent {
  totalItems: number
  successfulFiles: number
  failedFiles: number
  totalTokens: number
  elapsedMs: number
}

export interface PipelineDeps {
  processor: Processor
  providerManager: () => ProviderManager | null
  promptManager: PromptManager
  createTrainingItem: (input: string, output: string, processingType: string, outputFormat: string) => TrainingItem[]
}

export interface PipelineSettings {
  model: string
  processingType: string
  outputFormat: string
  language: string
  chunkSize: number
  smartSizing: boolean
  enableThinking: boolean
  customPrompt?: string
  maxChunks?: number
  maxParallelFiles: number
  provider: string
}

export class GenerationPipeline {
  private deps: PipelineDeps
  private events: PipelineEvents
  private aborted = false

  constructor(deps: PipelineDeps, events: PipelineEvents = {}) {
    this.deps = deps
    this.events = events
  }

  abort(): void {
    this.aborted = true
    this.deps.processor.abort()
  }

  get isAborted(): boolean {
    return this.aborted || this.deps.processor.isAborted
  }

  async processFiles(files: SelectedFile[], settings: PipelineSettings): Promise<PipelineCompleteEvent> {
    this.aborted = false
    const { processor, providerManager, promptManager, createTrainingItem } = this.deps
    const events = this.events

    // Re-init provider before processing
    const pm = providerManager()
    processor.provider = pm
    if (pm) {
      pm.startHealthChecks(60000)
    }

    const orchestrator = createOrchestrator({
      processor,
      promptManager,
      createTrainingItem,
    })

    processor.reset()
    const startTime = Date.now()

    events.onStart?.(files.length)

    let totalItemsGenerated = 0
    let successfulFiles = 0
    let failedFiles = 0
    let chunksCompleted = 0
    let chunksTotal = 0
    let completedFiles = 0
    const maxParallel = Math.max(1, settings.maxParallelFiles || 1)
    let queueIndex = 0
    // Per-file item accumulator for correct totalItemsSoFar reporting
    let fileItemsAccumulated = 0

    const orchSettings: OrchestratorSettings = {
      model: settings.model,
      processingType: settings.processingType,
      outputFormat: settings.outputFormat,
      language: settings.language,
      chunkSize: settings.chunkSize,
      smartSizing: settings.smartSizing,
      enableThinking: settings.enableThinking,
      customPrompt: settings.customPrompt,
      maxChunks: settings.maxChunks,
    }

    // Use a lock to prevent race conditions when multiple workers fetch files
    let fileLock = false
    function getNextFile(): SelectedFile | undefined {
      if (fileLock) return undefined
      fileLock = true
      const idx = queueIndex++
      fileLock = false
      return files[idx]
    }

    const self = this
    async function processWorker(): Promise<void> {
      while (!processor.isAborted && !self.aborted) {
        // Atomic file index assignment
        const file = getNextFile()
        if (!file) return

        completedFiles++
        const fileIndex = completedFiles
        fileItemsAccumulated = 0

        events.onLog?.(
          t("log.processingFile", undefined, { index: String(fileIndex), total: String(files.length), name: file.name }),
          "info"
        )

        const result = await orchestrator.processFile(file, orchSettings, {
          onFileStart: (chunkCount: number) => {
            chunksTotal += chunkCount
            events.onLog?.(
              t("log.fileChunked", undefined, { name: file.name, count: String(chunkCount) }),
              "info"
            )
            events.onFileStart?.(file.name, chunkCount)
          },
          onChunkProcessed: (index: number, total: number, items: TrainingItem[]) => {
            chunksCompleted++
            fileItemsAccumulated += items.length
            const cs = getCacheStats()
            const hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
            events.onChunkProcessed?.({
              fileName: file.name,
              fileIndex,
              fileTotal: files.length,
              chunkIndex: index,
              chunkTotal: total,
              items,
              totalItemsSoFar: totalItemsGenerated + fileItemsAccumulated,
              totalTokensSoFar: processor.stats.totalTokens,
              cacheHitRate: hitRate,
              latencyMs: processor.stats.averageLatencyMs,
            })
            events.onLog?.(
              t("log.chunkProcessed", undefined, {
                index: String(index + 1),
                total: String(total),
                percent: String(Math.round(((index + 1) / total) * 100)),
                count: String(items.length),
              }),
              "info"
            )
          },
          onChunkFailed: (index: number, error: string) => {
            events.onChunkFailed?.({
              fileName: file.name,
              fileIndex,
              fileTotal: files.length,
              chunkIndex: index,
              chunkTotal: chunksTotal > 0 ? chunksTotal : 1,
              error,
            })
            events.onLog?.(
              t("log.chunkFailed", undefined, { index: String(index + 1), error }),
              "warning"
            )
          },
        })

        if (result.success && result.data) {
          totalItemsGenerated += result.data.length
          successfulFiles++
          events.onFileComplete?.({
            fileName: file.name,
            fileIndex,
            fileTotal: files.length,
            success: true,
            items: result.data,
          })
          events.onLog?.(
            t("log.fileProcessedSuccess", undefined, { name: file.name, count: String(result.data.length) }),
            "success"
          )
        } else {
          failedFiles++
          events.onFileComplete?.({
            fileName: file.name,
            fileIndex,
            fileTotal: files.length,
            success: false,
            items: [],
            error: result.error || "",
          })
          events.onLog?.(
            t("log.fileProcessedError", undefined, { name: file.name, error: result.error || "" }),
            "error"
          )
        }
      }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < maxParallel; i++) {
      workers.push(processWorker())
    }
    await Promise.all(workers)

    const elapsed = Date.now() - startTime
    const pipelineEvent: PipelineCompleteEvent = {
      totalItems: totalItemsGenerated,
      successfulFiles,
      failedFiles,
      totalTokens: processor.stats.totalTokens,
      elapsedMs: elapsed,
    }

    if (this.aborted) {
      events.onAbort?.()
    } else {
      events.onComplete?.(pipelineEvent)
    }

    return pipelineEvent
  }
}