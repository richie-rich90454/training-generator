import { createStore } from "solid-js/store"
import { createSignal, createMemo } from "solid-js"
import type { OllamaStatus } from "../../types/index.js"
import { t } from "../i18n.js"
export type LogType = "info" | "success" | "warning" | "error"
export interface LogEntry {
    id: number
    message: string
    type: LogType
    timestamp: number
}
export type ToastType = "info" | "success" | "warning" | "error"
export interface ToastItem {
    id: number
    message: string
    type: ToastType
}
export interface DashboardMetrics {
    chunksDone: number
    chunksTotal: number
    chunksPerSecond: number
    tokensPerSecond: number
    totalTokens: number
    cacheHitRate: number
    providerLatency: number
    activeProvider: string
    eta: string
    elapsed: string
}
export type ModalType = "settings" | "help" | "shortcuts" | "stats" | "quality" | "template" | "prompt" | "analytics" | null
export interface UIStore {
    progressPercent: () => number
    progressText: () => string
    logs: LogEntry[]
    toasts: ToastItem[]
    modalOpen: () => ModalType
    settingsOpen: () => boolean
    helpOpen: () => boolean
    shortcutsOpen: () => boolean
    statsOpen: () => boolean
    qualityOpen: () => boolean
    templateOpen: () => boolean
    promptOpen: () => boolean
    analyticsOpen: () => boolean
    commandPaletteOpen: () => boolean
    ollamaStatus: () => OllamaStatus
    ollamaLoading: () => boolean
    dashboardOpen: () => boolean
    dashboardMetrics: () => DashboardMetrics
    devtoolsOpen: () => boolean
    outputPreview: () => string
    outputPreviewLoading: () => boolean
    filesProcessed: () => number
    lastProcessed: () => string
    setProgress: (percent: number, text: string) => void
    addLog: (message: string, type?: LogType) => void
    clearLogs: () => void
    showToast: (message: string, type?: ToastType, duration?: number) => void
    dismissToast: (id: number) => void
    openModal: (modal: ModalType) => void
    closeModal: () => void
    openTemplateEditor: () => void
    closeTemplateEditor: () => void
    openPromptEditor: () => void
    closePromptEditor: () => void
    openAnalytics: () => void
    closeAnalytics: () => void
    openCommandPalette: () => void
    closeCommandPalette: () => void
    setOllamaStatus: (status: OllamaStatus) => void
    setOllamaLoading: (loading: boolean) => void
    setDashboardOpen: (open: boolean) => void
    toggleDashboard: () => void
    setDashboardMetrics: (metrics: Partial<DashboardMetrics>) => void
    startDashboard: () => void
    stopDashboard: () => void
    tickDashboard: () => void
    setDevtoolsOpen: (open: boolean) => void
    toggleDevtools: () => void
    setOutputPreview: (text: string, loading?: boolean) => void
    clearOutputPreview: () => void
    updateOutputPreviewDebounced: (text: string, loading?: boolean) => void
    setFilesProcessed: (count: number) => void
    setLastProcessed: (time: string) => void
    getLogIcon: (type: LogType) => string
}
const MAX_LOGS = 50
const DEFAULT_TOAST_DURATION = 4000
let nextLogId = 1
let nextToastId = 1
let previewTimer: number | null = null
export function createUIStore(): UIStore {
    const [progressPercent, setProgressPercent] = createSignal<number>(0)
    const [progressText, setProgressText] = createSignal<string>(t("processing.ready"))
    const [logs, setLogs] = createStore<LogEntry[]>([])
    const [toasts, setToasts] = createStore<ToastItem[]>([])
    const [modalOpen, setModalOpen] = createSignal<ModalType>(null)
    const [ollamaStatus, setOllamaStatus] = createSignal<OllamaStatus>({ running: false, models: [] })
    const [ollamaLoading, setOllamaLoading] = createSignal<boolean>(false)
    const [dashboardOpen, setDashboardOpenState] = createSignal<boolean>(false)
    const [dashboardMetrics, setDashboardMetricsState] = createSignal<DashboardMetrics>({
        chunksDone: 0, chunksTotal: 0, chunksPerSecond: 0, tokensPerSecond: 0, totalTokens: 0, cacheHitRate: 0, providerLatency: 0, activeProvider: "--", eta: "--", elapsed: "0s"
    })
    let dashboardStartTime = 0
    let dashboardInterval: number | null = null
    const [devtoolsOpen, setDevtoolsOpenState] = createSignal<boolean>(false)
    const [commandPaletteOpen, setCommandPaletteOpenState] = createSignal<boolean>(false)
    const [outputPreview, setOutputPreview] = createSignal<string>("")
    const [outputPreviewLoading, setOutputPreviewLoading] = createSignal<boolean>(false)
    const [filesProcessed, setFilesProcessed] = createSignal<number>(0)
    const [lastProcessed, setLastProcessed] = createSignal<string>(t("status.lastProcessedNever"))
    const settingsOpen = createMemo(() => modalOpen() === "settings")
    const helpOpen = createMemo(() => modalOpen() === "help")
    const shortcutsOpen = createMemo(() => modalOpen() === "shortcuts")
    const statsOpen = createMemo(() => modalOpen() === "stats")
    const qualityOpen = createMemo(() => modalOpen() === "quality")
    const templateOpen = createMemo(() => modalOpen() === "template")
    const promptOpen = createMemo(() => modalOpen() === "prompt")
    const analyticsOpen = createMemo(() => modalOpen() === "analytics")
    function setProgress(percent: number, text: string): void {
        if (isNaN(percent) || !isFinite(percent)) percent = 0
        setProgressPercent(Math.max(0, Math.min(100, percent)))
        setProgressText(text)
    }
    function sanitizeText(text: string): string {
        if (text == null) return ""
        return String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    }
    function addLog(message: string, type: LogType = "info"): void {
        const entry: LogEntry = {
            id: nextLogId++,
            message: sanitizeText(message),
            type,
            timestamp: Date.now()
        }
        setLogs(logs.length, entry)
        if (logs.length > MAX_LOGS) {
            setLogs(logs.slice(1))
        }
    }
    function clearLogs(): void {
        setLogs([])
    }
    function showToast(message: string, type: ToastType = "info", duration?: number): void {
        const id = nextToastId++
        setToasts(toasts.length, { id, message, type })
        window.setTimeout(() => {
            dismissToast(id)
        }, duration ?? DEFAULT_TOAST_DURATION)
    }
    function dismissToast(id: number): void {
        setToasts(toasts.filter(t => t.id !== id))
    }
    function openModal(modal: ModalType): void {
        setModalOpen(modal)
    }
    function closeModal(): void {
        setModalOpen(null)
    }
    function setDashboardOpen(open: boolean): void {
        setDashboardOpenState(open)
    }
    function toggleDashboard(): void {
        setDashboardOpenState(!dashboardOpen())
    }
    function setDevtoolsOpen(open: boolean): void {
        setDevtoolsOpenState(open)
    }
    function toggleDevtools(): void {
        setDevtoolsOpenState(!devtoolsOpen())
    }
    function openTemplateEditor(): void {
        setModalOpen("template")
    }
    function closeTemplateEditor(): void {
        if (modalOpen() === "template") {
            setModalOpen(null)
        }
    }
    function openPromptEditor(): void {
        setModalOpen("prompt")
    }
    function closePromptEditor(): void {
        if (modalOpen() === "prompt") {
            setModalOpen(null)
        }
    }
    function openAnalytics(): void {
        setModalOpen("analytics")
    }
    function closeAnalytics(): void {
        if (modalOpen() === "analytics") {
            setModalOpen(null)
        }
    }
    function openCommandPalette(): void {
        setCommandPaletteOpenState(true)
    }
    function closeCommandPalette(): void {
        setCommandPaletteOpenState(false)
    }
    function formatDuration(ms: number): string {
        ms = Math.round(ms)
        if (ms < 1000) return t("duration.ms", undefined, { ms: String(ms) })
        if (ms < 60000) return t("duration.s", undefined, { s: String(Math.round(ms / 1000)) })
        let min = Math.floor(ms / 60000)
        let sec = Math.round((ms % 60000) / 1000)
        if (sec >= 60) {
            min += Math.floor(sec / 60)
            sec = sec % 60
        }
        return t("duration.m_s", undefined, { min: String(min), sec: String(sec) })
    }
    function updateDashboardMetrics(metrics: Partial<DashboardMetrics>): void {
        setDashboardMetricsState((prev) => ({ ...prev, ...metrics }))
    }
    function startDashboard(): void {
        if (dashboardInterval !== null) {
            window.clearInterval(dashboardInterval)
        }
        dashboardStartTime = Date.now()
        updateDashboardMetrics({
            chunksDone: 0, chunksTotal: 0, chunksPerSecond: 0, tokensPerSecond: 0, totalTokens: 0,
            eta: "--", elapsed: "0s", cacheHitRate: 0, providerLatency: 0, activeProvider: "--"
        })
        setDashboardOpenState(true)
        dashboardInterval = window.setInterval(() => {
            tickDashboard()
        }, 500)
    }
    function stopDashboard(): void {
        if (dashboardInterval !== null) {
            window.clearInterval(dashboardInterval)
            dashboardInterval = null
        }
        setDashboardOpenState(false)
    }
    function tickDashboard(): void {
        if (!dashboardOpen()) {
            return
        }
        let metrics = dashboardMetrics()
        let elapsed = (Date.now() - dashboardStartTime) / 1000
        let chunksPerSecond = elapsed > 0 ? Math.round(metrics.chunksDone / elapsed) : 0
        let elapsedText = formatDuration(elapsed * 1000)
        let tokensPerSecond = elapsed > 0 && metrics.totalTokens > 0 ? Math.round(metrics.totalTokens / elapsed) : 0
        let etaText = "--"
        if (chunksPerSecond > 0 && metrics.chunksTotal > 0) {
            let remaining = metrics.chunksTotal - metrics.chunksDone
            let etaSeconds = remaining / chunksPerSecond
            etaText = formatDuration(etaSeconds * 1000)
        }
        updateDashboardMetrics({ chunksPerSecond, elapsed: elapsedText, tokensPerSecond, eta: etaText })
    }
    function setOutputPreviewDirect(text: string, loading: boolean = false): void {
        setOutputPreview(text)
        setOutputPreviewLoading(loading)
    }
    function clearOutputPreview(): void {
        setOutputPreview("")
        setOutputPreviewLoading(false)
    }
    function updateOutputPreviewDebounced(text: string, loading: boolean = false): void {
        if (previewTimer) {
            clearTimeout(previewTimer)
        }
        previewTimer = window.setTimeout(() => {
            setOutputPreview(text)
            setOutputPreviewLoading(loading)
            previewTimer = null
        }, 200)
    }
    function getLogIcon(type: LogType): string {
        const icons: Record<LogType, string> = {
            info: "info-circle",
            success: "check-circle",
            warning: "exclamation-triangle",
            error: "times-circle"
        }
        return icons[type] || "info-circle"
    }
    return {
        progressPercent,
        progressText,
        get logs() { return logs },
        get toasts() { return toasts },
        modalOpen,
        settingsOpen,
        helpOpen,
        shortcutsOpen,
        statsOpen,
        qualityOpen,
        templateOpen,
        promptOpen,
        analyticsOpen,
        commandPaletteOpen,
        ollamaStatus,
        ollamaLoading,
        dashboardOpen,
        dashboardMetrics,
        devtoolsOpen,
        outputPreview,
        outputPreviewLoading,
        filesProcessed,
        lastProcessed,
        setProgress,
        addLog,
        clearLogs,
        showToast,
        dismissToast,
        openModal,
        closeModal,
        openTemplateEditor,
        closeTemplateEditor,
        openPromptEditor,
        closePromptEditor,
        openAnalytics,
        closeAnalytics,
        openCommandPalette,
        closeCommandPalette,
        setOllamaStatus: (status: OllamaStatus) => setOllamaStatus(status),
        setOllamaLoading: (loading: boolean) => setOllamaLoading(loading),
        setDashboardOpen,
        toggleDashboard,
        setDashboardMetrics: updateDashboardMetrics,
        startDashboard,
        stopDashboard,
        tickDashboard,
        setDevtoolsOpen,
        toggleDevtools,
        setOutputPreview: setOutputPreviewDirect,
        clearOutputPreview,
        updateOutputPreviewDebounced,
        setFilesProcessed: (count: number) => setFilesProcessed(count),
        setLastProcessed: (time: string) => setLastProcessed(time),
        getLogIcon
    }
}
