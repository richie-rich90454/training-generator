import type { JSX } from "solid-js"
import { Show, For, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import type { TrainingItem } from "../../types/index.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import { estimateExportSize } from "../exportFormats.js"
import cardsStyles from "./styles/Cards.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
import outputCardStyles from "./styles/OutputCard.module.css"
const styles = { ...cardsStyles, ...buttonsStyles, ...outputCardStyles }
export interface OutputCardProps {
    appStore: AppStore
}

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 150

function getItemDisplayText(item: TrainingItem): string {
    if (item.output) return item.output
    if (item.instruction) return item.instruction
    if (item.input) return item.input
    if (item.messages) return item.messages.map(m => m.content).join(" ")
    if (item.text) return item.text
    return ""
}

function itemMatchesSearch(item: TrainingItem, query: string): boolean {
    if (!query) return true
    const input = item.input != null ? String(item.input) : ""
    const output = item.output != null ? String(item.output) : ""
    const text = (input + output).toLowerCase()
    return text.indexOf(query.toLowerCase()) !== -1
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "~0 B"
    if (bytes < 1024) return `~${bytes} B`
    if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `~${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function OutputCard(props: OutputCardProps): JSX.Element {
    const { appStore } = props
    const { outputStore, uiStore } = appStore
    let liveStreamRef: HTMLDivElement | undefined
    let searchTimer: number | null = null

    const [debouncedSearch, setDebouncedSearch] = createSignal("")
    const [currentPage, setCurrentPage] = createSignal(0)

    function handleExport(): void {
        appStore.exportOutput(outputStore.exportFormat())
    }
    function handleCopy(): void {
        appStore.copyOutput()
    }
    const liveStream = () => uiStore.liveStreamText()
    const hasLiveStream = () => liveStream().length > 0
    createEffect(() => {
        const text = liveStream()
        if (text.length > 0 && liveStreamRef) {
            liveStreamRef.scrollTop = liveStreamRef.scrollHeight
        }
    })

    createEffect(() => {
        const value = uiStore.outputPreviewSearch()
        if (searchTimer !== null) {
            clearTimeout(searchTimer)
        }
        searchTimer = window.setTimeout(() => {
            setDebouncedSearch(value)
            searchTimer = null
        }, SEARCH_DEBOUNCE_MS)
    })

    onCleanup(() => {
        if (searchTimer !== null) {
            clearTimeout(searchTimer)
            searchTimer = null
        }
    })

    const allItems = createMemo<TrainingItem[]>(() => {
        const staging = outputStore.stagingData ?? []
        const output = outputStore.outputData ?? []
        return staging.length > 0 ? staging : output
    })

    const filteredItems = createMemo(() => {
        const query = debouncedSearch()
        const items = allItems()
        if (!query) return items
        return items.filter(item => itemMatchesSearch(item, query))
    })

    createEffect(() => {
        debouncedSearch()
        setCurrentPage(0)
    })

    const totalPages = createMemo(() => Math.max(1, Math.ceil(filteredItems().length / PAGE_SIZE)))
    const safeCurrentPage = createMemo(() => Math.min(currentPage(), totalPages() - 1))
    const paginatedItems = createMemo(() => {
        const start = safeCurrentPage() * PAGE_SIZE
        return filteredItems().slice(start, start + PAGE_SIZE)
    })

    const estimatedSize = createMemo(() => {
        const items = allItems()
        const format = outputStore.exportFormat()
        return estimateExportSize(items, format)
    })

    function handleSearchInput(e: Event): void {
        const target = e.currentTarget as HTMLInputElement
        uiStore.setOutputPreviewSearch(target.value)
    }
    function handleSearchClear(): void {
        uiStore.setOutputPreviewSearch("")
    }
    function handlePrevPage(): void {
        setCurrentPage(p => Math.max(0, p - 1))
    }
    function handleNextPage(): void {
        setCurrentPage(p => Math.min(totalPages() - 1, p + 1))
    }

    return (
        <div class={styles["card"]}>
            <div class={styles["card-header"]}>
                <div class={styles["card-title"]}>
                    <Icon html={renderIcon("fa-file-code")} />
                    <span data-i18n="output.title">{t("output.title")}</span>
                </div>
                <div class={styles["section-actions"]}>
                    <select
                        id="export-format"
                        class={`form-control ${styles["output-format-select"]}`}
                        aria-label={t("output.exportFormatAria")}
                        data-i18n-aria-label="output.exportFormatAria"
                        value={outputStore.exportFormat()}
                        onChange={(e) => outputStore.setExportFormat(e.currentTarget.value as import("../stores/outputStore.js").ExportFormat)}
                    >
                        <option value="jsonl" data-i18n="output.exportFormat.jsonl">{t("output.exportFormat.jsonl")}</option>
                        <option value="json" data-i18n="output.exportFormat.json">{t("output.exportFormat.json")}</option>
                        <option value="chatml" data-i18n="output.exportFormat.chatml">{t("output.exportFormat.chatml")}</option>
                        <option value="csv" data-i18n="output.exportFormat.csv">{t("output.exportFormat.csv")}</option>
                        <option value="text" data-i18n="output.exportFormat.text">{t("output.exportFormat.text")}</option>
                    </select>
                    <button
                        id="analytics-btn"
                        class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                        title={t("output.analyticsTitle")}
                        aria-label={t("output.analyticsAria")}
                        data-i18n-title="output.analyticsTitle"
                        data-i18n-aria-label="output.analyticsAria"
                        onClick={() => appStore.uiStore.openAnalytics()}
                        disabled={!outputStore.hasOutput()}
                    >
                        <Icon html={renderIcon("fa-chart-bar")} />
                        <span data-i18n="output.analytics">{t("output.analytics")}</span>
                    </button>
                    <button
                        id="export-btn"
                        class={`${styles["btn"]} ${styles["btn--export"]}`}
                        title={t("output.exportTitle")}
                        aria-label={t("output.exportAria")}
                        data-i18n-title="output.exportTitle"
                        data-i18n-aria-label="output.exportAria"
                        onClick={handleExport}
                        disabled={!outputStore.hasOutput()}
                    >
                        <Icon html={renderIcon("fa-download")} />
                        <span data-i18n="output.export">{t("output.export")}</span>
                    </button>
                    <button
                        id="copy-btn"
                        class={`${styles["btn"]} ${styles["btn--copy"]}`}
                        title={t("output.copyTitle")}
                        aria-label={t("output.copyAria")}
                        data-i18n-title="output.copyTitle"
                        data-i18n-aria-label="output.copyAria"
                        onClick={handleCopy}
                        disabled={!outputStore.hasOutput()}
                    >
                        <Icon html={renderIcon("fa-copy")} />
                        <span data-i18n="output.copy">{t("output.copy")}</span>
                    </button>
                </div>
            </div>
            <div class={styles["output-progress-section"]}>
                <div
                    class={styles["output-progress-bar"]}
                    role="progressbar"
                    aria-valuenow={uiStore.progressPercent()}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("processing.progressAria")}
                    data-i18n-aria-label="processing.progressAria"
                >
                    <div class={styles["output-progress-fill"]} style={{ width: uiStore.progressPercent() + "%" }} />
                </div>
                <span class={styles["output-progress-text"]}>{uiStore.progressPercent() + t("common.percent")}</span>
            </div>
            <div class={styles["output-card__search"]}>
                <input
                    type="search"
                    id="output-preview-search"
                    class={styles["output-card__search-input"]}
                    placeholder={t("outputCard.search.placeholder")}
                    aria-label={t("outputCard.search.aria")}
                    data-i18n-placeholder="outputCard.search.placeholder"
                    data-i18n-aria-label="outputCard.search.aria"
                    value={uiStore.outputPreviewSearch()}
                    onInput={handleSearchInput}
                />
                <Show when={uiStore.outputPreviewSearch().length > 0}>
                    <button
                        type="button"
                        id="output-preview-search-clear"
                        class={styles["output-card__search-clear"]}
                        aria-label={t("outputCard.search.clear")}
                        data-i18n-aria-label="outputCard.search.clear"
                        onClick={handleSearchClear}
                    >
                        ×
                    </button>
                </Show>
            </div>
            <div
                id="output-preview"
                class={styles["output-preview"]}
                role="region"
                aria-label={t("output.previewAria")}
                data-i18n-aria-label="output.previewAria"
                aria-busy={appStore.isProcessing() && outputStore.itemCount() === 0}
            >
                <Show
                    when={!(appStore.isProcessing() && outputStore.itemCount() === 0)}
                    fallback={<pre>{t("common.loading")}</pre>}
                >
                    <Show
                        when={allItems().length > 0}
                        fallback={<pre>{outputStore.previewText()}</pre>}
                    >
                        <Show
                            when={filteredItems().length > 0}
                            fallback={<pre>{t("outputCard.search.noMatches")}</pre>}
                        >
                            <For each={paginatedItems()}>
                                {(item) => <pre>{getItemDisplayText(item)}</pre>}
                            </For>
                        </Show>
                    </Show>
                </Show>
            </div>
            <Show when={totalPages() > 1}>
                <div class={styles["output-card__pagination"]}>
                    <button
                        type="button"
                        id="output-preview-pagination-prev"
                        class={styles["output-card__pagination-btn"]}
                        onClick={handlePrevPage}
                        disabled={safeCurrentPage() === 0}
                    >
                        <span aria-hidden="true">‹</span>
                    </button>
                    <span id="output-preview-pagination-info" class={styles["output-card__pagination-info"]}>
                        {safeCurrentPage() + 1} / {totalPages()}
                    </span>
                    <button
                        type="button"
                        id="output-preview-pagination-next"
                        class={styles["output-card__pagination-btn"]}
                        onClick={handleNextPage}
                        disabled={safeCurrentPage() >= totalPages() - 1}
                    >
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
            </Show>
            <div class={styles["output-card__footer"]}>
                <span
                    id="output-preview-size-estimator"
                    class={styles["output-card__size-estimator"]}
                    aria-label={t("outputCard.sizeEstimator.aria", undefined, { size: formatBytes(estimatedSize()) })}
                >
                    {formatBytes(estimatedSize())}
                </span>
            </div>
            <Show when={hasLiveStream()}>
                <div
                    ref={liveStreamRef}
                    class={`${styles["output-preview"]} ${styles["output-live-stream"]}`}
                    role="region"
                    aria-label={t("output.liveStreamAria")}
                    data-i18n-aria-label="output.liveStreamAria"
                >
                    <pre class={styles["output-live-stream__pre"]}>{liveStream()}</pre>
                </div>
            </Show>
        </div>
    )
}
