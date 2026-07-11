// Application orchestration store.
// Composes fine-grained Solid stores (file, output, settings, UI) with framework-agnostic
// business logic (processor, provider, orchestrator) to drive the SolidJS component tree.
import { createSignal, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import type { SelectedFile, TrainingItem, OllamaStatus } from "../../types/index.js"
import { createFileStore, type FileStore } from "./fileStore.js"
import { createOutputStore, type OutputStore } from "./outputStore.js"
import { createSettingsStore, type SettingsStore } from "./settingsStore.js"
import { createUIStore, type UIStore, type LogType } from "./uiStore.js"
import Processor from "../processor.js"
import { createProvider, ProviderManager } from "../provider.js"
import PromptManager from "../promptManager.js"
import { t } from "../i18n.js"
import { type ToastType } from "./uiStore.js"
import { Logger, type LogLevel, type LogEntry } from "../logger.js"
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "../checkpoint.js"
import { getCacheStats, warmCache } from "../cache.js"
import { validateItems, type QualityReport } from "../qualityValidator.js"
import { AuditTrail } from "../audit.js"
import { initWindowControls } from "../windowControls.js"
import { OnboardingTour, DEFAULT_TOUR_STEPS, STORAGE_KEY as TOUR_STORAGE_KEY } from "../../core/onboardingTour.js"
import { showConfirm } from "../confirm.js"
import { renderIcon } from "../icons.js"
import { GenerationPipeline, type PipelineEvents } from "../generation/pipeline.js"

export interface AppStore {
  fileStore: FileStore
  outputStore: OutputStore
  settingsStore: SettingsStore
  uiStore: UIStore
  processor: Processor
  providerManager: ProviderManager | null
  promptManager: PromptManager
  logger: Logger
  audit: import("../audit.js").AuditTrail
  isProcessing: () => boolean
  qualityReport: () => QualityReport | null
  processingQueue: SelectedFile[]
  init: () => Promise<void>
  detectPlatform: () => Promise<void>
  addLog: (message: string, type?: string) => void
  setProgress: (percent: number, text: string) => void
  initProvider: () => void
  checkOllamaStatus: () => Promise<OllamaStatus>
  refreshOllamaModels: () => Promise<void>
  startOllamaMonitor: () => void
  stopOllamaMonitor: () => void
  toggleDemoMode: () => void
  processFiles: () => Promise<void>
  stopProcessing: () => void
  clearAll: () => void
  exportOutput: (format?: string) => Promise<void>
  copyOutput: () => Promise<boolean>
  savePreset: () => Promise<void>
  showSettings: () => void
  hideSettings: () => void
  showHelp: () => void
  showShortcutsHelp: () => void
  updateOutputPreview: () => void
  maybeStartTour: () => void
  saveProgress: () => Promise<void>
  checkForProgress: () => Promise<void>
  loadCheckpointState: () => Promise<void>
  exportLogs: () => Promise<void>
  handleWarmCache: () => Promise<void>
  showStats: () => void
  showQualityReport: () => void
  openUserGuide: () => Promise<void>
  dispose: () => void
}

const OLLAMA_MONITOR_INTERVAL = 30000

export function createAppStore(): AppStore {
  const fileStore = createFileStore()
  const outputStore = createOutputStore()
  const settingsStore = createSettingsStore()
  const uiStore = createUIStore()
  const processor = new Processor()
  const promptManager = new PromptManager()
  const logger = new Logger()
  const audit = new AuditTrail()
  const [providerManager, setProviderManager] = createSignal<ProviderManager | null>(null)

  function applyExportFormatFromSettings(): void {
    const format = settingsStore.settings.outputFormat || "jsonl"
    const validExportFormat: import("./outputStore.js").ExportFormat =
      format === "jsonl" || format === "json" || format === "chatml" || format === "csv" || format === "text"
        ? format
        : "jsonl"
    outputStore.setExportFormat(validExportFormat)
  }

  const [isProcessing, setIsProcessing] = createSignal<boolean>(false)
  const [qualityReport, setQualityReport] = createSignal<QualityReport | null>(null)
  const [processingQueue, setProcessingQueue] = createStore<SelectedFile[]>([])
  let ollamaMonitorId: number | null = null
  let activePipeline: GenerationPipeline | null = null

  function addLog(message: string, type: string = "info"): void {
    const level: LogLevel = type === "error" ? "error" : type === "warning" ? "warn" : "info"
    logger[level]("app", message)
    uiStore.addLog(message, type as LogType)
  }

  function setProgress(percent: number, text: string): void {
    uiStore.setProgress(percent, text)
  }

  function updateOutputPreview(): void {
    uiStore.updateOutputPreviewDebounced(
      outputStore.previewText(),
      outputStore.itemCount() === 0 && isProcessing()
    )
  }

  async function detectPlatform(): Promise<void> {
    try {
      let platform = "unknown"
      if (window.electronAPI && window.electronAPI.getPlatform) {
        platform = await window.electronAPI.getPlatform()
      } else {
        const userAgent = navigator.userAgent.toLowerCase()
        if (userAgent.includes("win")) platform = "windows"
        else if (userAgent.includes("mac")) platform = "macos"
        else if (userAgent.includes("linux")) platform = "linux"
      }
      document.documentElement.setAttribute("data-platform", platform)
    } catch (error) {
      logger.error("app", t("log.detectPlatformFailed"), { error: (error as Error).message })
      document.documentElement.setAttribute("data-platform", "unknown")
    }
  }

  function initProvider(): void {
    try {
      untrack(providerManager)?.dispose()
      const type = settingsStore.settings.provider || "ollama"
      const config = {
        apiKey: settingsStore.apiKeyPlain(),
        baseUrl: settingsStore.settings.baseUrl || "",
      }
      const pm = createProvider(type, config)
      setProviderManager(pm)
      processor.provider = pm
      pm.startHealthChecks(60000)
      logger.info("app", t("log.providerSet", undefined, { type }))
    } catch (error) {
      logger.error("app", t("log.providerInitFailed", undefined, { error: (error as Error).message }))
    }
  }

  async function checkOllamaStatus(): Promise<OllamaStatus> {
    try {
      if (!window.electronAPI || !window.electronAPI.checkOllama) {
        logger.warn("app", t("log.runningInBrowserMode"))
        addLog(t("log.runningInBrowserMode"), "warning")
        const browserStatus: OllamaStatus = { running: false, models: [], error: t("error.browserMode") }
        uiStore.setOllamaStatus(browserStatus)
        uiStore.setAvailableOllamaModels([])
        fileStore.setOllamaReady(false)
        return browserStatus
      }
      const status = await window.electronAPI.checkOllama()
      uiStore.setOllamaStatus(status)
      fileStore.setOllamaReady(status.running)
      uiStore.setAvailableOllamaModels(status.running ? status.models.map((m) => m.name) : [])
      if (status.running) {
        addLog(
          t("log.ollamaRunning", undefined, {
            version: status.version || "",
            count: String(status.models.length),
          }),
          "success"
        )
      } else {
        addLog(t("log.ollamaNotRunning"), "error")
      }
      return status
    } catch (error) {
      logger.error("app", t("log.ollamaCheckFailed"), { error: (error as Error).message })
      const errorStatus: OllamaStatus = { running: false, models: [], error: (error as Error).message }
      uiStore.setOllamaStatus(errorStatus)
      uiStore.setAvailableOllamaModels([])
      fileStore.setOllamaReady(false)
      return errorStatus
    }
  }

  async function refreshOllamaModels(): Promise<void> {
    uiStore.setOllamaLoading(true)
    try {
      await checkOllamaStatus()
    } finally {
      uiStore.setOllamaLoading(false)
    }
  }

  function startOllamaMonitor(): void {
    stopOllamaMonitor()
    ollamaMonitorId = window.setInterval(() => {
      checkOllamaStatus()
    }, OLLAMA_MONITOR_INTERVAL)
  }

  function stopOllamaMonitor(): void {
    if (ollamaMonitorId) {
      window.clearInterval(ollamaMonitorId)
      ollamaMonitorId = null
    }
  }

  function toggleDemoMode(): void {
    if (processor.demoMode) {
      processor.disableDemoMode()
      fileStore.setDemoActive(false)
      addLog(t("log.demoModeDisabled"), "info")
    } else {
      processor.enableDemoMode()
      fileStore.setDemoActive(true)
      addLog(t("log.demoModeEnabled"), "info")
    }
  }

  function getPipelineSettings() {
    return {
      model: settingsStore.settings.model || "",
      processingType: settingsStore.settings.processingType || "instruction",
      outputFormat: settingsStore.settings.outputFormat || "jsonl",
      language: settingsStore.settings.language || "en",
      chunkSize: settingsStore.settings.chunkSize || 8000,
      smartSizing: settingsStore.appSettings.smartSizing ?? false,
      enableThinking: settingsStore.appSettings.enableThinking ?? false,
      customPrompt: settingsStore.settings.customPrompt || "",
      maxChunks: settingsStore.appSettings.maxChunks,
      maxParallelFiles: settingsStore.appSettings.maxParallelFiles || 1,
      provider: settingsStore.settings.provider || "ollama",
    }
  }

  async function processFiles(): Promise<void> {
    if (isProcessing()) {
      addLog(t("log.processingAlreadyInProgress"), "warning")
      return
    }
    setIsProcessing(true)

    if (!fileStore.hasFiles()) {
      addLog(t("log.noFilesToProcess"), "warning")
      setIsProcessing(false)
      return
    }

    // Validate model is set for non-demo mode
    const model = settingsStore.settings.model || ""
    if (!processor.demoMode && !model) {
      addLog(t("config.model"), "error")
      uiStore.showToast(t("toast.noModelSelected"), "error" as ToastType)
      setIsProcessing(false)
      return
    }

    // Validate model is available for Ollama provider
    const isOllamaProvider = settingsStore.settings.provider === "ollama"
    if (isOllamaProvider && !processor.demoMode) {
      const availableModels = uiStore.availableOllamaModels()
      if (availableModels.length > 0 && !availableModels.includes(model)) {
        addLog(t("log.modelNotAvailable", undefined, { model }), "error")
        uiStore.showToast(t("toast.modelNotAvailable", undefined, { model }), "error" as ToastType)
        setIsProcessing(false)
        return
      }
      if (!uiStore.ollamaStatus().running) {
        addLog(t("log.cannotProcessOllamaOffline"), "error")
        uiStore.showToast(t("toast.ollamaNotRunning"), "error" as ToastType)
        setIsProcessing(false)
        return
      }
    }

    outputStore.clearOutput()
    setQualityReport(null)
    uiStore.clearLiveStream()
    const queue = [...fileStore.selectedFiles]
    setProcessingQueue(queue)

    setProgress(0, t("processing.starting"))
    addLog(
      t("log.startingProcessing", undefined, { count: String(fileStore.fileCount()) }),
      "info"
    )
    audit.record("processing_started", {
      fileCount: fileStore.fileCount(),
      model: model,
      provider: settingsStore.settings.provider || "ollama",
      processingType: settingsStore.settings.processingType || "instruction",
    })

    // Re-init provider to ensure it's current
    initProvider()

    // Dashboard
    uiStore.startDashboard()
    uiStore.setDashboardMetrics({
      chunksTotal: 0,
      chunksDone: 0,
      totalTokens: 0,
      activeProvider: settingsStore.settings.provider || "--",
      cacheHitRate: 0,
      providerLatency: 0,
    })

    let totalItemsGenerated = 0
    let successfulFiles = 0
    let failedFiles = 0
    let chunksTotal = 0
    let chunksDone = 0

    const pipelineEvents: PipelineEvents = {
      onFileStart: (_fileName: string, chunkCount: number) => {
        chunksTotal += chunkCount
        uiStore.setDashboardMetrics({ chunksTotal, chunksDone, activeProvider: settingsStore.settings.provider || "--" })
      },
      onChunkProcessed: (event) => {
        chunksDone++
        totalItemsGenerated += event.items.length
        outputStore.stageItems(event.items)
        const cs = getCacheStats()
        const hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
        uiStore.setDashboardMetrics({
          chunksDone,
          chunksTotal,
          totalTokens: event.totalTokensSoFar,
          cacheHitRate: hitRate,
          providerLatency: event.latencyMs,
          activeProvider: settingsStore.settings.provider || "--",
        })
        setProgress(
          Math.min(99, Math.round((chunksDone / Math.max(1, chunksTotal)) * 100)),
          t("processing.chunksProgress", undefined, {
            done: String(chunksDone),
            total: String(chunksTotal),
          })
        )
        updateOutputPreview()
      },
      onChunkFailed: (event) => {
        chunksDone++
        const cs = getCacheStats()
        const hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
        logger.error("app", t("log.chunkFailed", undefined, { index: String(event.chunkIndex + 1), error: event.error }))
        uiStore.setDashboardMetrics({
          chunksDone,
          chunksTotal,
          totalTokens: processor.stats.totalTokens,
          cacheHitRate: hitRate,
          providerLatency: processor.stats.averageLatencyMs,
          activeProvider: settingsStore.settings.provider || "--",
        })
        setProgress(
          Math.min(99, Math.round((chunksDone / Math.max(1, chunksTotal)) * 100)),
          t("processing.chunksProgress", undefined, {
            done: String(chunksDone),
            total: String(chunksTotal),
          })
        )
      },
      onFileComplete: (event) => {
        if (event.success) {
          outputStore.appendOutput(event.items)
          successfulFiles++
          fileStore.setFileStatus(event.fileName, "completed")
        } else {
          failedFiles++
          fileStore.setFileStatus(event.fileName, "failed")
        }
        updateOutputPreview()
      },
      onLog: (message: string, level: "info" | "success" | "warning" | "error") => {
        addLog(message, level)
      },
      onStreamChunk: (text: string) => {
        uiStore.appendLiveStream(text)
      },
    }

    const pipeline = new GenerationPipeline(
      {
        processor,
        providerManager: () => providerManager(),
        promptManager,
        createTrainingItem: (input: string, output: string, type: string, format: string) =>
          outputStore.createTrainingItem(input, output, type, format),
      },
      pipelineEvents
    )
    activePipeline = pipeline

    const checkpointInterval = window.setInterval(() => {
      const completedChunks: Record<string, number> = {}
      for (const file of processingQueue) {
        const status = fileStore.fileStatuses[file.name]
        completedChunks[file.name] = status === "completed" ? 1 : 0
      }
      saveCheckpoint({
        files: fileStore.selectedFiles,
        completedChunks,
        outputData: [...outputStore.outputData, ...outputStore.stagingData],
        config: {
          model: settingsStore.settings.model || "",
          processingType: settingsStore.settings.processingType || "instruction",
          chunkSize: settingsStore.settings.chunkSize || 2000,
          concurrency: settingsStore.settings.concurrency || 3,
          provider: settingsStore.settings.provider || "ollama",
        },
        timestamp: Date.now(),
      })
    }, 30000)

    try {
      const result = await pipeline.processFiles(queue, getPipelineSettings())
      totalItemsGenerated = result.totalItems
      successfulFiles = result.successfulFiles
      failedFiles = result.failedFiles

      setProgress(100, t("processing.complete"))
      const summaryMessage =
        successfulFiles > 0
          ? t("toast.processingSummarySuccess", undefined, {
              successful: String(successfulFiles),
              total: String(queue.length),
              count: String(totalItemsGenerated),
            })
          : t("toast.processingSummaryWarning", undefined, {
              successful: String(successfulFiles),
              total: String(queue.length),
              failed: String(failedFiles),
              count: String(totalItemsGenerated),
            })
      addLog(summaryMessage, successfulFiles > 0 ? "success" : "warning")
      uiStore.showToast(summaryMessage, successfulFiles > 0 ? "success" : "warning" as ToastType)
      audit.record("processing_completed", {
        itemsGenerated: totalItemsGenerated,
        successfulFiles,
        failedFiles,
      })
      uiStore.setFilesProcessed(successfulFiles)
      uiStore.setLastProcessed(new Date().toLocaleString())
      await clearCheckpoint()
    } catch (error) {
      logger.error("app", t("processing.failed"), { error: (error as Error).message })
      addLog(t("processing.failed"), "error")
      uiStore.showToast(t("toast.processingFailed"), "error" as ToastType)
    } finally {
      window.clearInterval(checkpointInterval)
      setIsProcessing(false)
      uiStore.stopDashboard()
      processor.abort()
      outputStore.clearStaging()
      updateOutputPreview()
      if (outputStore.itemCount() > 0) {
        setQualityReport(validateItems(outputStore.outputData))
        addLog(
          t("log.outputReady", undefined, { count: String(outputStore.itemCount()) }),
          "success"
        )
      }
    }
  }

  function stopProcessing(): void {
    if (activePipeline) {
      activePipeline.abort()
      activePipeline = null
    }
    processor.abort()
    setIsProcessing(false)
    uiStore.stopDashboard()
    setProgress(0, t("processing.stopped"))
    addLog(t("log.processingStopped"), "warning")
    audit.record("processing_stopped", {})
  }

  function clearAll(): void {
    const hasFiles = fileStore.hasFiles()
    const hasOutput = outputStore.hasOutput()
    if (hasFiles || hasOutput) {
      showConfirm(t("confirm.clearAll")).then((confirmed) => {
        if (confirmed) {
          fileStore.clearFiles()
          outputStore.clearOutput()
          setQualityReport(null)
          uiStore.setFilesProcessed(0)
          uiStore.setLastProcessed(t("status.lastProcessedNever"))
          setProgress(0, t("processing.ready"))
          audit.record("clear_all", {})
          addLog(t("log.clearedAll"), "success")
          uiStore.showToast(t("toast.allCleared"), "success" as ToastType)
        }
      })
      return
    }
    fileStore.clearFiles()
    outputStore.clearOutput()
    setQualityReport(null)
    uiStore.setFilesProcessed(0)
    uiStore.setLastProcessed(t("status.lastProcessedNever"))
    setProgress(0, t("processing.ready"))
    audit.record("clear_all", {})
    addLog(t("log.clearedAll"), "success")
  }

  async function exportOutput(format?: string): Promise<void> {
    if (!outputStore.hasOutput()) {
      addLog(t("log.noDataToExport"), "warning")
      return
    }
    audit.record("export_triggered", {
      format: format || outputStore.exportFormat(),
      itemCount: outputStore.itemCount(),
    })
    try {
      await outputStore.exportOutput(format)
      addLog(t("log.exportSuccess", undefined, { count: String(outputStore.itemCount()) }), "success")
      uiStore.showToast(t("toast.exportSuccess", undefined, { count: String(outputStore.itemCount()) }), "success" as ToastType)
    } catch (error) {
      addLog(t("log.exportFailed", undefined, { error: (error as Error).message }), "error")
      uiStore.showToast(t("toast.exportFailed"), "error" as ToastType)
    }
  }

  async function copyOutput(): Promise<boolean> {
    if (!outputStore.hasOutput()) {
      addLog(t("log.noDataToExport"), "warning")
      return false
    }
    try {
      const success = await outputStore.copyOutput()
      if (success) {
        uiStore.showToast(t("toast.copySuccess"), "success" as ToastType)
      } else {
        uiStore.showToast(t("toast.copyTooLarge"), "warning" as ToastType)
      }
      return success
    } catch (error) {
      uiStore.showToast(t("toast.copyFailed"), "error" as ToastType)
      return false
    }
  }

  async function savePreset(): Promise<void> {
    await settingsStore.savePreset()
    applyExportFormatFromSettings()
    initProvider()
    addLog(
      t("log.settingsSaved", undefined, {
        language: settingsStore.settings.language || "en",
        promptPreview: "",
      }),
      "success"
    )
  }

  function showSettings(): void {
    uiStore.openModal("settings")
  }

  function hideSettings(): void {
    uiStore.closeModal()
  }

  function showHelp(): void {
    addLog(t("log.openingHelp"), "info")
    uiStore.openModal("help")
    addLog(t("log.helpOpened"), "success")
  }

  function showShortcutsHelp(): void {
    uiStore.openModal("shortcuts")
  }

  function maybeStartTour(): void {
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(TOUR_STORAGE_KEY) === "true") {
        return
      }
      const tour = new OnboardingTour({ steps: DEFAULT_TOUR_STEPS })
      window.setTimeout(() => tour.start(), 500)
    } catch (error) {
      logger.error("app", t("log.tourStartFailed"), { error: (error as Error).message })
    }
  }

  async function saveProgress(): Promise<void> {
    try {
      if (!window.electronAPI?.saveProgress) return
      await window.electronAPI.saveProgress({
        files: fileStore.selectedFiles,
        outputData: outputStore.outputData,
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.error("app", t("log.saveProgressFailed"), { error: (error as Error).message })
    }
  }

  async function checkForProgress(): Promise<void> {
    try {
      if (!window.electronAPI?.loadProgress) return
      const result = await window.electronAPI.loadProgress()
      if (result.success && result.data && result.data.outputData?.length > 0) {
        logger.info("app", t("log.foundSavedProgress"))
      }
    } catch (error) {
      logger.error("app", t("log.checkProgressFailed"), { error: (error as Error).message })
    }
  }

  async function loadCheckpointState(): Promise<void> {
    try {
      const checkpoint = await loadCheckpoint()
      if (checkpoint && checkpoint.outputData && checkpoint.outputData.length > 0) {
        const confirmed = await showConfirm(
          t("confirm.resumeCheckpoint", undefined, {
            count: String(checkpoint.outputData.length),
          })
        )
        if (confirmed) {
          outputStore.appendOutput(checkpoint.outputData)
          addLog(
            t("log.checkpointRestored", undefined, {
              items: String(checkpoint.outputData.length),
              files: String(checkpoint.files.length),
            }),
            "success"
          )
          uiStore.showToast(t("toast.stateRestored"), "success" as ToastType)
        } else {
          await clearCheckpoint()
        }
      }
    } catch (error) {
      logger.error("app", t("log.loadCheckpointFailed"), { error: (error as Error).message })
    }
  }

  async function exportLogs(): Promise<void> {
    try {
      const jsonlData = logger.exportJSONL()
      const auditData = audit.exportJSONL()
      const data = auditData ? jsonlData + "\n" + auditData : jsonlData
      if (window.electronAPI && window.electronAPI.exportLogs) {
        await window.electronAPI.exportLogs(data)
      }
    } catch (error) {
      console.error(t("log.exportLogsConsole"), error)
    }
  }

  async function handleWarmCache(): Promise<void> {
    try {
      const fileInput = document.createElement("input")
      fileInput.type = "file"
      fileInput.accept = ".json,.jsonl"
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        try {
          const text = await file.text()
          let items: Array<Record<string, unknown>> = []
          try {
            const parsed = JSON.parse(text)
            items = Array.isArray(parsed) ? parsed : []
          } catch {
            items = text
              .split("\n")
              .filter((l) => l.trim())
              .map((line) => {
                try {
                  return JSON.parse(line)
                } catch {
                  return null
                }
              })
              .filter((item): item is Record<string, unknown> => item != null)
          }
          if (items.length === 0) {
            uiStore.showToast(t("toast.noValidItems"), "error" as ToastType)
            return
          }
          const model = settingsStore.settings.model || ""
          const language = settingsStore.settings.language || "en"
          const processingType = settingsStore.settings.processingType || "instruction"
          const prompt =
            (await promptManager.getPromptWithFallback(language, processingType)) || ""
          const warmed = await warmCache(items, model, prompt)
          uiStore.showToast(
            t("toast.cacheWarmed", undefined, {
              warmed: String(warmed),
              total: String(items.length),
            }),
            "success" as ToastType
          )
          addLog(t("log.cacheWarmed", undefined, { warmed: String(warmed) }), "success")
        } catch (err) {
          uiStore.showToast(
            t("toast.readFileFailed", undefined, { error: (err as Error).message }),
            "error" as ToastType
          )
        }
      })
      fileInput.click()
    } catch (err) {
      uiStore.showToast(
        t("toast.warmCacheFailed", undefined, { error: (err as Error).message }),
        "error" as ToastType
      )
    }
  }

  function showStats(): void {
    const r = processor.stats.report
    const cs = getCacheStats()
    const hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
    addLog(
      t("stats.processingComplete", undefined, {
        successful: String(r.successfulChunks),
        total: String(r.totalChunks),
        rate: String(r.successRate),
        tokens: r.totalTokens.toLocaleString(),
        time: r.elapsedFormatted,
      }),
      "info"
    )
    uiStore.openModal("stats")
  }

  function showQualityReport(): void {
    if (!qualityReport()) return
    uiStore.openModal("quality")
  }

  async function openUserGuide(): Promise<void> {
    try {
      if (window.electronAPI && window.electronAPI.openUserGuide) {
        const result = await window.electronAPI.openUserGuide()
        if (!result.success) {
          addLog(
            t("log.openUserGuideFailed", undefined, { error: result.error || "" }),
            "error"
          )
        } else {
          addLog(t("log.openedUserGuide"), "success")
        }
      } else {
        addLog(t("log.userGuideElectronOnly"), "warning")
      }
    } catch (error) {
      addLog(
        t("log.openUserGuideFailed", undefined, { error: (error as Error).message }),
        "error"
      )
    }
  }

  async function init(): Promise<void> {
    await detectPlatform()
    initWindowControls()
    window.addEventListener("unhandledrejection", (event) => {
      logger.error("app", t("log.unhandledRejection"), { reason: String(event.reason) })
      uiStore.showToast(t("toast.unexpectedError"), "error" as ToastType)
    })
    window.addEventListener("error", (event) => {
      logger.error("app", t("log.unhandledError"), {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      })
    })
    await checkForProgress()
    await loadCheckpointState()
    logger.addListener((entry: LogEntry) => {
      window.electronAPI?.writeLog?.(entry)
    })
    await settingsStore.loadSettings()
    applyExportFormatFromSettings()
    initProvider()
    processor.concurrency = settingsStore.settings.concurrency || 3
    addLog(t("processing.welcome"), "info")
    await checkOllamaStatus()
    startOllamaMonitor()
    maybeStartTour()
  }

  function dispose(): void {
    stopOllamaMonitor()
    processor.abort()
    uiStore.stopDashboard()
    providerManager()?.dispose()
    setProviderManager(null)
    processor.provider = null
  }

  return {
    fileStore,
    outputStore,
    settingsStore,
    uiStore,
    processor,
    get providerManager() {
      return providerManager()
    },
    promptManager,
    logger,
    audit,
    isProcessing,
    qualityReport,
    get processingQueue() {
      return processingQueue
    },
    init,
    detectPlatform,
    addLog,
    setProgress,
    initProvider,
    checkOllamaStatus,
    refreshOllamaModels,
    startOllamaMonitor,
    stopOllamaMonitor,
    toggleDemoMode,
    processFiles,
    stopProcessing,
    clearAll,
    exportOutput,
    copyOutput,
    savePreset,
    showSettings,
    hideSettings,
    showHelp,
    showShortcutsHelp,
    updateOutputPreview,
    maybeStartTour,
    saveProgress,
    checkForProgress,
    loadCheckpointState,
    exportLogs,
    handleWarmCache,
    showStats,
    showQualityReport,
    openUserGuide,
    dispose,
  }
}