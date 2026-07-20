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
const TABS = ["logs", "cache", "workers", "memory"] as const
export interface DevtoolsProps {
    appStore: AppStore
}
export function Devtools(props: DevtoolsProps): JSX.Element {
    let [activeTab, setActiveTab] = createSignal<string>("logs")
    let [logFilter, setLogFilter] = createSignal<string>("all")
    let [logEntries, setLogEntries] = createSignal<LogEntry[]>([])
    let tablistRef: HTMLDivElement | undefined
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
    function handleTabKeydown(e: KeyboardEvent): void {
        const tabs = TABS as readonly string[]
        const currentIndex = tabs.indexOf(activeTab())
        if (currentIndex === -1) return
        let nextIndex: number | null = null
        if (e.key === "ArrowRight") {
            nextIndex = (currentIndex + 1) % tabs.length
        }
        else if (e.key === "ArrowLeft") {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
        }
        else if (e.key === "Home") {
            nextIndex = 0
        }
        else if (e.key === "End") {
            nextIndex = tabs.length - 1
        }
        if (nextIndex === null) return
        e.preventDefault()
        const nextTab = tabs[nextIndex]
        setActiveTab(nextTab)
        const buttons = tablistRef?.querySelectorAll<HTMLButtonElement>("button[role='tab']")
        if (buttons && buttons[nextIndex]) {
            buttons[nextIndex].focus()
        }
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
                        <h3 id="devtools-title" data-i18n="devtools.title">{t("devtools.title")}</h3>
                        <button class={styles["devtools-close"]} aria-label={t("devtools.closeAria")} data-i18n-aria-label="devtools.closeAria" onClick={() => props.appStore.uiStore.setDevtoolsOpen(false)}>
                            &times;
                        </button>
                    </div>
                    <div class={styles["devtools-tabs"]} ref={tablistRef} role="tablist" aria-label={t("devtools.title")} data-i18n-aria-label="devtools.title" onKeyDown={handleTabKeydown}>
                        <button
                            class={"devtools-tab" + (activeTab() === "logs" ? " active" : "")}
                            data-tab="logs"
                            role="tab"
                            id="devtools-tab-logs"
                            aria-selected={activeTab() === "logs"}
                            aria-controls="devtools-panel-logs"
                            tabindex={activeTab() === "logs" ? 0 : -1}
                            onClick={() => switchTab("logs")}
                        ><span data-i18n="devtools.tab.logs">{t("devtools.tab.logs")}</span></button>
                        <button
                            class={"devtools-tab" + (activeTab() === "cache" ? " active" : "")}
                            data-tab="cache"
                            role="tab"
                            id="devtools-tab-cache"
                            aria-selected={activeTab() === "cache"}
                            aria-controls="devtools-panel-cache"
                            tabindex={activeTab() === "cache" ? 0 : -1}
                            onClick={() => switchTab("cache")}
                        ><span data-i18n="devtools.tab.cache">{t("devtools.tab.cache")}</span></button>
                        <button
                            class={"devtools-tab" + (activeTab() === "workers" ? " active" : "")}
                            data-tab="workers"
                            role="tab"
                            id="devtools-tab-workers"
                            aria-selected={activeTab() === "workers"}
                            aria-controls="devtools-panel-workers"
                            tabindex={activeTab() === "workers" ? 0 : -1}
                            onClick={() => switchTab("workers")}
                        ><span data-i18n="devtools.tab.workers">{t("devtools.tab.workers")}</span></button>
                        <button
                            class={"devtools-tab" + (activeTab() === "memory" ? " active" : "")}
                            data-tab="memory"
                            role="tab"
                            id="devtools-tab-memory"
                            aria-selected={activeTab() === "memory"}
                            aria-controls="devtools-panel-memory"
                            tabindex={activeTab() === "memory" ? 0 : -1}
                            onClick={() => switchTab("memory")}
                        ><span data-i18n="devtools.tab.memory">{t("devtools.tab.memory")}</span></button>
                    </div>
                    <div class={styles["devtools-content"]}>
                        <Show when={activeTab() === "logs"}>
                            <div
                                class={`${styles["devtools-tab-content"]} ${styles["active"]}`}
                                data-testid="devtools-logs"
                                role="tabpanel"
                                id="devtools-panel-logs"
                                aria-labelledby="devtools-tab-logs"
                                tabindex="0"
                            >
                                <div class={styles["devtools-log-controls"]}>
                                    <select id="devtools-log-filter" aria-label={t("devtools.logFilterAria")} data-i18n-aria-label="devtools.logFilterAria" value={logFilter()} onChange={(e) => setLogFilter(e.currentTarget.value)}>
                                        <option value="all" data-i18n="devtools.logLevel.all">{t("devtools.logLevel.all")}</option>
                                        <option value="debug" data-i18n="devtools.logLevel.debug">{t("devtools.logLevel.debug")}</option>
                                        <option value="info" data-i18n="devtools.logLevel.info">{t("devtools.logLevel.info")}</option>
                                        <option value="warn" data-i18n="devtools.logLevel.warn">{t("devtools.logLevel.warn")}</option>
                                        <option value="error" data-i18n="devtools.logLevel.error">{t("devtools.logLevel.error")}</option>
                                    </select>
                                    <button id="devtools-clear-logs" data-i18n="devtools.clearLogs" onClick={clearLogs}>{t("devtools.clearLogs")}</button>
                                </div>
                                <div id="devtools-log-output" data-testid="devtools-log-output">
                                    <Show when={filteredEntries().length > 0} fallback={<div class={styles["devtools-empty"]} data-testid="devtools-empty" data-i18n="devtools.noLogEntries">{t("devtools.noLogEntries")}</div>}>
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
                            <div
                                class={`${styles["devtools-tab-content"]} ${styles["active"]}`}
                                data-testid="devtools-cache"
                                role="tabpanel"
                                id="devtools-panel-cache"
                                aria-labelledby="devtools-tab-cache"
                                tabindex="0"
                            >
                                <table>
                                    <tbody>
                                        <tr><td><span data-i18n="devtools.cache.hits">{t("devtools.cache.hits")}</span></td><td>{cacheStats().cs.hits}</td></tr>
                                        <tr><td><span data-i18n="devtools.cache.misses">{t("devtools.cache.misses")}</span></td><td>{cacheStats().cs.misses}</td></tr>
                                        <tr><td><span data-i18n="devtools.cache.totalRequests">{t("devtools.cache.totalRequests")}</span></td><td>{cacheStats().cs.totalRequests}</td></tr>
                                        <tr><td><span data-i18n="devtools.cache.hitRate">{t("devtools.cache.hitRate")}</span></td><td>{cacheStats().hitRate}%</td></tr>
                                        <tr><td><span data-i18n="devtools.cache.tokensSaved">{t("devtools.cache.tokensSaved")}</span></td><td>{cacheStats().cs.estimatedTokensSaved.toLocaleString("en-US")}</td></tr>
                                        <tr><td><span data-i18n="devtools.cache.costSaved">{t("devtools.cache.costSaved")}</span></td><td><span data-i18n="devtools.cache.currencyPrefix">{t("devtools.cache.currencyPrefix")}</span>{cacheStats().cs.estimatedCostSaved.toFixed(4)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                        <Show when={activeTab() === "workers"}>
                            <div
                                class={`${styles["devtools-tab-content"]} ${styles["active"]}`}
                                data-testid="devtools-workers"
                                role="tabpanel"
                                id="devtools-panel-workers"
                                aria-labelledby="devtools-tab-workers"
                                tabindex="0"
                            >
                                <table>
                                    <tbody>
                                        <tr><td><span data-i18n="devtools.workers.pool">{t("devtools.workers.pool")}</span></td><td>{workerInfo().workerCount}<span data-i18n="devtools.workers.countSuffix">{t("devtools.workers.countSuffix")}</span></td></tr>
                                        <tr><td><span data-i18n="devtools.workers.status">{t("devtools.workers.status")}</span></td><td>{workerInfo().workerStatus}</td></tr>
                                        <tr><td><span data-i18n="devtools.workers.types">{t("devtools.workers.types")}</span></td><td><span data-i18n="devtools.workers.chunkWorker">{t("devtools.workers.chunkWorker")}</span>, <span data-i18n="devtools.workers.dedupWorker">{t("devtools.workers.dedupWorker")}</span></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                        <Show when={activeTab() === "memory"}>
                            <div
                                class={`${styles["devtools-tab-content"]} ${styles["active"]}`}
                                data-testid="devtools-memory"
                                role="tabpanel"
                                id="devtools-panel-memory"
                                aria-labelledby="devtools-tab-memory"
                                tabindex="0"
                            >
                                <Show when={memoryInfo().available} fallback={(
                                    <>
                                        <p data-i18n="devtools.memory.unavailable">{t("devtools.memory.unavailable")}</p>
                                        <p data-i18n="devtools.memory.preciseFlagHint">{t("devtools.memory.preciseFlagHint")}</p>
                                    </>
                                )}>
                                    <table>
                                        <tbody>
                                            <tr><td><span data-i18n="devtools.memory.usedHeap">{t("devtools.memory.usedHeap")}</span></td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).usedMB}<span data-i18n="devtools.memory.mbSuffix">{t("devtools.memory.mbSuffix")}</span></td></tr>
                                            <tr><td><span data-i18n="devtools.memory.totalHeap">{t("devtools.memory.totalHeap")}</span></td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).totalMB}<span data-i18n="devtools.memory.mbSuffix">{t("devtools.memory.mbSuffix")}</span></td></tr>
                                            <tr><td><span data-i18n="devtools.memory.heapLimit">{t("devtools.memory.heapLimit")}</span></td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).limitMB}<span data-i18n="devtools.memory.mbSuffix">{t("devtools.memory.mbSuffix")}</span></td></tr>
                                            <tr><td><span data-i18n="devtools.memory.usage">{t("devtools.memory.usage")}</span></td><td>{(memoryInfo() as { available: true, usedMB: string, totalMB: string, limitMB: string, usagePercent: string }).usagePercent}%</td></tr>
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
