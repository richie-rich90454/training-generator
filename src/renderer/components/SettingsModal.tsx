import type { JSX } from "solid-js"
import { createSignal, For, Show, createEffect, createMemo, onCleanup } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import { showConfirm } from "../confirm.js"
import modalStyles from "./styles/Modal.module.css"
import settingsModalStyles from "./styles/SettingsModal.module.css"
import formsStyles from "./styles/Forms.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
const styles = { ...modalStyles, ...settingsModalStyles, ...formsStyles, ...buttonsStyles }

/**
 * Default values for every FullAppSettings key (plus a small number of
 * runtime-only keys like `customModelEndpoint` and `logLevel` that the
 * existing code stores on appSettings via `as never` casts). Duplicated
 * locally because settingsStore.ts is owned by another agent and is
 * read-only here. These MUST stay in sync with the defaults in
 * createSettingsStore() and resetAppSettings() in
 * src/renderer/stores/settingsStore.ts.
 */
const DEFAULT_APP_SETTINGS: Record<string, unknown> = {
    theme: "auto",
    fontSize: "medium",
    autoSave: true,
    autoCheckOllama: true,
    startMaximized: false,
    rememberWindowSize: true,
    smartSizing: true,
    maxFileSize: 100,
    maxOutputItems: 100000,
    maxChunks: 500,
    maxParallelFiles: 1,
    enableThinking: false,
    outputFileMode: "combined",
    outputFilenameTemplate: "{source}",
    confirmBeforeExport: false,
    autoExportOnCompletion: false,
    maxItemsPerFile: 50000,
    stripPiiBeforeExport: false,
    includeSourceMetadata: false,
    fontScale: 100,
    compactMode: false,
    reducedMotion: false,
    highContrast: false,
    customCssPath: "",
    verboseDashboard: false,
    disableTelemetry: false,
    disableCrashReports: false,
    disableAutoUpdate: false,
    updateCheckIntervalHours: 24,
    gpuAcceleration: true,
    sendToTrayOnClose: false,
    startOnLogin: false,
    cacheDir: "",
    cacheMaxSizeMB: 500,
    cacheTtlSeconds: 86400,
    clearCacheOnExit: false,
    retryCount: 3,
    retryBackoffStrategy: "exponential",
    requestTimeoutMs: 60000,
    streamTimeoutMs: 600000,
    abortOnError: false,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    seed: -1,
    systemPromptOverride: "",
    stopSequences: [],
    bannedPhrases: [],
    requiredPhrases: [],
    minChunkLength: 200,
    maxChunkLength: 8000,
    chunkOverlap: 100,
    sentenceAwareChunking: true,
    preserveCodeBlocks: true,
    languageDetection: false,
    outputLanguageOverride: "",
    skipDedup: false,
    dedupSimilarityThreshold: 0.92,
    minQaPairsPerFile: 1,
    maxQaPairsPerFile: 1000,
    validationStrictness: "normal",
    autoRegenerateOnLowQuality: false,
    regenerateThreshold: 0.6,
    maxRegenerationAttempts: 2,
    logToFile: false,
    logFilePath: "",
    // Runtime-only keys (not declared on FullAppSettings interface but used
    // by the existing SettingsModal fields via `as never` casts):
    customModelEndpoint: "",
    logLevel: "info"
}

/**
 * Map of sectionId -> list of appSettings keys that belong to that section.
 * Used by the per-section reset button to restore only that section's
 * settings to their defaults via settingsStore.setAppSetting.
 *
 * The values are typed as `string` rather than `keyof FullAppSettings` because
 * a small number of keys (e.g. `customModelEndpoint`, `logLevel`) are stored
 * on appSettings at runtime via `as never` casts but are not declared on the
 * FullAppSettings interface (which is owned by another agent). The reset
 * helper below also casts via `as never` for the same reason.
 */
const SECTION_KEYS: Record<string, string[]> = {
    appearance: ["theme", "fontSize", "fontScale", "density", "compactMode", "reducedMotion", "highContrast", "customCssPath"],
    profiles: [],
    processing: ["autoSave", "autoCheckOllama", "maxFileSize", "maxOutputItems", "maxChunks", "maxParallelFiles", "minChunkLength", "maxChunkLength", "chunkOverlap", "sentenceAwareChunking", "preserveCodeBlocks", "languageDetection"],
    window: ["startMaximized", "rememberWindowSize"],
    outputMode: ["outputFileMode", "outputFilenameTemplate", "maxItemsPerFile", "includeSourceMetadata", "stripPiiBeforeExport"],
    export: ["confirmBeforeExport", "autoExportOnCompletion"],
    generation: ["retryCount", "retryBackoffStrategy", "requestTimeoutMs", "streamTimeoutMs", "abortOnError", "topP", "topK", "repeatPenalty", "seed", "systemPromptOverride", "stopSequences", "bannedPhrases", "requiredPhrases", "enableThinking"],
    validation: ["validationStrictness", "skipDedup", "dedupSimilarityThreshold", "autoRegenerateOnLowQuality", "regenerateThreshold", "maxRegenerationAttempts", "minQaPairsPerFile", "maxQaPairsPerFile"],
    providers: ["customModelEndpoint"],
    telemetry: ["disableTelemetry", "disableCrashReports", "disableAutoUpdate", "updateCheckIntervalHours"],
    advanced: ["gpuAcceleration", "sendToTrayOnClose", "startOnLogin", "cacheDir", "cacheMaxSizeMB", "cacheTtlSeconds", "clearCacheOnExit", "logToFile", "logFilePath", "logLevel", "verboseDashboard"],
    experimental: ["outputLanguageOverride"]
}

/**
 * Numeric ranges used for inline validation of numeric inputs. The min/max
 * here MUST match the min/max attributes set on the <input type="number">
 * elements below as well as the clamp() ranges in settingsStore.
 */
const NUMERIC_RANGES: Record<string, { min: number, max: number }> = {
    fontScale: { min: 50, max: 200 },
    maxFileSize: { min: 10, max: 1000 },
    minChunkLength: { min: 50, max: 10000 },
    maxChunkLength: { min: 500, max: 100000 },
    chunkOverlap: { min: 0, max: 1000 },
    chunkSize: { min: 500, max: 10000 },
    concurrency: { min: 1, max: 10 },
    maxItemsPerFile: { min: 100, max: 1000000 },
    temperature: { min: 0, max: 2 },
    topP: { min: 0, max: 1 },
    topK: { min: 1, max: 1000 },
    repeatPenalty: { min: 0.5, max: 2 },
    seed: { min: -1, max: 2147483647 },
    retryCount: { min: 0, max: 10 },
    requestTimeoutMs: { min: 1000, max: 600000 },
    streamTimeoutMs: { min: 1000, max: 3600000 },
    dedupSimilarityThreshold: { min: 0.5, max: 1 },
    qualityThreshold: { min: 0, max: 1 },
    regenerateThreshold: { min: 0, max: 1 },
    maxRegenerationAttempts: { min: 0, max: 10 },
    minQaPairsPerFile: { min: 1, max: 10000 },
    maxQaPairsPerFile: { min: 1, max: 100000 },
    refinementPasses: { min: 0, max: 10 },
    ollamaPort: { min: 1, max: 65535 },
    updateCheckIntervalHours: { min: 1, max: 720 },
    retentionDays: { min: 1, max: 3650 },
    cacheMaxSizeMB: { min: 10, max: 10000 },
    cacheTtlSeconds: { min: 60, max: 604800 }
}

/**
 * Info-icon tooltip rendered next to a setting's label. The tooltip is shown
 * on hover (CSS) AND on keyboard focus (the icon is focusable). Implements
 * both a native `title` attribute and a custom CSS tooltip with role="tooltip"
 * linked via aria-describedby, satisfying the v2.0.1 a11y requirements.
 *
 * The tooltip text is read from
 *   settings.<section>.<field>.tooltip
 * falling back to an empty string when the key is missing so unlabeled fields
 * simply render no tooltip bubble instead of showing a raw key.
 */
function SettingTooltip(props: { section: string, field: string }): JSX.Element {
    const tooltipKey = `settings.${props.section}.${props.field}.tooltip`
    const tooltipId = `tooltip-${props.section}-${props.field}`
    const tooltipText = t(tooltipKey)
    const ariaLabel = t("settings.tooltip.ariaLabel")
    return (
        <span class={styles["settings-tooltip"]}>
            <span
                class={styles["settings-tooltip__icon"]}
                tabindex="0"
                role="img"
                aria-label={ariaLabel}
                aria-describedby={tooltipId}
                title={tooltipText}
            >
                <Icon html={renderIcon("fa-info-circle")} />
            </span>
            <span
                id={tooltipId}
                class={styles["settings-tooltip__bubble"]}
                role="tooltip"
            >
                {tooltipText}
            </span>
        </span>
    )
}

/**
 * Inline validation error shown below a numeric input. Renders nothing when
 * the error message is empty so callers can always include it. The optional
 * id is used by the parent input's aria-describedby.
 */
function NumericError(props: { error: string, id?: string }): JSX.Element {
    return (
        <Show when={props.error.length > 0}>
            <p id={props.id} class={styles["settings-field__error"]} role="alert">
                {props.error}
            </p>
        </Show>
    )
}

export interface SettingsModalProps {
    appStore: AppStore
}
const THEMES = ["auto", "light", "dark"]
const FONT_SIZES = ["small", "medium", "large"]
const UI_LANGUAGES = ["en", "zh-Hans", "zh-Hant", "es", "fr", "de", "ja", "ko"]
const MAX_OUTPUT_ITEMS = [10000, 50000, 100000, 500000, 1000000]
const MAX_CHUNKS = [100, 200, 500, 1000, 5000]
const MAX_PARALLEL_FILES = [1, 2, 3, 4, 5, 8, 10]
interface SectionDef {
    id: string
    icon: string
}
const SECTIONS: SectionDef[] = [
    { id: "appearance", icon: "fa-palette" },
    { id: "profiles", icon: "fa-layer-group" },
    { id: "processing", icon: "fa-cogs" },
    { id: "window", icon: "fa-window-restore" },
    { id: "outputMode", icon: "fa-file-export" },
    { id: "export", icon: "fa-download" },
    { id: "generation", icon: "fa-brain" },
    { id: "validation", icon: "fa-check-circle" },
    { id: "providers", icon: "fa-server" },
    { id: "telemetry", icon: "fa-eye" },
    { id: "advanced", icon: "fa-sliders-h" },
    { id: "experimental", icon: "fa-magic" }
]
export function SettingsModal(props: SettingsModalProps): JSX.Element {
    const { settingsStore, hideSettings, savePreset } = props.appStore
    const [profileName, setProfileName] = createSignal("")
    const [activeSection, setActiveSection] = createSignal<string>("appearance")
    const [searchQuery, setSearchQuery] = createSignal<string>("")
    // Map of numeric setting key -> current validation error message (empty = valid).
    const [numericErrors, setNumericErrors] = createSignal<Record<string, string>>({})
    let overlayRef: HTMLDivElement | undefined
    let firstFocusable: HTMLElement | undefined
    let lastFocusable: HTMLElement | undefined
    let lastFocusedElement: HTMLElement | null = null
    let prevBodyOverflow: string = ""
    createEffect(() => {
        if (props.appStore.uiStore.settingsOpen()) {
            settingsStore.refreshProfiles()
            // Save the previously focused element so we can restore focus
            // back to it when the modal closes. This is critical for screen
            // reader and keyboard users who activated the modal from a button
            // (e.g. TitleBar settings button).
            lastFocusedElement = document.activeElement as HTMLElement
            // Lock body scroll while the modal is open to prevent the
            // background from scrolling behind the overlay.
            prevBodyOverflow = document.body.style.overflow
            document.body.style.overflow = "hidden"
            const focusable = overlayRef?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            )
            if (focusable && focusable.length > 0) {
                const visible = Array.from(focusable).filter((el) => !el.closest('[data-hidden="true"]'))
                const list = visible.length > 0 ? visible : Array.from(focusable)
                firstFocusable = list[0]
                lastFocusable = list[list.length - 1]
                firstFocusable.focus()
            }
        }
        else {
            firstFocusable = undefined
            lastFocusable = undefined
            // Restore body scroll only if we were the one who hid it.
            if (prevBodyOverflow !== "") {
                document.body.style.overflow = prevBodyOverflow
                prevBodyOverflow = ""
            }
            // Restore focus to the element that had focus before the modal
            // opened, but only if it is still in the DOM.
            if (lastFocusedElement && document.contains(lastFocusedElement)) {
                lastFocusedElement.focus()
                lastFocusedElement = null
            }
        }
    })
    // If the component is unmounted while the modal is still open (e.g.
    // because the whole tree is torn down), make sure we restore body
    // overflow and focus. Without this the page would be stuck with
    // overflow:hidden and no focused element.
    onCleanup(() => {
        if (prevBodyOverflow !== "") {
            document.body.style.overflow = prevBodyOverflow
            prevBodyOverflow = ""
        }
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus()
            lastFocusedElement = null
        }
    })

    /**
     * Re-apply field-level visibility whenever the search query changes. When
     * searching, fields whose translated label does not include the query (and
     * whose section title does not include the query) get a
     * `data-search-hidden="true"` attribute that the CSS hides via
     * `[data-search-hidden="true"]{display:none !important}`. When the search
     * box is empty the attribute is removed from every field so the modal
     * returns to its standard single-section view.
     */
    createEffect(() => {
        // Subscribe to searchQuery so the effect re-runs on each keystroke.
        const query = searchQuery().trim().toLowerCase()
        const panels = overlayRef?.querySelectorAll<HTMLElement>("[data-section-id]") ?? []
        for (const panel of Array.from(panels)) {
            const sectionId = panel.dataset.sectionId || ""
            const sectionLabel = t(`settings.sections.${sectionId}`).toLowerCase()
            const sectionTitleMatches = query.length === 0 || sectionLabel.includes(query)
            const fields = panel.querySelectorAll<HTMLElement>("[data-field-label]")
            for (const field of Array.from(fields)) {
                const labelText = (field.textContent || "").trim().toLowerCase()
                const fieldKey = (field.dataset.fieldLabel || "").toLowerCase()
                const matches = query.length === 0
                    || sectionTitleMatches
                    || labelText.includes(query)
                    || fieldKey.includes(query)
                if (matches) {
                    field.removeAttribute("data-search-hidden")
                    // Also un-hide the enclosing .settings-field wrapper so the
                    // entire row (label + control) is shown.
                    field.closest<HTMLElement>(".settings-field")?.removeAttribute("data-search-hidden")
                }
                else {
                    field.setAttribute("data-search-hidden", "true")
                    field.closest<HTMLElement>(".settings-field")?.setAttribute("data-search-hidden", "true")
                }
            }
        }
    })

    /** Whether the user is currently searching (search box non-empty). */
    const isSearching = createMemo(() => searchQuery().trim().length > 0)

    /** Number of sections currently visible given the search query. */
    const visibleSectionCount = createMemo(() => {
        let count = 0
        for (const section of SECTIONS) {
            if (isSectionVisible(section.id)) count++
        }
        return count
    })

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            // If the user is searching, clear the search first instead of
            // closing the modal — this matches platform search-box behavior.
            if (isSearching()) {
                e.preventDefault()
                setSearchQuery("")
                return
            }
            e.preventDefault()
            hideSettings()
            return
        }
        if (e.key !== "Tab" || !firstFocusable || !lastFocusable) {
            return
        }
        if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault()
            lastFocusable.focus()
        }
        else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault()
            firstFocusable.focus()
        }
    }
    function handleOverlayClick(e: MouseEvent): void {
        if (e.target === overlayRef) {
            hideSettings()
        }
    }
    function handleReset(): void {
        settingsStore.resetAppSettings()
    }
    /**
     * Reset only the settings keys that belong to the given section to their
     * default values. Each key is applied via settingsStore.setAppSetting so
     * the existing reactivity / persistence path is reused. A confirmation
     * dialog is shown first; if the user cancels, no keys are touched.
     */
    async function handleResetSection(sectionId: string): Promise<void> {
        const keys = SECTION_KEYS[sectionId]
        if (!keys || keys.length === 0) return
        const sectionLabel = t(`settings.sections.${sectionId}`)
        const confirmed = await showConfirm(
            t("settings.resetSection.confirm", undefined, { section: sectionLabel }),
            t("settings.resetSection")
        )
        if (!confirmed) return
        for (const key of keys) {
            const defaultValue = DEFAULT_APP_SETTINGS[key]
            // setAppSetting is keyed by FullAppSettings[K]; the loose cast
            // below keeps TypeScript happy while preserving runtime behavior
            // for keys (e.g. logLevel, customModelEndpoint) that are not on
            // the FullAppSettings interface.
            settingsStore.setAppSetting(key as never, defaultValue as never)
        }
        settingsStore.saveAppSettings()
    }
    /**
     * Reset every FullAppSettings key to its default value. Delegates to
     * settingsStore.resetAppSettings() after showing a confirmation dialog.
     */
    async function handleResetAll(): Promise<void> {
        const confirmed = await showConfirm(t("settings.resetAll.confirm"), t("settings.resetAll"))
        if (!confirmed) return
        settingsStore.resetAppSettings()
    }
    /**
     * Validate a numeric input. Returns an error message string (empty if
     * valid) and updates the numericErrors signal map. The message is also
     * surfaced to the caller so it can wire aria-invalid / aria-describedby.
     */
    function validateNumeric(key: string, raw: string): string {
        const range = NUMERIC_RANGES[key]
        if (!range) return ""
        const trimmed = (raw ?? "").trim()
        if (trimmed.length === 0) {
            const msg = t("settings.validation.required")
            setNumericErrors((prev) => ({ ...prev, [key]: msg }))
            return msg
        }
        const n = Number(trimmed)
        if (!Number.isFinite(n)) {
            const msg = t("settings.validation.required")
            setNumericErrors((prev) => ({ ...prev, [key]: msg }))
            return msg
        }
        if (n < range.min) {
            const msg = t("settings.validation.rangeUnder", undefined, { min: String(range.min) })
            setNumericErrors((prev) => ({ ...prev, [key]: msg }))
            return msg
        }
        if (n > range.max) {
            const msg = t("settings.validation.rangeOver", undefined, { max: String(range.max) })
            setNumericErrors((prev) => ({ ...prev, [key]: msg }))
            return msg
        }
        setNumericErrors((prev) => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
        return ""
    }
    function handleSave(): void {
        settingsStore.saveAppSettings()
        savePreset()
        hideSettings()
    }
    async function handleProfileSelect(e: Event): Promise<void> {
        const target = e.target as HTMLSelectElement
        if (target.value) {
            await settingsStore.applyProfile(target.value)
        }
    }
    async function handleSaveProfile(): Promise<void> {
        const name = profileName().trim()
        if (!name) {
            return
        }
        await settingsStore.saveCurrentProfile(name)
        setProfileName("")
    }
    async function handleDeleteProfile(): Promise<void> {
        await settingsStore.deleteCurrentProfile()
    }
    async function handleBrowseCustomCss(): Promise<void> {
        const api = (window as unknown as { electronAPI?: { openFileDialog?: () => Promise<Array<{ path: string }> | null> } }).electronAPI
        if (!api?.openFileDialog) return
        try {
            const result = await api.openFileDialog()
            if (result && result.length > 0 && result[0].path) {
                settingsStore.setAppSetting("customCssPath", result[0].path)
            }
        }
        catch {
            // File dialog may be unavailable in non-Electron environments; ignore.
        }
    }
    async function handleBrowseExportPath(): Promise<void> {
        const api = (window as unknown as { electronAPI?: { chooseDirectory?: (defaultPath?: string) => Promise<string | null> } }).electronAPI
        if (!api?.chooseDirectory) return
        try {
            const dirPath = await api.chooseDirectory()
            if (dirPath) {
                settingsStore.setAppSetting("exportPath" as never, dirPath as never)
            }
        }
        catch {
            // Directory dialog may be unavailable in non-Electron environments; ignore.
        }
    }
    function handleNavKeydown(e: KeyboardEvent): void {
        const buttons = Array.from(overlayRef?.querySelectorAll<HTMLButtonElement>('button[data-section-nav="true"]') ?? [])
        if (buttons.length === 0) return
        const currentIndex = buttons.findIndex((b) => b === document.activeElement)
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault()
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length
            buttons[nextIndex].focus()
            setActiveSection(buttons[nextIndex].dataset.section || "appearance")
        }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault()
            const prevIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1
            buttons[prevIndex].focus()
            setActiveSection(buttons[prevIndex].dataset.section || "appearance")
        }
        else if (e.key === "Home") {
            e.preventDefault()
            buttons[0].focus()
            setActiveSection(buttons[0].dataset.section || "appearance")
        }
        else if (e.key === "End") {
            e.preventDefault()
            buttons[buttons.length - 1].focus()
            setActiveSection(buttons[buttons.length - 1].dataset.section || "appearance")
        }
    }
    function isSectionVisible(sectionId: string): boolean {
        const query = searchQuery().trim().toLowerCase()
        if (query.length === 0) {
            return activeSection() === sectionId
        }
        const sectionLabel = t(`settings.sections.${sectionId}`).toLowerCase()
        if (sectionLabel.includes(query)) return true
        const panel = overlayRef?.querySelector(`[data-section-id="${sectionId}"]`)
        if (panel) {
            const labels = Array.from(panel.querySelectorAll<HTMLElement>("[data-field-label]"))
            for (const label of labels) {
                // Match against either the field key (data-field-label) or the
                // translated label text visible to the user (textContent).
                const fieldKey = (label.dataset.fieldLabel || "").toLowerCase()
                const labelText = (label.textContent || "").trim().toLowerCase()
                if (fieldKey.includes(query) || labelText.includes(query)) return true
            }
        }
        return false
    }
    function sectionClass(sectionId: string): string {
        return isSectionVisible(sectionId) ? styles["settings-section"] : `${styles["settings-section"]} ${styles["settings-section--hidden"]}`
    }
    return (
        <Show when={props.appStore.uiStore.settingsOpen()}>
            <div
                ref={overlayRef}
                class={`${styles["modal"]} ${styles["active"]}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-modal-title"
                aria-label={t("settings.modalAria")}
                data-i18n-aria-label="settings.modalAria"
                onClick={handleOverlayClick}
                onKeyDown={handleKeydown}
            >
                <div class={`${styles["modal-content"]} ${styles["settings-modal-content"]}`}>
                    <div class={styles["modal-header"]}>
                        <h2 id="settings-modal-title">
                            <Icon html={renderIcon("fa-cog")} />
                            <span data-i18n="settings.title">{t("settings.title")}</span>
                        </h2>
                        <button
                            class={styles["modal-close"]}
                            aria-label={t("settings.closeAria")}
                            data-i18n-aria-label="settings.closeAria"
                            onClick={hideSettings}
                        >
                            <Icon html={renderIcon("fa-times")} />
                        </button>
                    </div>
                    <div class={styles["settings-search"]}>
                        <span class={styles["settings-search__icon"]} aria-hidden="true">
                            <Icon html={renderIcon("fa-search")} />
                        </span>
                        <input
                            id="settings-search-input"
                            class={styles["settings-search__input"]}
                            type="search"
                            value={searchQuery()}
                            placeholder={t("settings.search.placeholder")}
                            data-i18n-placeholder="settings.search.placeholder"
                            aria-label={t("settings.search.ariaLabel")}
                            data-i18n-aria-label="settings.search.ariaLabel"
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        />
                        <Show when={isSearching()}>
                            <button
                                type="button"
                                class={styles["settings-search__clear"]}
                                aria-label={t("settings.search.clearAria")}
                                data-i18n-aria-label="settings.search.clearAria"
                                onClick={() => setSearchQuery("")}
                            >
                                <Icon html={renderIcon("fa-times")} />
                            </button>
                        </Show>
                        <Show when={isSearching()}>
                            <span class={styles["settings-search__count"]} aria-live="polite">
                                {t("settings.search.resultsCount", undefined, { count: String(visibleSectionCount()) })}
                            </span>
                        </Show>
                    </div>
                    <Show when={isSearching() && visibleSectionCount() === 0}>
                        <p class={styles["settings-search__no-results"]} role="status">
                            {t("settings.search.noResults")}
                        </p>
                    </Show>
                    <div class={styles["modal-body"]}>
                        <div class={styles["settings-layout"]}>
                            <nav
                                class={styles["settings-nav"]}
                                aria-label={t("settings.navAria")}
                                data-i18n-aria-label="settings.navAria"
                                onKeyDown={handleNavKeydown}
                                classList={{ [styles["settings-nav--searching"]]: isSearching() }}
                            >
                                <For each={SECTIONS}>
                                    {(section) => (
                                        <Show when={!isSearching() || isSectionVisible(section.id)}>
                                            <button
                                                type="button"
                                                class={styles["settings-nav__button"]}
                                                data-section-nav="true"
                                                data-section={section.id}
                                                aria-selected={activeSection() === section.id}
                                                aria-controls={`settings-panel-${section.id}`}
                                                id={`settings-tab-${section.id}`}
                                                tabIndex={activeSection() === section.id ? 0 : -1}
                                                onClick={() => setActiveSection(section.id)}
                                            >
                                                <Icon html={renderIcon(section.icon)} />
                                                <span data-i18n={`settings.sections.${section.id}`}>{t(`settings.sections.${section.id}`)}</span>
                                            </button>
                                        </Show>
                                    )}
                                </For>
                            </nav>
                            <div class={styles["settings-content"]}>
                                <section
                                    class={sectionClass("appearance")}
                                    data-section-id="appearance"
                                    id="settings-panel-appearance"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-appearance"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-palette")} />
                                            <span data-i18n="settings.sections.appearance">{t("settings.sections.appearance")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.appearance") })}
                                                onClick={() => handleResetSection("appearance")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-theme">
                                            <Icon html={renderIcon("fa-display")} />
                                            <span data-i18n="settings.theme" data-field-label="theme">{t("settings.theme")}</span>
                                            <SettingTooltip section="appearance" field="theme" />
                                        </label>
                                        <select
                                            id="settings-theme"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.theme || "auto"}
                                            onChange={(e) => settingsStore.setTheme(e.currentTarget.value)}
                                        >
                                            <For each={THEMES}>
                                                {(theme) => (
                                                    <option value={theme} data-i18n={`settings.theme.${theme}`}>
                                                        {t(`settings.theme.${theme}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-font-size">
                                            <Icon html={renderIcon("fa-text-height")} />
                                            <span data-i18n="settings.fontSize" data-field-label="fontSize">{t("settings.fontSize")}</span>
                                            <SettingTooltip section="appearance" field="fontSize" />
                                        </label>
                                        <select
                                            id="settings-font-size"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.fontSize || "medium"}
                                            onChange={(e) => settingsStore.setFontSize(e.currentTarget.value)}
                                        >
                                            <For each={FONT_SIZES}>
                                                {(size) => (
                                                    <option value={size} data-i18n={`settings.fontSize.${size}`}>
                                                        {t(`settings.fontSize.${size}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-ui-language">
                                            <Icon html={renderIcon("fa-language")} />
                                            <span data-i18n="settings.uiLanguage" data-field-label="uiLanguage">{t("settings.uiLanguage")}</span>
                                            <SettingTooltip section="appearance" field="uiLanguage" />
                                        </label>
                                        <select
                                            id="settings-ui-language"
                                            class={styles["form-control"]}
                                            value={settingsStore.settings.language || "en"}
                                            onChange={(e) => settingsStore.applyLanguage(e.currentTarget.value)}
                                        >
                                            <For each={UI_LANGUAGES}>
                                                {(lang) => (
                                                    <option value={lang} data-i18n={`uiLanguage.${lang}`}>
                                                        {t(`uiLanguage.${lang}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-font-scale">
                                            <Icon html={renderIcon("fa-text-height")} />
                                            <span data-i18n="settings.fontScale" data-field-label="fontScale">{t("settings.fontScale")}</span>
                                            <SettingTooltip section="appearance" field="fontScale" />
                                        </label>
                                        <input
                                            id="settings-font-scale"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="200"
                                            step="10"
                                            value={settingsStore.appSettings.fontScale ?? 100}
                                            aria-invalid={numericErrors()["fontScale"] ? "true" : undefined}
                                            aria-describedby="error-fontScale"
                                            onChange={(e) => { validateNumeric("fontScale", e.currentTarget.value); settingsStore.setAppSetting("fontScale", parseInt(e.currentTarget.value, 10) || 100) }}
                                        />
                                        <NumericError error={numericErrors()["fontScale"] ?? ""} id="error-fontScale" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-density">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.density" data-field-label="density">{t("settings.density")}</span>
                                            <SettingTooltip section="appearance" field="density" />
                                        </label>
                                        <select
                                            id="settings-density"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.density || "normal"}
                                            onChange={(e) => settingsStore.setAppSetting("density", e.currentTarget.value as "compact" | "normal" | "spacious")}
                                        >
                                            <option value="compact" data-i18n="settings.density.compact">{t("settings.density.compact")}</option>
                                            <option value="normal" data-i18n="settings.density.normal">{t("settings.density.normal")}</option>
                                            <option value="spacious" data-i18n="settings.density.spacious">{t("settings.density.spacious")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-compact-mode">
                                            <input
                                                id="settings-compact-mode"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.compactMode ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("compactMode", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.compactMode" data-field-label="compactMode">{t("settings.compactMode")}</span>
                                            <SettingTooltip section="appearance" field="compactMode" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-reduced-motion">
                                            <input
                                                id="settings-reduced-motion"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.reducedMotion ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("reducedMotion", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.reducedMotion" data-field-label="reducedMotion">{t("settings.reducedMotion")}</span>
                                            <SettingTooltip section="appearance" field="reducedMotion" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-high-contrast">
                                            <input
                                                id="settings-high-contrast"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.highContrast ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("highContrast", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.highContrast" data-field-label="highContrast">{t("settings.highContrast")}</span>
                                            <SettingTooltip section="appearance" field="highContrast" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-custom-css-path">
                                            <Icon html={renderIcon("fa-file-code")} />
                                            <span data-i18n="settings.customCssPath" data-field-label="customCssPath">{t("settings.customCssPath")}</span>
                                            <SettingTooltip section="appearance" field="customCssPath" />
                                        </label>
                                        <div class={`section-actions ${styles["settings-actions--inline"]}`}>
                                            <input
                                                id="settings-custom-css-path"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={settingsStore.appSettings.customCssPath ?? ""}
                                                placeholder={t("settings.customCssPath.placeholder")}
                                                data-i18n-placeholder="settings.customCssPath.placeholder"
                                                onInput={(e) => settingsStore.setAppSetting("customCssPath", e.currentTarget.value)}
                                            />
                                            <button
                                                type="button"
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.customCssPath.browseAria")}
                                                data-i18n-aria-label="settings.customCssPath.browseAria"
                                                onClick={handleBrowseCustomCss}
                                            >
                                                <Icon html={renderIcon("fa-folder-open")} />
                                                <span data-i18n="settings.customCssPath.browse">{t("settings.customCssPath.browse")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("profiles")}
                                    data-section-id="profiles"
                                    id="settings-panel-profiles"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-profiles"
                                >
                                    <h3>
                                        <Icon html={renderIcon("fa-layer-group")} />
                                        <span data-i18n="settings.sections.profiles">{t("settings.sections.profiles")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-profile-select">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.profileSelect" data-field-label="profileSelect">{t("settings.profileSelect")}</span>
                                            <SettingTooltip section="profiles" field="profileSelect" />
                                        </label>
                                        <select
                                            id="settings-profile-select"
                                            class={styles["form-control"]}
                                            value={settingsStore.selectedProfile()}
                                            onChange={handleProfileSelect}
                                        >
                                            <option value="" data-i18n="settings.profileSelect.default">
                                                {t("settings.profileSelect.default")}
                                            </option>
                                            <For each={settingsStore.profiles}>
                                                {(profile) => <option value={profile.name}>{profile.name}</option>}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-profile-name">
                                            <Icon html={renderIcon("fa-save")} />
                                            <span data-i18n="settings.saveProfile" data-field-label="saveProfile">{t("settings.saveProfile")}</span>
                                            <SettingTooltip section="profiles" field="saveProfile" />
                                        </label>
                                        <div class={`section-actions ${styles["settings-actions--inline"]}`}>
                                            <input
                                                id="settings-profile-name"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={profileName()}
                                                placeholder={t("promptEditor.versionNamePlaceholder")}
                                                data-i18n-placeholder="promptEditor.versionNamePlaceholder"
                                                onInput={(e) => setProfileName(e.currentTarget.value)}
                                            />
                                            <button
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.saveProfileAria")}
                                                data-i18n-aria-label="settings.saveProfileAria"
                                                onClick={handleSaveProfile}
                                                disabled={!profileName().trim()}
                                            >
                                                <Icon html={renderIcon("fa-save")} />
                                                <span data-i18n="settings.saveProfile">{t("settings.saveProfile")}</span>
                                            </button>
                                            <button
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.deleteProfileAria")}
                                                data-i18n-aria-label="settings.deleteProfileAria"
                                                onClick={handleDeleteProfile}
                                                disabled={!settingsStore.selectedProfile()}
                                            >
                                                <Icon html={renderIcon("fa-trash")} />
                                                <span data-i18n="settings.deleteProfile">{t("settings.deleteProfile")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("processing")}
                                    data-section-id="processing"
                                    id="settings-panel-processing"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-processing"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-cogs")} />
                                            <span data-i18n="settings.sections.processing">{t("settings.sections.processing")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.processing") })}
                                                onClick={() => handleResetSection("processing")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-auto-save">
                                            <input
                                                id="settings-auto-save"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.autoSave}
                                                onChange={(e) => settingsStore.setAutoSave(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.autoSave" data-field-label="autoSave">{t("settings.autoSave")}</span>
                                            <SettingTooltip section="processing" field="autoSave" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-auto-check">
                                            <input
                                                id="settings-auto-check"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.autoCheckOllama}
                                                onChange={(e) => settingsStore.setAutoCheckOllama(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.autoCheckOllama" data-field-label="autoCheckOllama">{t("settings.autoCheckOllama")}</span>
                                            <SettingTooltip section="processing" field="autoCheckOllama" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-file-size">
                                            <Icon html={renderIcon("fa-hdd")} />
                                            <span data-i18n="settings.maxFileSize" data-field-label="maxFileSize">{t("settings.maxFileSize")}</span>
                                            <SettingTooltip section="processing" field="maxFileSize" />
                                        </label>
                                        <input
                                            id="settings-max-file-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="10"
                                            max="1000"
                                            value={settingsStore.appSettings.maxFileSize}
                                            aria-invalid={numericErrors()["maxFileSize"] ? "true" : undefined}
                                            aria-describedby="error-maxFileSize"
                                            onChange={(e) => { validateNumeric("maxFileSize", e.currentTarget.value); settingsStore.setMaxFileSize(parseInt(e.currentTarget.value, 10)) }}
                                        />
                                        <NumericError error={numericErrors()["maxFileSize"] ?? ""} id="error-maxFileSize" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-output-items">
                                            <Icon html={renderIcon("fa-database")} />
                                            <span data-i18n="settings.maxOutputItems" data-field-label="maxOutputItems">{t("settings.maxOutputItems")}</span>
                                            <SettingTooltip section="processing" field="maxOutputItems" />
                                        </label>
                                        <select
                                            id="settings-max-output-items"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.maxOutputItems}
                                            onChange={(e) => settingsStore.setMaxOutputItems(parseInt(e.currentTarget.value, 10))}
                                        >
                                            <For each={MAX_OUTPUT_ITEMS}>
                                                {(n) => (
                                                    <option value={n} data-i18n={`settings.maxOutputItems.${n}`}>
                                                        {t(`settings.maxOutputItems.${n}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-chunks">
                                            <Icon html={renderIcon("fa-cut")} />
                                            <span data-i18n="settings.maxChunks" data-field-label="maxChunks">{t("settings.maxChunks")}</span>
                                            <SettingTooltip section="processing" field="maxChunks" />
                                        </label>
                                        <select
                                            id="settings-max-chunks"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.maxChunks}
                                            onChange={(e) => settingsStore.setMaxChunks(parseInt(e.currentTarget.value, 10))}
                                        >
                                            <For each={MAX_CHUNKS}>
                                                {(n) => (
                                                    <option value={n} data-i18n={`settings.maxChunks.${n}`}>
                                                        {t(`settings.maxChunks.${n}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-parallel">
                                            <Icon html={renderIcon("fa-bolt")} />
                                            <span data-i18n="settings.maxParallelFiles" data-field-label="maxParallelFiles">{t("settings.maxParallelFiles")}</span>
                                            <SettingTooltip section="processing" field="maxParallelFiles" />
                                        </label>
                                        <select
                                            id="settings-max-parallel"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.maxParallelFiles}
                                            onChange={(e) => settingsStore.setMaxParallelFiles(parseInt(e.currentTarget.value, 10))}
                                        >
                                            <For each={MAX_PARALLEL_FILES}>
                                                {(n) => (
                                                    <option value={n} data-i18n={n === 1 ? "settings.maxParallelFiles.sequential" : `settings.maxParallelFiles.${n}`}>
                                                        {n === 1 ? t("settings.maxParallelFiles.sequential") : t(`settings.maxParallelFiles.${n}`)}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-chunk-size">
                                            <Icon html={renderIcon("fa-cut")} />
                                            <span data-i18n="settings.chunkSize" data-field-label="chunkSize">{t("settings.chunkSize")}</span>
                                            <SettingTooltip section="processing" field="chunkSize" />
                                        </label>
                                        <input
                                            id="settings-chunk-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="500"
                                            max="10000"
                                            step="100"
                                            value={settingsStore.settings.chunkSize}
                                            aria-invalid={numericErrors()["chunkSize"] ? "true" : undefined}
                                            aria-describedby="error-chunkSize"
                                            onChange={(e) => { validateNumeric("chunkSize", e.currentTarget.value); settingsStore.setChunkSize(parseInt(e.currentTarget.value, 10)) }}
                                        />
                                        <NumericError error={numericErrors()["chunkSize"] ?? ""} id="error-chunkSize" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-concurrency">
                                            <Icon html={renderIcon("fa-bolt")} />
                                            <span data-i18n="settings.concurrency" data-field-label="concurrency">{t("settings.concurrency")}</span>
                                            <SettingTooltip section="processing" field="concurrency" />
                                        </label>
                                        <input
                                            id="settings-concurrency"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="10"
                                            step="1"
                                            value={settingsStore.settings.concurrency}
                                            aria-invalid={numericErrors()["concurrency"] ? "true" : undefined}
                                            aria-describedby="error-concurrency"
                                            onChange={(e) => { validateNumeric("concurrency", e.currentTarget.value); settingsStore.setConcurrency(parseInt(e.currentTarget.value, 10)) }}
                                        />
                                        <NumericError error={numericErrors()["concurrency"] ?? ""} id="error-concurrency" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-min-chunk-length">
                                            <Icon html={renderIcon("fa-cut")} />
                                            <span data-i18n="settings.minChunkLength" data-field-label="minChunkLength">{t("settings.minChunkLength")}</span>
                                            <SettingTooltip section="processing" field="minChunkLength" />
                                        </label>
                                        <input
                                            id="settings-min-chunk-length"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="2000"
                                            step="50"
                                            value={settingsStore.appSettings.minChunkLength ?? 200}
                                            aria-invalid={numericErrors()["minChunkLength"] ? "true" : undefined}
                                            aria-describedby="error-minChunkLength"
                                            onChange={(e) => { validateNumeric("minChunkLength", e.currentTarget.value); settingsStore.setAppSetting("minChunkLength", parseInt(e.currentTarget.value, 10) || 200) }}
                                        />
                                        <NumericError error={numericErrors()["minChunkLength"] ?? ""} id="error-minChunkLength" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-chunk-length">
                                            <Icon html={renderIcon("fa-expand")} />
                                            <span data-i18n="settings.maxChunkLength" data-field-label="maxChunkLength">{t("settings.maxChunkLength")}</span>
                                            <SettingTooltip section="processing" field="maxChunkLength" />
                                        </label>
                                        <input
                                            id="settings-max-chunk-length"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="32000"
                                            step="500"
                                            value={settingsStore.appSettings.maxChunkLength ?? 8000}
                                            aria-invalid={numericErrors()["maxChunkLength"] ? "true" : undefined}
                                            aria-describedby="error-maxChunkLength"
                                            onChange={(e) => { validateNumeric("maxChunkLength", e.currentTarget.value); settingsStore.setAppSetting("maxChunkLength", parseInt(e.currentTarget.value, 10) || 8000) }}
                                        />
                                        <NumericError error={numericErrors()["maxChunkLength"] ?? ""} id="error-maxChunkLength" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-chunk-overlap">
                                            <Icon html={renderIcon("fa-layer-group")} />
                                            <span data-i18n="settings.chunkOverlap" data-field-label="chunkOverlap">{t("settings.chunkOverlap")}</span>
                                            <SettingTooltip section="processing" field="chunkOverlap" />
                                        </label>
                                        <input
                                            id="settings-chunk-overlap"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1000"
                                            step="10"
                                            value={settingsStore.appSettings.chunkOverlap ?? 100}
                                            aria-invalid={numericErrors()["chunkOverlap"] ? "true" : undefined}
                                            aria-describedby="error-chunkOverlap"
                                            onChange={(e) => { validateNumeric("chunkOverlap", e.currentTarget.value); settingsStore.setAppSetting("chunkOverlap", parseInt(e.currentTarget.value, 10) || 0) }}
                                        />
                                        <NumericError error={numericErrors()["chunkOverlap"] ?? ""} id="error-chunkOverlap" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-sentence-aware-chunking">
                                            <input
                                                id="settings-sentence-aware-chunking"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.sentenceAwareChunking ?? true}
                                                onChange={(e) => settingsStore.setAppSetting("sentenceAwareChunking", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.sentenceAwareChunking" data-field-label="sentenceAwareChunking">{t("settings.sentenceAwareChunking")}</span>
                                            <SettingTooltip section="processing" field="sentenceAwareChunking" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-preserve-code-blocks">
                                            <input
                                                id="settings-preserve-code-blocks"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.preserveCodeBlocks ?? true}
                                                onChange={(e) => settingsStore.setAppSetting("preserveCodeBlocks", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.preserveCodeBlocks" data-field-label="preserveCodeBlocks">{t("settings.preserveCodeBlocks")}</span>
                                            <SettingTooltip section="processing" field="preserveCodeBlocks" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-language-detection">
                                            <input
                                                id="settings-language-detection"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.languageDetection ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("languageDetection", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.languageDetection" data-field-label="languageDetection">{t("settings.languageDetection")}</span>
                                            <SettingTooltip section="processing" field="languageDetection" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-incremental">
                                            <input
                                                id="settings-incremental"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.incremental ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("incremental", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.incremental" data-field-label="incremental">{t("settings.incremental")}</span>
                                            <SettingTooltip section="processing" field="incremental" />
                                        </label>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("window")}
                                    data-section-id="window"
                                    id="settings-panel-window"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-window"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-window-restore")} />
                                            <span data-i18n="settings.sections.window">{t("settings.sections.window")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.window") })}
                                                onClick={() => handleResetSection("window")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-start-maximized">
                                            <input
                                                id="settings-start-maximized"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.startMaximized}
                                                onChange={(e) => settingsStore.setStartMaximized(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.startMaximized" data-field-label="startMaximized">{t("settings.startMaximized")}</span>
                                            <SettingTooltip section="window" field="startMaximized" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-remember-size">
                                            <input
                                                id="settings-remember-size"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.rememberWindowSize}
                                                onChange={(e) => settingsStore.setRememberWindowSize(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.rememberWindowSize" data-field-label="rememberWindowSize">{t("settings.rememberWindowSize")}</span>
                                            <SettingTooltip section="window" field="rememberWindowSize" />
                                        </label>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("outputMode")}
                                    data-section-id="outputMode"
                                    id="settings-panel-outputMode"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-outputMode"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-file-export")} />
                                            <span data-i18n="settings.sections.outputMode">{t("settings.sections.outputMode")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.outputMode") })}
                                                onClick={() => handleResetSection("outputMode")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-output-file-mode-combined">
                                            <input
                                                id="settings-output-file-mode-combined"
                                                class={styles["form-checkbox"]}
                                                type="radio"
                                                name="settings-output-file-mode"
                                                value="combined"
                                                checked={settingsStore.appSettings.outputFileMode === "combined"}
                                                onChange={() => settingsStore.setAppSetting("outputFileMode", "combined")}
                                            />
                                            <span data-i18n="settings.outputMode.combined" data-field-label="outputFileMode.combined">{t("settings.outputMode.combined")}</span>
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-output-file-mode-perFile">
                                            <input
                                                id="settings-output-file-mode-perFile"
                                                class={styles["form-checkbox"]}
                                                type="radio"
                                                name="settings-output-file-mode"
                                                value="perFile"
                                                checked={settingsStore.appSettings.outputFileMode === "perFile"}
                                                onChange={() => settingsStore.setAppSetting("outputFileMode", "perFile")}
                                            />
                                            <span data-i18n="settings.outputMode.perFile" data-field-label="outputFileMode.perFile">{t("settings.outputMode.perFile")}</span>
                                        </label>
                                    </div>
                                    <Show when={settingsStore.appSettings.outputFileMode === "perFile"}>
                                        <div class={styles["settings-field"]}>
                                            <label class={styles["settings-field__label"]} for="settings-output-filename-template">
                                                <Icon html={renderIcon("fa-file-signature")} />
                                                <span data-i18n="settings.outputFilenameTemplate" data-field-label="outputFilenameTemplate">{t("settings.outputFilenameTemplate")}</span>
                                                <SettingTooltip section="outputMode" field="outputFilenameTemplate" />
                                            </label>
                                            <input
                                                id="settings-output-filename-template"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={settingsStore.appSettings.outputFilenameTemplate ?? "{source}"}
                                                placeholder={t("config.outputFilenameTemplate.placeholder")}
                                                data-i18n-placeholder="config.outputFilenameTemplate.placeholder"
                                                onInput={(e) => settingsStore.setAppSetting("outputFilenameTemplate", e.currentTarget.value)}
                                            />
                                        </div>
                                        <div class={styles["settings-field"]}>
                                            <label class={styles["settings-field__label"]} for="settings-max-items-per-file">
                                                <Icon html={renderIcon("fa-list-ol")} />
                                                <span data-i18n="settings.maxItemsPerFile" data-field-label="maxItemsPerFile">{t("settings.maxItemsPerFile")}</span>
                                                <SettingTooltip section="outputMode" field="maxItemsPerFile" />
                                            </label>
                                            <input
                                                id="settings-max-items-per-file"
                                                class={styles["form-control"]}
                                                type="number"
                                                min="100"
                                                max="1000000"
                                                step="100"
                                                value={settingsStore.appSettings.maxItemsPerFile ?? 50000}
                                                aria-invalid={numericErrors()["maxItemsPerFile"] ? "true" : undefined}
                                                aria-describedby="error-maxItemsPerFile"
                                                onChange={(e) => { validateNumeric("maxItemsPerFile", e.currentTarget.value); settingsStore.setAppSetting("maxItemsPerFile", parseInt(e.currentTarget.value, 10) || 50000) }}
                                            />
                                            <NumericError error={numericErrors()["maxItemsPerFile"] ?? ""} id="error-maxItemsPerFile" />
                                        </div>
                                        <div class={styles["settings-field"]}>
                                            <label class={styles["settings-field__label"]} for="settings-include-source-metadata">
                                                <input
                                                    id="settings-include-source-metadata"
                                                    class={styles["form-checkbox"]}
                                                    type="checkbox"
                                                    checked={settingsStore.appSettings.includeSourceMetadata ?? false}
                                                    onChange={(e) => settingsStore.setAppSetting("includeSourceMetadata", e.currentTarget.checked)}
                                                />
                                                <span data-i18n="settings.includeSourceMetadata" data-field-label="includeSourceMetadata">{t("settings.includeSourceMetadata")}</span>
                                                <SettingTooltip section="outputMode" field="includeSourceMetadata" />
                                            </label>
                                        </div>
                                        <div class={styles["settings-field"]}>
                                            <label class={styles["settings-field__label"]} for="settings-strip-pii-before-export">
                                                <input
                                                    id="settings-strip-pii-before-export"
                                                    class={styles["form-checkbox"]}
                                                    type="checkbox"
                                                    checked={settingsStore.appSettings.stripPiiBeforeExport ?? false}
                                                    onChange={(e) => settingsStore.setAppSetting("stripPiiBeforeExport", e.currentTarget.checked)}
                                                />
                                                <span data-i18n="settings.stripPiiBeforeExport" data-field-label="stripPiiBeforeExport">{t("settings.stripPiiBeforeExport")}</span>
                                                <SettingTooltip section="outputMode" field="stripPiiBeforeExport" />
                                            </label>
                                        </div>
                                    </Show>
                                </section>
                                <section
                                    class={sectionClass("export")}
                                    data-section-id="export"
                                    id="settings-panel-export"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-export"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-download")} />
                                            <span data-i18n="settings.sections.export">{t("settings.sections.export")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.export") })}
                                                onClick={() => handleResetSection("export")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-output-format">
                                            <Icon html={renderIcon("fa-file-code")} />
                                            <span data-i18n="settings.outputFormat" data-field-label="outputFormat">{t("settings.outputFormat")}</span>
                                            <SettingTooltip section="export" field="outputFormat" />
                                        </label>
                                        <select
                                            id="settings-output-format"
                                            class={styles["form-control"]}
                                            value={settingsStore.settings.outputFormat || "jsonl"}
                                            onChange={(e) => settingsStore.setOutputFormat(e.currentTarget.value)}
                                        >
                                            <option value="jsonl" data-i18n="settings.outputFormat.jsonl">{t("settings.outputFormat.jsonl")}</option>
                                            <option value="json" data-i18n="settings.outputFormat.json">{t("settings.outputFormat.json")}</option>
                                            <option value="chatml" data-i18n="settings.outputFormat.chatml">{t("settings.outputFormat.chatml")}</option>
                                            <option value="csv" data-i18n="settings.outputFormat.csv">{t("settings.outputFormat.csv")}</option>
                                            <option value="text" data-i18n="settings.outputFormat.text">{t("settings.outputFormat.text")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-export-path">
                                            <Icon html={renderIcon("fa-folder-open")} />
                                            <span data-i18n="settings.exportPath" data-field-label="exportPath">{t("settings.exportPath")}</span>
                                            <SettingTooltip section="export" field="exportPath" />
                                        </label>
                                        <div class={`section-actions ${styles["settings-actions--inline"]}`}>
                                            <input
                                                id="settings-export-path"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={(settingsStore.appSettings as Record<string, unknown>).exportPath as string ?? ""}
                                                placeholder={t("settings.exportPath.placeholder")}
                                                data-i18n-placeholder="settings.exportPath.placeholder"
                                                onInput={(e) => settingsStore.setAppSetting("exportPath" as never, e.currentTarget.value as never)}
                                            />
                                            <button
                                                type="button"
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.exportPath.browseAria")}
                                                data-i18n-aria-label="settings.exportPath.browseAria"
                                                onClick={handleBrowseExportPath}
                                            >
                                                <Icon html={renderIcon("fa-folder-open")} />
                                                <span data-i18n="settings.exportPath.browse">{t("settings.exportPath.browse")}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-confirm-before-export">
                                            <input
                                                id="settings-confirm-before-export"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.confirmBeforeExport ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("confirmBeforeExport", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.confirmBeforeExport" data-field-label="confirmBeforeExport">{t("settings.confirmBeforeExport")}</span>
                                            <SettingTooltip section="export" field="confirmBeforeExport" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-auto-export-on-completion">
                                            <input
                                                id="settings-auto-export-on-completion"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.autoExportOnCompletion ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("autoExportOnCompletion", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.autoExportOnCompletion" data-field-label="autoExportOnCompletion">{t("settings.autoExportOnCompletion")}</span>
                                            <SettingTooltip section="export" field="autoExportOnCompletion" />
                                        </label>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("generation")}
                                    data-section-id="generation"
                                    id="settings-panel-generation"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-generation"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-brain")} />
                                            <span data-i18n="settings.sections.generation">{t("settings.sections.generation")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.generation") })}
                                                onClick={() => handleResetSection("generation")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-model">
                                            <Icon html={renderIcon("fa-brain")} />
                                            <span data-i18n="settings.model" data-field-label="model">{t("settings.model")}</span>
                                            <SettingTooltip section="generation" field="model" />
                                        </label>
                                        <input
                                            id="settings-model"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={settingsStore.settings.model || ""}
                                            placeholder={t("settings.model.placeholder")}
                                            data-i18n-placeholder="settings.model.placeholder"
                                            onInput={(e) => settingsStore.setModel(e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-provider">
                                            <Icon html={renderIcon("fa-cloud")} />
                                            <span data-i18n="settings.provider" data-field-label="provider">{t("settings.provider")}</span>
                                            <SettingTooltip section="generation" field="provider" />
                                        </label>
                                        <select
                                            id="settings-provider"
                                            class={styles["form-control"]}
                                            value={settingsStore.settings.provider || "ollama"}
                                            onChange={(e) => settingsStore.setProvider(e.currentTarget.value)}
                                        >
                                            <option value="ollama" data-i18n="settings.provider.ollama">{t("settings.provider.ollama")}</option>
                                            <option value="openai" data-i18n="settings.provider.openai">{t("settings.provider.openai")}</option>
                                            <option value="anthropic" data-i18n="settings.provider.anthropic">{t("settings.provider.anthropic")}</option>
                                            <option value="gemini" data-i18n="settings.provider.gemini">{t("settings.provider.gemini")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-temperature">
                                            <Icon html={renderIcon("fa-thermometer-half")} />
                                            <span data-i18n="settings.temperature" data-field-label="temperature">{t("settings.temperature")}</span>
                                            <SettingTooltip section="generation" field="temperature" />
                                        </label>
                                        <input
                                            id="settings-temperature"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={settingsStore.settings.temperature}
                                            aria-invalid={numericErrors()["temperature"] ? "true" : undefined}
                                            aria-describedby="error-temperature"
                                            onChange={(e) => { validateNumeric("temperature", e.currentTarget.value); settingsStore.setTemperature(parseFloat(e.currentTarget.value) || 0) }}
                                        />
                                        <NumericError error={numericErrors()["temperature"] ?? ""} id="error-temperature" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-top-p">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.topP" data-field-label="topP">{t("settings.topP")}</span>
                                            <SettingTooltip section="generation" field="topP" />
                                        </label>
                                        <input
                                            id="settings-top-p"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.topP ?? 0.9}
                                            aria-invalid={numericErrors()["topP"] ? "true" : undefined}
                                            aria-describedby="error-topP"
                                            onChange={(e) => { validateNumeric("topP", e.currentTarget.value); settingsStore.setAppSetting("topP", parseFloat(e.currentTarget.value) || 0.9) }}
                                        />
                                        <NumericError error={numericErrors()["topP"] ?? ""} id="error-topP" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-top-k">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.topK" data-field-label="topK">{t("settings.topK")}</span>
                                            <SettingTooltip section="generation" field="topK" />
                                        </label>
                                        <input
                                            id="settings-top-k"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="1000"
                                            step="1"
                                            value={settingsStore.appSettings.topK ?? 40}
                                            aria-invalid={numericErrors()["topK"] ? "true" : undefined}
                                            aria-describedby="error-topK"
                                            onChange={(e) => { validateNumeric("topK", e.currentTarget.value); settingsStore.setAppSetting("topK", parseInt(e.currentTarget.value, 10) || 40) }}
                                        />
                                        <NumericError error={numericErrors()["topK"] ?? ""} id="error-topK" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-repeat-penalty">
                                            <Icon html={renderIcon("fa-sync-alt")} />
                                            <span data-i18n="settings.repeatPenalty" data-field-label="repeatPenalty">{t("settings.repeatPenalty")}</span>
                                            <SettingTooltip section="generation" field="repeatPenalty" />
                                        </label>
                                        <input
                                            id="settings-repeat-penalty"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0.5"
                                            max="2"
                                            step="0.05"
                                            value={settingsStore.appSettings.repeatPenalty ?? 1.1}
                                            aria-invalid={numericErrors()["repeatPenalty"] ? "true" : undefined}
                                            aria-describedby="error-repeatPenalty"
                                            onChange={(e) => { validateNumeric("repeatPenalty", e.currentTarget.value); settingsStore.setAppSetting("repeatPenalty", parseFloat(e.currentTarget.value) || 1.1) }}
                                        />
                                        <NumericError error={numericErrors()["repeatPenalty"] ?? ""} id="error-repeatPenalty" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-seed">
                                            <Icon html={renderIcon("fa-key")} />
                                            <span data-i18n="settings.seed" data-field-label="seed">{t("settings.seed")}</span>
                                            <SettingTooltip section="generation" field="seed" />
                                        </label>
                                        <input
                                            id="settings-seed"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="-1"
                                            max="2147483647"
                                            step="1"
                                            value={settingsStore.appSettings.seed ?? -1}
                                            aria-invalid={numericErrors()["seed"] ? "true" : undefined}
                                            aria-describedby="error-seed"
                                            onChange={(e) => { validateNumeric("seed", e.currentTarget.value); settingsStore.setAppSetting("seed", parseInt(e.currentTarget.value, 10) || -1) }}
                                        />
                                        <NumericError error={numericErrors()["seed"] ?? ""} id="error-seed" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-system-prompt-override">
                                            <Icon html={renderIcon("fa-file-alt")} />
                                            <span data-i18n="settings.systemPromptOverride" data-field-label="systemPromptOverride">{t("settings.systemPromptOverride")}</span>
                                            <SettingTooltip section="generation" field="systemPromptOverride" />
                                        </label>
                                        <textarea
                                            id="settings-system-prompt-override"
                                            class={styles["form-control"]}
                                            rows="3"
                                            value={settingsStore.appSettings.systemPromptOverride ?? ""}
                                            placeholder={t("settings.systemPromptOverride.placeholder")}
                                            data-i18n-placeholder="settings.systemPromptOverride.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("systemPromptOverride", e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-stop-sequences">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.stopSequences" data-field-label="stopSequences">{t("settings.stopSequences")}</span>
                                            <SettingTooltip section="generation" field="stopSequences" />
                                        </label>
                                        <input
                                            id="settings-stop-sequences"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={(settingsStore.appSettings.stopSequences ?? []).join(", ")}
                                            placeholder={t("settings.stopSequences.placeholder")}
                                            data-i18n-placeholder="settings.stopSequences.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("stopSequences", e.currentTarget.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-banned-phrases">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.bannedPhrases" data-field-label="bannedPhrases">{t("settings.bannedPhrases")}</span>
                                            <SettingTooltip section="generation" field="bannedPhrases" />
                                        </label>
                                        <input
                                            id="settings-banned-phrases"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={(settingsStore.appSettings.bannedPhrases ?? []).join(", ")}
                                            placeholder={t("settings.bannedPhrases.placeholder")}
                                            data-i18n-placeholder="settings.bannedPhrases.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("bannedPhrases", e.currentTarget.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-required-phrases">
                                            <Icon html={renderIcon("fa-check-circle")} />
                                            <span data-i18n="settings.requiredPhrases" data-field-label="requiredPhrases">{t("settings.requiredPhrases")}</span>
                                            <SettingTooltip section="generation" field="requiredPhrases" />
                                        </label>
                                        <input
                                            id="settings-required-phrases"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={(settingsStore.appSettings.requiredPhrases ?? []).join(", ")}
                                            placeholder={t("settings.requiredPhrases.placeholder")}
                                            data-i18n-placeholder="settings.requiredPhrases.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("requiredPhrases", e.currentTarget.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-custom-prompt">
                                            <Icon html={renderIcon("fa-edit")} />
                                            <span data-i18n="settings.customPrompt" data-field-label="customPrompt">{t("settings.customPrompt")}</span>
                                            <SettingTooltip section="generation" field="customPrompt" />
                                        </label>
                                        <textarea
                                            id="settings-custom-prompt"
                                            class={styles["form-control"]}
                                            rows="3"
                                            value={settingsStore.settings.customPrompt || ""}
                                            placeholder={t("settings.customPrompt.placeholder")}
                                            data-i18n-placeholder="settings.customPrompt.placeholder"
                                            onInput={(e) => settingsStore.setCustomPrompt(e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-enable-thinking">
                                            <input
                                                id="settings-enable-thinking"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.enableThinking ?? false}
                                                onChange={(e) => settingsStore.setEnableThinking(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.enableThinking" data-field-label="enableThinking">{t("settings.enableThinking")}</span>
                                            <SettingTooltip section="generation" field="enableThinking" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retry-count">
                                            <Icon html={renderIcon("fa-undo")} />
                                            <span data-i18n="settings.retryCount" data-field-label="retryCount">{t("settings.retryCount")}</span>
                                            <SettingTooltip section="generation" field="retryCount" />
                                        </label>
                                        <input
                                            id="settings-retry-count"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.retryCount ?? 3}
                                            aria-invalid={numericErrors()["retryCount"] ? "true" : undefined}
                                            aria-describedby="error-retryCount"
                                            onChange={(e) => { validateNumeric("retryCount", e.currentTarget.value); settingsStore.setAppSetting("retryCount", parseInt(e.currentTarget.value, 10) || 0) }}
                                        />
                                        <NumericError error={numericErrors()["retryCount"] ?? ""} id="error-retryCount" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retry-backoff-strategy">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.retryBackoffStrategy" data-field-label="retryBackoffStrategy">{t("settings.retryBackoffStrategy")}</span>
                                            <SettingTooltip section="generation" field="retryBackoffStrategy" />
                                        </label>
                                        <select
                                            id="settings-retry-backoff-strategy"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.retryBackoffStrategy || "exponential"}
                                            onChange={(e) => settingsStore.setAppSetting("retryBackoffStrategy", e.currentTarget.value as "fixed" | "linear" | "exponential")}
                                        >
                                            <option value="fixed" data-i18n="settings.retryBackoffStrategy.fixed">{t("settings.retryBackoffStrategy.fixed")}</option>
                                            <option value="linear" data-i18n="settings.retryBackoffStrategy.linear">{t("settings.retryBackoffStrategy.linear")}</option>
                                            <option value="exponential" data-i18n="settings.retryBackoffStrategy.exponential">{t("settings.retryBackoffStrategy.exponential")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-request-timeout-ms">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.requestTimeoutMs" data-field-label="requestTimeoutMs">{t("settings.requestTimeoutMs")}</span>
                                            <SettingTooltip section="generation" field="requestTimeoutMs" />
                                        </label>
                                        <input
                                            id="settings-request-timeout-ms"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="600000"
                                            step="1000"
                                            value={settingsStore.appSettings.requestTimeoutMs ?? 60000}
                                            aria-invalid={numericErrors()["requestTimeoutMs"] ? "true" : undefined}
                                            aria-describedby="error-requestTimeoutMs"
                                            onChange={(e) => { validateNumeric("requestTimeoutMs", e.currentTarget.value); settingsStore.setAppSetting("requestTimeoutMs", parseInt(e.currentTarget.value, 10) || 60000) }}
                                        />
                                        <NumericError error={numericErrors()["requestTimeoutMs"] ?? ""} id="error-requestTimeoutMs" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-stream-timeout-ms">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.streamTimeoutMs" data-field-label="streamTimeoutMs">{t("settings.streamTimeoutMs")}</span>
                                            <SettingTooltip section="generation" field="streamTimeoutMs" />
                                        </label>
                                        <input
                                            id="settings-stream-timeout-ms"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="3600000"
                                            step="1000"
                                            value={settingsStore.appSettings.streamTimeoutMs ?? 600000}
                                            aria-invalid={numericErrors()["streamTimeoutMs"] ? "true" : undefined}
                                            aria-describedby="error-streamTimeoutMs"
                                            onChange={(e) => { validateNumeric("streamTimeoutMs", e.currentTarget.value); settingsStore.setAppSetting("streamTimeoutMs", parseInt(e.currentTarget.value, 10) || 600000) }}
                                        />
                                        <NumericError error={numericErrors()["streamTimeoutMs"] ?? ""} id="error-streamTimeoutMs" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-abort-on-error">
                                            <input
                                                id="settings-abort-on-error"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.abortOnError ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("abortOnError", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.abortOnError" data-field-label="abortOnError">{t("settings.abortOnError")}</span>
                                            <SettingTooltip section="generation" field="abortOnError" />
                                        </label>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("validation")}
                                    data-section-id="validation"
                                    id="settings-panel-validation"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-validation"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-check-circle")} />
                                            <span data-i18n="settings.sections.validation">{t("settings.sections.validation")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.validation") })}
                                                onClick={() => handleResetSection("validation")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-validate-output">
                                            <input
                                                id="settings-validate-output"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={(settingsStore.appSettings as Record<string, unknown>).validateOutput as boolean ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("validateOutput" as never, e.currentTarget.checked as never)}
                                            />
                                            <span data-i18n="settings.validateOutput" data-field-label="validateOutput">{t("settings.validateOutput")}</span>
                                            <SettingTooltip section="validation" field="validateOutput" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-validation-strictness">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.validationStrictness" data-field-label="validationStrictness">{t("settings.validationStrictness")}</span>
                                            <SettingTooltip section="validation" field="validationStrictness" />
                                        </label>
                                        <select
                                            id="settings-validation-strictness"
                                            class={styles["form-control"]}
                                            value={settingsStore.appSettings.validationStrictness || "normal"}
                                            onChange={(e) => settingsStore.setAppSetting("validationStrictness", e.currentTarget.value as "lenient" | "normal" | "strict")}
                                        >
                                            <option value="lenient" data-i18n="settings.validationStrictness.lenient">{t("settings.validationStrictness.lenient")}</option>
                                            <option value="normal" data-i18n="settings.validationStrictness.normal">{t("settings.validationStrictness.normal")}</option>
                                            <option value="strict" data-i18n="settings.validationStrictness.strict">{t("settings.validationStrictness.strict")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-deduplicate">
                                            <input
                                                id="settings-deduplicate"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={(settingsStore.appSettings as Record<string, unknown>).deduplicate as boolean ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("deduplicate" as never, e.currentTarget.checked as never)}
                                            />
                                            <span data-i18n="settings.deduplicate" data-field-label="deduplicate">{t("settings.deduplicate")}</span>
                                            <SettingTooltip section="validation" field="deduplicate" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-skip-dedup">
                                            <input
                                                id="settings-skip-dedup"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.skipDedup ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("skipDedup", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.skipDedup" data-field-label="skipDedup">{t("settings.skipDedup")}</span>
                                            <SettingTooltip section="validation" field="skipDedup" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-dedup-similarity-threshold">
                                            <Icon html={renderIcon("fa-layer-group")} />
                                            <span data-i18n="settings.dedupSimilarityThreshold" data-field-label="dedupSimilarityThreshold">{t("settings.dedupSimilarityThreshold")}</span>
                                            <SettingTooltip section="validation" field="dedupSimilarityThreshold" />
                                        </label>
                                        <input
                                            id="settings-dedup-similarity-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0.5"
                                            max="1"
                                            step="0.01"
                                            value={settingsStore.appSettings.dedupSimilarityThreshold ?? 0.92}
                                            aria-invalid={numericErrors()["dedupSimilarityThreshold"] ? "true" : undefined}
                                            aria-describedby="error-dedupSimilarityThreshold"
                                            onChange={(e) => { validateNumeric("dedupSimilarityThreshold", e.currentTarget.value); settingsStore.setAppSetting("dedupSimilarityThreshold", parseFloat(e.currentTarget.value) || 0.92) }}
                                        />
                                        <NumericError error={numericErrors()["dedupSimilarityThreshold"] ?? ""} id="error-dedupSimilarityThreshold" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-quality-threshold">
                                            <Icon html={renderIcon("fa-star")} />
                                            <span data-i18n="settings.qualityThreshold" data-field-label="qualityThreshold">{t("settings.qualityThreshold")}</span>
                                            <SettingTooltip section="validation" field="qualityThreshold" />
                                        </label>
                                        <input
                                            id="settings-quality-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.qualityThreshold ?? 0.7}
                                            aria-invalid={numericErrors()["qualityThreshold"] ? "true" : undefined}
                                            aria-describedby="error-qualityThreshold"
                                            onChange={(e) => { validateNumeric("qualityThreshold", e.currentTarget.value); settingsStore.setAppSetting("qualityThreshold", parseFloat(e.currentTarget.value) || 0.7) }}
                                        />
                                        <NumericError error={numericErrors()["qualityThreshold"] ?? ""} id="error-qualityThreshold" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-auto-regenerate-on-low-quality">
                                            <input
                                                id="settings-auto-regenerate-on-low-quality"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.autoRegenerateOnLowQuality ?? false}
                                                onChange={(e) => settingsStore.setAppSetting("autoRegenerateOnLowQuality", e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.autoRegenerateOnLowQuality" data-field-label="autoRegenerateOnLowQuality">{t("settings.autoRegenerateOnLowQuality")}</span>
                                            <SettingTooltip section="validation" field="autoRegenerateOnLowQuality" />
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-regenerate-threshold">
                                            <Icon html={renderIcon("fa-sync-alt")} />
                                            <span data-i18n="settings.regenerateThreshold" data-field-label="regenerateThreshold">{t("settings.regenerateThreshold")}</span>
                                            <SettingTooltip section="validation" field="regenerateThreshold" />
                                        </label>
                                        <input
                                            id="settings-regenerate-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.regenerateThreshold ?? 0.6}
                                            aria-invalid={numericErrors()["regenerateThreshold"] ? "true" : undefined}
                                            aria-describedby="error-regenerateThreshold"
                                            onChange={(e) => { validateNumeric("regenerateThreshold", e.currentTarget.value); settingsStore.setAppSetting("regenerateThreshold", parseFloat(e.currentTarget.value) || 0.6) }}
                                        />
                                        <NumericError error={numericErrors()["regenerateThreshold"] ?? ""} id="error-regenerateThreshold" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-regeneration-attempts">
                                            <Icon html={renderIcon("fa-undo")} />
                                            <span data-i18n="settings.maxRegenerationAttempts" data-field-label="maxRegenerationAttempts">{t("settings.maxRegenerationAttempts")}</span>
                                            <SettingTooltip section="validation" field="maxRegenerationAttempts" />
                                        </label>
                                        <input
                                            id="settings-max-regeneration-attempts"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.maxRegenerationAttempts ?? 2}
                                            aria-invalid={numericErrors()["maxRegenerationAttempts"] ? "true" : undefined}
                                            aria-describedby="error-maxRegenerationAttempts"
                                            onChange={(e) => { validateNumeric("maxRegenerationAttempts", e.currentTarget.value); settingsStore.setAppSetting("maxRegenerationAttempts", parseInt(e.currentTarget.value, 10) || 0) }}
                                        />
                                        <NumericError error={numericErrors()["maxRegenerationAttempts"] ?? ""} id="error-maxRegenerationAttempts" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-min-qa-pairs-per-file">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.minQaPairsPerFile" data-field-label="minQaPairsPerFile">{t("settings.minQaPairsPerFile")}</span>
                                            <SettingTooltip section="validation" field="minQaPairsPerFile" />
                                        </label>
                                        <input
                                            id="settings-min-qa-pairs-per-file"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="10000"
                                            step="1"
                                            value={settingsStore.appSettings.minQaPairsPerFile ?? 1}
                                            aria-invalid={numericErrors()["minQaPairsPerFile"] ? "true" : undefined}
                                            aria-describedby="error-minQaPairsPerFile"
                                            onChange={(e) => { validateNumeric("minQaPairsPerFile", e.currentTarget.value); settingsStore.setAppSetting("minQaPairsPerFile", parseInt(e.currentTarget.value, 10) || 1) }}
                                        />
                                        <NumericError error={numericErrors()["minQaPairsPerFile"] ?? ""} id="error-minQaPairsPerFile" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-qa-pairs-per-file">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.maxQaPairsPerFile" data-field-label="maxQaPairsPerFile">{t("settings.maxQaPairsPerFile")}</span>
                                            <SettingTooltip section="validation" field="maxQaPairsPerFile" />
                                        </label>
                                        <input
                                            id="settings-max-qa-pairs-per-file"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="100000"
                                            step="10"
                                            value={settingsStore.appSettings.maxQaPairsPerFile ?? 1000}
                                            aria-invalid={numericErrors()["maxQaPairsPerFile"] ? "true" : undefined}
                                            aria-describedby="error-maxQaPairsPerFile"
                                            onChange={(e) => { validateNumeric("maxQaPairsPerFile", e.currentTarget.value); settingsStore.setAppSetting("maxQaPairsPerFile", parseInt(e.currentTarget.value, 10) || 1) }}
                                        />
                                        <NumericError error={numericErrors()["maxQaPairsPerFile"] ?? ""} id="error-maxQaPairsPerFile" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-refinement-passes">
                                            <Icon html={renderIcon("fa-highlighter")} />
                                            <span data-i18n="settings.refinementPasses" data-field-label="refinementPasses">{t("settings.refinementPasses")}</span>
                                            <SettingTooltip section="validation" field="refinementPasses" />
                                        </label>
                                        <input
                                            id="settings-refinement-passes"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.refinementPasses ?? 0}
                                            aria-invalid={numericErrors()["refinementPasses"] ? "true" : undefined}
                                            aria-describedby="error-refinementPasses"
                                            onChange={(e) => { validateNumeric("refinementPasses", e.currentTarget.value); settingsStore.setAppSetting("refinementPasses", parseInt(e.currentTarget.value, 10) || 0) }}
                                        />
                                        <NumericError error={numericErrors()["refinementPasses"] ?? ""} id="error-refinementPasses" />
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("providers")}
                                    data-section-id="providers"
                                    id="settings-panel-providers"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-providers"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-server")} />
                                            <span data-i18n="settings.sections.providers">{t("settings.sections.providers")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.providers") })}
                                                onClick={() => handleResetSection("providers")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-api-key">
                                            <Icon html={renderIcon("fa-key")} />
                                            <span data-i18n="settings.apiKey" data-field-label="apiKey">{t("settings.apiKey")}</span>
                                            <SettingTooltip section="providers" field="apiKey" />
                                        </label>
                                        <input
                                            id="settings-api-key"
                                            class={styles["form-control"]}
                                            type="password"
                                            value={settingsStore.apiKeyPlain()}
                                            placeholder={t("settings.apiKey.placeholder")}
                                            data-i18n-placeholder="settings.apiKey.placeholder"
                                            aria-label={t("settings.apiKey")}
                                            data-i18n-aria-label="settings.apiKey"
                                            onInput={(e) => settingsStore.setApiKey(e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-base-url">
                                            <Icon html={renderIcon("fa-link")} />
                                            <span data-i18n="settings.baseUrl" data-field-label="baseUrl">{t("settings.baseUrl")}</span>
                                            <SettingTooltip section="providers" field="baseUrl" />
                                        </label>
                                        <input
                                            id="settings-base-url"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={settingsStore.settings.baseUrl || ""}
                                            placeholder={t("settings.baseUrl.placeholder")}
                                            data-i18n-placeholder="settings.baseUrl.placeholder"
                                            onInput={(e) => settingsStore.setBaseUrl(e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-ollama-host">
                                            <Icon html={renderIcon("fa-server")} />
                                            <span data-i18n="settings.ollamaHost" data-field-label="ollamaHost">{t("settings.ollamaHost")}</span>
                                            <SettingTooltip section="providers" field="ollamaHost" />
                                        </label>
                                        <input
                                            id="settings-ollama-host"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={settingsStore.settings.ollamaHost || "localhost"}
                                            placeholder={t("settings.ollamaHost.placeholder")}
                                            data-i18n-placeholder="settings.ollamaHost.placeholder"
                                            onInput={(e) => settingsStore.setOllamaHost(e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-ollama-port">
                                            <Icon html={renderIcon("fa-server")} />
                                            <span data-i18n="settings.ollamaPort" data-field-label="ollamaPort">{t("settings.ollamaPort")}</span>
                                            <SettingTooltip section="providers" field="ollamaPort" />
                                        </label>
                                        <input
                                            id="settings-ollama-port"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="65535"
                                            step="1"
                                            value={settingsStore.settings.ollamaPort ?? 11434}
                                            aria-invalid={numericErrors()["ollamaPort"] ? "true" : undefined}
                                            aria-describedby="error-ollamaPort"
                                            onChange={(e) => { validateNumeric("ollamaPort", e.currentTarget.value); settingsStore.setOllamaPort(parseInt(e.currentTarget.value, 10) || 11434) }}
                                        />
                                        <NumericError error={numericErrors()["ollamaPort"] ?? ""} id="error-ollamaPort" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-custom-model-endpoint">
                                            <Icon html={renderIcon("fa-link")} />
                                            <span data-i18n="settings.customModelEndpoint" data-field-label="customModelEndpoint">{t("settings.customModelEndpoint")}</span>
                                            <SettingTooltip section="providers" field="customModelEndpoint" />
                                        </label>
                                        <input
                                            id="settings-custom-model-endpoint"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={(settingsStore.appSettings as Record<string, unknown>).customModelEndpoint as string ?? ""}
                                            placeholder={t("settings.customModelEndpoint.placeholder")}
                                            data-i18n-placeholder="settings.customModelEndpoint.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("customModelEndpoint" as never, e.currentTarget.value as never)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <span class={styles["settings-field__label"]} data-i18n="settings.providersList" data-field-label="providersList">{t("settings.providersList")}</span>
                                        <Show
                                            when={(settingsStore.appSettings.providers ?? []).length > 0}
                                            fallback={<p data-i18n="settings.providersEmpty">{t("settings.providersEmpty")}</p>}
                                        >
                                            <ul class={styles["settings-list"]}>
                                                <For each={settingsStore.appSettings.providers ?? []}>
                                                    {(provider) => (
                                                        <li>{provider.name ?? provider.id ?? String(provider)}</li>
                                                    )}
                                                </For>
                                            </ul>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <span class={styles["settings-field__label"]} data-i18n="settings.failoverPriority" data-field-label="failoverPriority">{t("settings.failoverPriority")}</span>
                                        <Show
                                            when={(settingsStore.appSettings.failoverPriority ?? []).length > 0}
                                            fallback={<p data-i18n="settings.failoverEmpty">{t("settings.failoverEmpty")}</p>}
                                        >
                                            <ul class={styles["settings-list"]}>
                                                <For each={settingsStore.appSettings.failoverPriority ?? []}>
                                                    {(priority) => (
                                                        <li>{priority}</li>
                                                    )}
                                                </For>
                                            </ul>
                                        </Show>
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("telemetry")}
                                    data-section-id="telemetry"
                                    id="settings-panel-telemetry"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-telemetry"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-eye")} />
                                            <span data-i18n="settings.sections.telemetry">{t("settings.sections.telemetry")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.telemetry") })}
                                                onClick={() => handleResetSection("telemetry")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-enable-telemetry">
                                            <Icon html={renderIcon("fa-eye")} />
                                            <span data-i18n="settings.enableTelemetry" data-field-label="enableTelemetry">{t("settings.enableTelemetry")}</span>
                                            <SettingTooltip section="telemetry" field="enableTelemetry" />
                                        </label>
                                        <input
                                            id="settings-enable-telemetry"
                                            type="checkbox"
                                            checked={(settingsStore.appSettings as Record<string, unknown>).enableTelemetry as boolean ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("enableTelemetry" as never, e.currentTarget.checked as never)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-disable-telemetry">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.disableTelemetry" data-field-label="disableTelemetry">{t("settings.disableTelemetry")}</span>
                                            <SettingTooltip section="telemetry" field="disableTelemetry" />
                                        </label>
                                        <input
                                            id="settings-disable-telemetry"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.disableTelemetry ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("disableTelemetry", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-crash-reports-enabled">
                                            <Icon html={renderIcon("fa-bug")} />
                                            <span data-i18n="settings.crashReportsEnabled" data-field-label="crashReportsEnabled">{t("settings.crashReportsEnabled")}</span>
                                            <SettingTooltip section="telemetry" field="crashReportsEnabled" />
                                        </label>
                                        <input
                                            id="settings-crash-reports-enabled"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.crashReportsEnabled ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("crashReportsEnabled", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-disable-crash-reports">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.disableCrashReports" data-field-label="disableCrashReports">{t("settings.disableCrashReports")}</span>
                                            <SettingTooltip section="telemetry" field="disableCrashReports" />
                                        </label>
                                        <input
                                            id="settings-disable-crash-reports"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.disableCrashReports ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("disableCrashReports", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-auto-update">
                                            <Icon html={renderIcon("fa-sync-alt")} />
                                            <span data-i18n="settings.autoUpdate" data-field-label="autoUpdate">{t("settings.autoUpdate")}</span>
                                            <SettingTooltip section="telemetry" field="autoUpdate" />
                                        </label>
                                        <input
                                            id="settings-auto-update"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.autoUpdate ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("autoUpdate", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-disable-auto-update">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.disableAutoUpdate" data-field-label="disableAutoUpdate">{t("settings.disableAutoUpdate")}</span>
                                            <SettingTooltip section="telemetry" field="disableAutoUpdate" />
                                        </label>
                                        <input
                                            id="settings-disable-auto-update"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.disableAutoUpdate ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("disableAutoUpdate", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-update-check-interval">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.updateCheckIntervalHours" data-field-label="updateCheckIntervalHours">{t("settings.updateCheckIntervalHours")}</span>
                                            <SettingTooltip section="telemetry" field="updateCheckIntervalHours" />
                                        </label>
                                        <input
                                            id="settings-update-check-interval"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="720"
                                            step="1"
                                            value={settingsStore.appSettings.updateCheckIntervalHours ?? 24}
                                            aria-invalid={numericErrors()["updateCheckIntervalHours"] ? "true" : undefined}
                                            aria-describedby="error-updateCheckIntervalHours"
                                            onChange={(e) => { validateNumeric("updateCheckIntervalHours", e.currentTarget.value); settingsStore.setAppSetting("updateCheckIntervalHours", parseInt(e.currentTarget.value, 10) || 24) }}
                                        />
                                        <NumericError error={numericErrors()["updateCheckIntervalHours"] ?? ""} id="error-updateCheckIntervalHours" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retention-days">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.retentionDays" data-field-label="retentionDays">{t("settings.retentionDays")}</span>
                                            <SettingTooltip section="telemetry" field="retentionDays" />
                                        </label>
                                        <input
                                            id="settings-retention-days"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="3650"
                                            step="1"
                                            value={settingsStore.appSettings.retentionDays ?? 30}
                                            aria-invalid={numericErrors()["retentionDays"] ? "true" : undefined}
                                            aria-describedby="error-retentionDays"
                                            onChange={(e) => { validateNumeric("retentionDays", e.currentTarget.value); settingsStore.setAppSetting("retentionDays", parseInt(e.currentTarget.value, 10) || 30) }}
                                        />
                                        <NumericError error={numericErrors()["retentionDays"] ?? ""} id="error-retentionDays" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-data-residency">
                                            <Icon html={renderIcon("fa-server")} />
                                            <span data-i18n="settings.dataResidency" data-field-label="dataResidency">{t("settings.dataResidency")}</span>
                                            <SettingTooltip section="telemetry" field="dataResidency" />
                                        </label>
                                        <input
                                            id="settings-data-residency"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={settingsStore.appSettings.dataResidency ?? ""}
                                            placeholder={t("settings.dataResidency.placeholder")}
                                            data-i18n-placeholder="settings.dataResidency.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("dataResidency", e.currentTarget.value)}
                                        />
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("advanced")}
                                    data-section-id="advanced"
                                    id="settings-panel-advanced"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-advanced"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.sections.advanced">{t("settings.sections.advanced")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.advanced") })}
                                                onClick={() => handleResetSection("advanced")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-gpu-acceleration">
                                            <Icon html={renderIcon("fa-bolt")} />
                                            <span data-i18n="settings.gpuAcceleration" data-field-label="gpuAcceleration">{t("settings.gpuAcceleration")}</span>
                                            <SettingTooltip section="advanced" field="gpuAcceleration" />
                                        </label>
                                        <input
                                            id="settings-gpu-acceleration"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.gpuAcceleration ?? true}
                                            onChange={(e) => settingsStore.setAppSetting("gpuAcceleration", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-send-to-tray-on-close">
                                            <Icon html={renderIcon("fa-window-restore")} />
                                            <span data-i18n="settings.sendToTrayOnClose" data-field-label="sendToTrayOnClose">{t("settings.sendToTrayOnClose")}</span>
                                            <SettingTooltip section="advanced" field="sendToTrayOnClose" />
                                        </label>
                                        <input
                                            id="settings-send-to-tray-on-close"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.sendToTrayOnClose ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("sendToTrayOnClose", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-start-on-login">
                                            <Icon html={renderIcon("fa-cog")} />
                                            <span data-i18n="settings.startOnLogin" data-field-label="startOnLogin">{t("settings.startOnLogin")}</span>
                                            <SettingTooltip section="advanced" field="startOnLogin" />
                                        </label>
                                        <input
                                            id="settings-start-on-login"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.startOnLogin ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("startOnLogin", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-cache-dir">
                                            <Icon html={renderIcon("fa-folder-open")} />
                                            <span data-i18n="settings.cacheDir" data-field-label="cacheDir">{t("settings.cacheDir")}</span>
                                            <SettingTooltip section="advanced" field="cacheDir" />
                                        </label>
                                        <div class={`section-actions ${styles["settings-actions--inline"]}`}>
                                            <input
                                                id="settings-cache-dir"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={settingsStore.appSettings.cacheDir ?? ""}
                                                placeholder={t("settings.cacheDir.placeholder")}
                                                data-i18n-placeholder="settings.cacheDir.placeholder"
                                                onInput={(e) => settingsStore.setAppSetting("cacheDir", e.currentTarget.value)}
                                            />
                                            <button
                                                type="button"
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.cacheDir.browseAria")}
                                                data-i18n-aria-label="settings.cacheDir.browseAria"
                                                onClick={async () => {
                                                    const api = (window as unknown as { electronAPI?: { chooseDirectory?: (defaultPath?: string) => Promise<string | null> } }).electronAPI
                                                    if (!api?.chooseDirectory) return
                                                    try {
                                                        const dirPath = await api.chooseDirectory()
                                                        if (dirPath) settingsStore.setAppSetting("cacheDir", dirPath)
                                                    }
                                                    catch {
                                                        // Directory dialog may be unavailable in non-Electron environments; ignore.
                                                    }
                                                }}
                                            >
                                                <Icon html={renderIcon("fa-folder-open")} />
                                                <span data-i18n="settings.cacheDir.browse">{t("settings.cacheDir.browse")}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-cache-max-size">
                                            <Icon html={renderIcon("fa-database")} />
                                            <span data-i18n="settings.cacheMaxSizeMB" data-field-label="cacheMaxSizeMB">{t("settings.cacheMaxSizeMB")}</span>
                                            <SettingTooltip section="advanced" field="cacheMaxSizeMB" />
                                        </label>
                                        <input
                                            id="settings-cache-max-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="10240"
                                            step="50"
                                            value={settingsStore.appSettings.cacheMaxSizeMB ?? 500}
                                            aria-invalid={numericErrors()["cacheMaxSizeMB"] ? "true" : undefined}
                                            aria-describedby="error-cacheMaxSizeMB"
                                            onChange={(e) => { validateNumeric("cacheMaxSizeMB", e.currentTarget.value); settingsStore.setAppSetting("cacheMaxSizeMB", parseInt(e.currentTarget.value, 10) || 500) }}
                                        />
                                        <NumericError error={numericErrors()["cacheMaxSizeMB"] ?? ""} id="error-cacheMaxSizeMB" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-cache-ttl">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.cacheTtlSeconds" data-field-label="cacheTtlSeconds">{t("settings.cacheTtlSeconds")}</span>
                                            <SettingTooltip section="advanced" field="cacheTtlSeconds" />
                                        </label>
                                        <input
                                            id="settings-cache-ttl"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="60"
                                            max="604800"
                                            step="60"
                                            value={settingsStore.appSettings.cacheTtlSeconds ?? 86400}
                                            aria-invalid={numericErrors()["cacheTtlSeconds"] ? "true" : undefined}
                                            aria-describedby="error-cacheTtlSeconds"
                                            onChange={(e) => { validateNumeric("cacheTtlSeconds", e.currentTarget.value); settingsStore.setAppSetting("cacheTtlSeconds", parseInt(e.currentTarget.value, 10) || 86400) }}
                                        />
                                        <NumericError error={numericErrors()["cacheTtlSeconds"] ?? ""} id="error-cacheTtlSeconds" />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-clear-cache-on-exit">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.clearCacheOnExit" data-field-label="clearCacheOnExit">{t("settings.clearCacheOnExit")}</span>
                                            <SettingTooltip section="advanced" field="clearCacheOnExit" />
                                        </label>
                                        <input
                                            id="settings-clear-cache-on-exit"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.clearCacheOnExit ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("clearCacheOnExit", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-log-to-file">
                                            <Icon html={renderIcon("fa-file-alt")} />
                                            <span data-i18n="settings.logToFile" data-field-label="logToFile">{t("settings.logToFile")}</span>
                                            <SettingTooltip section="advanced" field="logToFile" />
                                        </label>
                                        <input
                                            id="settings-log-to-file"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.logToFile ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("logToFile", e.currentTarget.checked)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-log-file-path">
                                            <Icon html={renderIcon("fa-file-code")} />
                                            <span data-i18n="settings.logFilePath" data-field-label="logFilePath">{t("settings.logFilePath")}</span>
                                            <SettingTooltip section="advanced" field="logFilePath" />
                                        </label>
                                        <div class={`section-actions ${styles["settings-actions--inline"]}`}>
                                            <input
                                                id="settings-log-file-path"
                                                class={styles["form-control"]}
                                                type="text"
                                                value={settingsStore.appSettings.logFilePath ?? ""}
                                                placeholder={t("settings.logFilePath.placeholder")}
                                                data-i18n-placeholder="settings.logFilePath.placeholder"
                                                onInput={(e) => settingsStore.setAppSetting("logFilePath", e.currentTarget.value)}
                                            />
                                            <button
                                                type="button"
                                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                                aria-label={t("settings.logFilePath.browseAria")}
                                                data-i18n-aria-label="settings.logFilePath.browseAria"
                                                onClick={async () => {
                                                    const api = (window as unknown as { electronAPI?: { openFileDialog?: () => Promise<Array<{ path: string }> | null> } }).electronAPI
                                                    if (!api?.openFileDialog) return
                                                    try {
                                                        const result = await api.openFileDialog()
                                                        if (result && result.length > 0 && result[0].path) {
                                                            settingsStore.setAppSetting("logFilePath", result[0].path)
                                                        }
                                                    }
                                                    catch {
                                                        // File dialog may be unavailable in non-Electron environments; ignore.
                                                    }
                                                }}
                                            >
                                                <Icon html={renderIcon("fa-folder-open")} />
                                                <span data-i18n="settings.logFilePath.browse">{t("settings.logFilePath.browse")}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-log-level">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.logLevel" data-field-label="logLevel">{t("settings.logLevel")}</span>
                                            <SettingTooltip section="advanced" field="logLevel" />
                                        </label>
                                        <select
                                            id="settings-log-level"
                                            class={styles["form-control"]}
                                            value={(settingsStore.appSettings as Record<string, unknown>).logLevel as string ?? "info"}
                                            onChange={(e) => settingsStore.setAppSetting("logLevel" as never, e.currentTarget.value as never)}
                                        >
                                            <option value="debug" data-i18n="settings.logLevel.debug">{t("settings.logLevel.debug")}</option>
                                            <option value="info" data-i18n="settings.logLevel.info">{t("settings.logLevel.info")}</option>
                                            <option value="warn" data-i18n="settings.logLevel.warn">{t("settings.logLevel.warn")}</option>
                                            <option value="error" data-i18n="settings.logLevel.error">{t("settings.logLevel.error")}</option>
                                        </select>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-verbose-dashboard">
                                            <Icon html={renderIcon("fa-chart-bar")} />
                                            <span data-i18n="settings.verboseDashboard" data-field-label="verboseDashboard">{t("settings.verboseDashboard")}</span>
                                            <SettingTooltip section="advanced" field="verboseDashboard" />
                                        </label>
                                        <input
                                            id="settings-verbose-dashboard"
                                            type="checkbox"
                                            checked={settingsStore.appSettings.verboseDashboard ?? false}
                                            onChange={(e) => settingsStore.setAppSetting("verboseDashboard", e.currentTarget.checked)}
                                        />
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("experimental")}
                                    data-section-id="experimental"
                                    id="settings-panel-experimental"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-experimental"
                                >
                                    <div class={styles["settings-section__header"]}>
                                        <h3>
                                            <Icon html={renderIcon("fa-magic")} />
                                            <span data-i18n="settings.sections.experimental">{t("settings.sections.experimental")}</span>
                                            <span class={styles["settings-badge"]} data-i18n="settings.experimentalBadge">{t("settings.experimentalBadge")}</span>
                                        </h3>
                                        <Show when={!isSearching()}>
                                            <button
                                                type="button"
                                                class={styles["settings-section__reset"]}
                                                aria-label={t("settings.resetSection.ariaLabel", undefined, { section: t("settings.sections.experimental") })}
                                                onClick={() => handleResetSection("experimental")}
                                            >
                                                <Icon html={renderIcon("fa-undo")} />
                                                <span data-i18n="settings.resetSection">{t("settings.resetSection")}</span>
                                            </button>
                                        </Show>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-output-language-override">
                                            <Icon html={renderIcon("fa-cloud")} />
                                            <span data-i18n="settings.outputLanguageOverride" data-field-label="outputLanguageOverride">{t("settings.outputLanguageOverride")}</span>
                                            <SettingTooltip section="experimental" field="outputLanguageOverride" />
                                        </label>
                                        <input
                                            id="settings-output-language-override"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={settingsStore.appSettings.outputLanguageOverride ?? ""}
                                            placeholder={t("settings.outputLanguageOverride.placeholder")}
                                            data-i18n-placeholder="settings.outputLanguageOverride.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("outputLanguageOverride", e.currentTarget.value)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-experimental-custom-endpoint">
                                            <Icon html={renderIcon("fa-link")} />
                                            <span data-i18n="settings.customModelEndpoint" data-field-label="customModelEndpoint">{t("settings.customModelEndpoint")}</span>
                                            <SettingTooltip section="experimental" field="customModelEndpoint" />
                                        </label>
                                        <input
                                            id="settings-experimental-custom-endpoint"
                                            class={styles["form-control"]}
                                            type="text"
                                            value={(settingsStore.appSettings as Record<string, unknown>).customModelEndpoint as string ?? ""}
                                            placeholder={t("settings.customModelEndpoint.placeholder")}
                                            data-i18n-placeholder="settings.customModelEndpoint.placeholder"
                                            onInput={(e) => settingsStore.setAppSetting("customModelEndpoint" as never, e.currentTarget.value as never)}
                                        />
                                    </div>
                                </section>
                            </div>
                        </div>
                        <div class={styles["settings-actions"]}>
                            <button
                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                aria-label={t("settings.resetAll.ariaLabel")}
                                data-i18n-aria-label="settings.resetAll.ariaLabel"
                                onClick={handleResetAll}
                            >
                                <Icon html={renderIcon("fa-undo")} />
                                <span data-i18n="settings.resetAll">{t("settings.resetAll")}</span>
                            </button>
                            <button
                                class={`${styles["btn"]} ${styles["btn-primary"]}`}
                                aria-label={t("settings.saveAria")}
                                data-i18n-aria-label="settings.saveAria"
                                onClick={handleSave}
                            >
                                <Icon html={renderIcon("fa-save")} />
                                <span data-i18n="settings.save">{t("settings.save")}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Show>
    )
}
