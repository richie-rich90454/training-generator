import type { JSX } from "solid-js"
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import type { AppStore } from "../stores/appStore.js"
import type { LogEntry, LogLevel } from "../logger.js"
import { getCacheStats } from "../cache.js"
import { t } from "../i18n.js"
import devtoolsStyles from "./styles/Devtools.module.css"
const styles = { ...devtoolsStyles }
const MAX_LOG_ENTRIES = 1000
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const
type ValidLogLevel = typeof LOG_LEVELS[number]
export interface DevtoolsProps {
    appStore: AppStore
}
export function Devtools(props: DevtoolsProps): JSX.Element {
    let [activeTab, setActiveTab] = createSignal<string>("logs")
    let [logFilter, setLogFilter] = createSignal<string>("all")
    let [logEntries, setLogEntries] = createSignal<LogEntry[]>([])
    function addLog(entry: LogEntry): void {
        setLogEntries((prev) => {
            let next = [...prev, entry]
            if (next.length > MAX_LOG_ENTRIES) {
                next = next.slice(next.length - MAX_LOG_ENTRIES)
            }
            return next
        })
    }
    onMount(() => {
        let listener = (entry: LogEntry) => {
            addLog(entry)
        }
        props.appStore.logger.addListener(listener)
        document.addEventListener("keydown", handleKeydown)
        onCleanup(() => {
            props.appStore.logger.removeListener(listener)
            document.removeEventListener("keydown", handleKeydown)
        })
    })
    let filteredEntries = createMemo<LogEntry[]>(() => {
        let filter = logFilter()
        if (filter === "all") {
            return logEntries()
        }
        return logEntries().filter((entry) => entry.level === filter)
    })
    function clearLogs(): void {
        setLogEntries([])
    }
    function handleKeydown(e: KeyboardEvent): void {
        if (!props.appStore.uiStore.devtoolsOpen()) {
            return
        }
        if (e.key === "Escape") {
            e.preventDefault()
            props.appStore.uiStore.setDevtoolsOpen(false)
        }
    }
    function switchTab(tabName: string): void {
        let validTabs = ["logs", "cache", "workers", "memory"]
        if (!validTabs.includes(tabName)) {
            return
        }
        setActiveTab(tabName)
    }
    function levelClass(level: string): string {
        if (LOG_LEVELS.includes(level as ValidLogLevel)) {
            return `log-level-${level}`
        }
        return "log-level-info"
    }
    function formatTime(timestamp: string): string {
        try {
            return new Date(timestamp).toLocaleTimeString()
        }
        catch {
            return "--:--:--"
        }
    }
    let cacheStats = createMemo(() => {
        let cs = getCacheStats()
        let hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
        return { cs, hitRate }
    })
    let workerInfo = createMemo(() => {
        let workerCount = typeof Worker !== "undefined" ? 2 : 0
        let workerStatus = typeof Worker !== "undefined" ? t("devtools.workers.statusAvailable") : t("devtools.workers.statusUnavailable")
        return { workerCount, workerStatus }
    })
    let memoryInfo = createMemo(() => {
        let mem = (performance as any).memory as {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
        } | undefined
        if (mem) {
            let usedMB = (mem.usedJSHeapSize / 1048576).toFixed(2)
            let totalMB = (mem.totalJSHeapSize / 1048576).toFixed(2)
            let limitMB = (mem.jsHeapSizeLimit / 1048576).toFixed(2)
            let usagePercent = mem.jsHeapSizeLimit > 0 ? ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1) : "0"
            return { available: true as const, usedMB, totalMB, limitMB, usagePercent }
        }
        return { available: false as const }
    })
    return (
        <Show when={props.appStore.uiStore.devtoolsOpen()}>
            <Portal mount={document.body}>
                <div class={styles["devtools-panel"]} data-testid="devtools-panel" role="dialog" aria-modal="true" aria-labelledby="devtools-title">
                    <div class={styles["devtools-header"]}>
                        <h3 id="devtools-title">{t("devtools.title")}</h3>
                        <button class={styles["devtools-close"]} aria-label={t("devtools.closeAria")} data-i18n-aria-label="devtools.closeAria" onClick={() => props.appStore.uiStore.setDevtoolsOpen(false)}>
                            &times;
                        </button>
                    </div>
                    <div class={styles["devtools-tabs"]}>
                        <button class={"devtools-tab" + (activeTab() === "logs" ? " active" : "")} data-tab="logs" onClick={() => switchTab("logs")}>{t("devtools.tab.logs")}</button>
                        <button class={"devtools-tab" + (activeTab() === "cache" ? " active" : "")} data-tab="cache" onClick={() => switchTab("cache")}>{t("devtools.tab.cache")}</button>
                        <button class={"devtools-tab" + (activeTab() === "workers" ? " active" : "")} data-tab="workers" onClick={() => switchTab("workers")}>{t("devtools.tab.workers")}</button>
                        <button class={"devtools-tab" + (activeTab() === "memory" ? " active" : "")} data-tab="memory" onClick={() => switchTab("memory")}>{t("devtools.tab.memory")}</button>
                    </div>
                    <div class={styles["devtools-content"]}>
                        <Show when={activeTab() === "logs"}>
                            <div class={`${styles["devtools-tab-content"]} ${styles["active"]}`} data-testid="devtools-logs">
                                <div class={styles["devtools-log-controls"]}>
                                    <select id="devtools-log-filter" aria-label={t("devtools.logFilterAria")} data-i18n-aria-label="devtools.logFilterAria" value={logFilter()} onChange={(e) => setLogFilter(e.currentTarget.value)}>
                                        <option value="all">{t("devtools.logLevel.all")}</option>
                                        <option value="debug">{t("devtools.logLevel.debug")}</option>
                                        <option value="info">{t("devtools.logLevel.info")}</option>
                                        <option value="warn">{t("devtools.logLevel.warn")}</option>
                                        <option value="error">{t("devtools.logLevel.error")}</option>
                                    </select>
                                    <button id="devtools-clear-logs" onClick={clearLogs}>{t("devtools.clearLogs")}</button>
                                </div>
                                <div id="devtools-log-output" data-testid="devtools-log-output">
                                    <Show when={filteredEntries().length > 0} fallback={<div class={styles["devtools-empty"]} data-testid="devtools-empty">{t("devtools.noLogEntries")}</div>}>
                                        <For each={filteredEntries()}>
                                            {(entry) => {
                                                return (
                                                    <div class={"devtools-log-entry " + levelClass(entry.level)} data-testid="devtools-log-entry">
                                                        <span class={styles["log-time"]}>{formatTime(entry.timestamp)}</span>
                                                        <span class={styles["log-level"]}>[{entry.level.toUpperCase()}]</span>
                                                        <span class={styles["log-module"]}>{entry.module}</span>
                                                        <span class={styles["log-message"]}>{entry.message}</span>
                                                    </div>
                                                )
                                            }}
                                        </For>
                                    </Show>
                                </div>
                            </div>
                        </Show>
                        <Show when={activeTab() === "cache"}>
                            <div class={`${styles["devtools-tab-content"]} ${styles["active"]}`} data-testid="devtools-cache">
                                <table>
                                    <tbody>
                                        <tr><td>{t("devtools.cache.hits")}</td><td>{cacheStats().cs.hits}</td></tr>
                                        <tr><td>{t("devtools.cache.misses")}</td><td>{cacheStats().cs.misses}</td></tr>
                                        <tr><td>{t("devtools.cache.totalRequests")}</td><td>{cacheStats().cs.totalRequests}</td></tr>
                                        <tr><td>{t("devtools.cache.hitRate")}</td><td>{cacheStats().hitRate}%</td></tr>
                                        <tr><td>{t("devtools.cache.tokensSaved")}</td><td>{cacheStats().cs.estimatedTokensSaved.toLocaleString("en-US")}</td></tr>
                                        <tr><td>{t("devtools.cache.costSaved")}</td><td>{t("devtools.cache.currencyPrefix")}{cacheStats().cs.estimatedCostSaved.toFixed(4)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                        <Show when={activeTab() === "workers"}>
                            <div class={`${styles["devtools-tab-content"]} ${styles["active"]}`} data-testid="devtools-workers">
                                <table>
                                    <tbody>
                                        <tr><td>{t("devtools.workers.pool")}</td><td>{workerInfo().workerCount}{t("devtools.workers.countSuffix")}</td></tr>
                                        <tr><td>{t("devtools.workers.status")}</td><td>{workerInfo().workerStatus}</td></tr>
                                        <tr><td>{t("devtools.workers.types")}</td><td>{t("devtools.workers.chunkWorker")}, {t("devtools.workers.dedupWorker")}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                        <Show when={activeTab() === "memory"}>
                            <div class={`${styles["devtools-tab-content"]} ${styles["active"]}`} data-testid="devtools-memory">
                                <Show when={memoryInfo().available} fallback={(
                                    <>
                                        <p>{t("devtools.memory.unavailable")}</p>
                                        <p>{t("devtools.memory.preciseFlagHint")}</p>
                                    </>
                                )}>
                                    <table>
                                        <tbody>
                                            <tr><td>{t("devtools.memory.usedHeap")}</td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).usedMB}{t("devtools.memory.mbSuffix")}</td></tr>
                                            <tr><td>{t("devtools.memory.totalHeap")}</td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).totalMB}{t("devtools.memory.mbSuffix")}</td></tr>
                                            <tr><td>{t("devtools.memory.heapLimit")}</td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).limitMB}{t("devtools.memory.mbSuffix")}</td></tr>
                                            <tr><td>{t("devtools.memory.usage")}</td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).usagePercent}%</td></tr>
                                        </tbody>
                                    </table>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </div>
            </Portal>
        </Show>
    )
}
