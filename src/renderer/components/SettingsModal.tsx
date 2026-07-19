import type { JSX } from "solid-js"
import { createSignal, For, Show, createEffect } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import modalStyles from "./styles/Modal.module.css"
import settingsModalStyles from "./styles/SettingsModal.module.css"
import formsStyles from "./styles/Forms.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
const styles = { ...modalStyles, ...settingsModalStyles, ...formsStyles, ...buttonsStyles }
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
    let overlayRef: HTMLDivElement | undefined
    let firstFocusable: HTMLElement | undefined
    let lastFocusable: HTMLElement | undefined
    createEffect(() => {
        if (props.appStore.uiStore.settingsOpen()) {
            settingsStore.refreshProfiles()
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
        }
    })
    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
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
                if ((label.dataset.fieldLabel || "").toLowerCase().includes(query)) return true
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
                aria-label={t("settings.modalAria")}
                data-i18n-aria-label="settings.modalAria"
                onClick={handleOverlayClick}
                onKeyDown={handleKeydown}
            >
                <div class={`${styles["modal-content"]} ${styles["settings-modal-content"]}`}>
                    <div class={styles["modal-header"]}>
                        <h2>
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
                    <div class={styles["modal-body"]}>
                        <div class={styles["settings-layout"]}>
                            <nav
                                class={styles["settings-nav"]}
                                aria-label={t("settings.navAria")}
                                data-i18n-aria-label="settings.navAria"
                                onKeyDown={handleNavKeydown}
                            >
                                <For each={SECTIONS}>
                                    {(section) => (
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
                                    <h3>
                                        <Icon html={renderIcon("fa-palette")} />
                                        <span data-i18n="settings.sections.appearance">{t("settings.sections.appearance")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-theme">
                                            <Icon html={renderIcon("fa-display")} />
                                            <span data-i18n="settings.theme" data-field-label="theme">{t("settings.theme")}</span>
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
                                        </label>
                                        <input
                                            id="settings-font-scale"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="200"
                                            step="10"
                                            value={settingsStore.appSettings.fontScale ?? 100}
                                            onChange={(e) => settingsStore.setAppSetting("fontScale", parseInt(e.currentTarget.value, 10) || 100)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-density">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.density" data-field-label="density">{t("settings.density")}</span>
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-custom-css-path">
                                            <Icon html={renderIcon("fa-file-code")} />
                                            <span data-i18n="settings.customCssPath" data-field-label="customCssPath">{t("settings.customCssPath")}</span>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-cogs")} />
                                        <span data-i18n="settings.sections.processing">{t("settings.sections.processing")}</span>
                                    </h3>
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-file-size">
                                            <Icon html={renderIcon("fa-hdd")} />
                                            <span data-i18n="settings.maxFileSize" data-field-label="maxFileSize">{t("settings.maxFileSize")}</span>
                                        </label>
                                        <input
                                            id="settings-max-file-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="10"
                                            max="1000"
                                            value={settingsStore.appSettings.maxFileSize}
                                            onChange={(e) => settingsStore.setMaxFileSize(parseInt(e.currentTarget.value, 10))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-output-items">
                                            <Icon html={renderIcon("fa-database")} />
                                            <span data-i18n="settings.maxOutputItems" data-field-label="maxOutputItems">{t("settings.maxOutputItems")}</span>
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
                                        </label>
                                        <input
                                            id="settings-chunk-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="500"
                                            max="10000"
                                            step="100"
                                            value={settingsStore.settings.chunkSize}
                                            onChange={(e) => settingsStore.setChunkSize(parseInt(e.currentTarget.value, 10))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-concurrency">
                                            <Icon html={renderIcon("fa-bolt")} />
                                            <span data-i18n="settings.concurrency" data-field-label="concurrency">{t("settings.concurrency")}</span>
                                        </label>
                                        <input
                                            id="settings-concurrency"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="10"
                                            step="1"
                                            value={settingsStore.settings.concurrency}
                                            onChange={(e) => settingsStore.setConcurrency(parseInt(e.currentTarget.value, 10))}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-min-chunk-length">
                                            <Icon html={renderIcon("fa-cut")} />
                                            <span data-i18n="settings.minChunkLength" data-field-label="minChunkLength">{t("settings.minChunkLength")}</span>
                                        </label>
                                        <input
                                            id="settings-min-chunk-length"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="2000"
                                            step="50"
                                            value={settingsStore.appSettings.minChunkLength ?? 200}
                                            onChange={(e) => settingsStore.setAppSetting("minChunkLength", parseInt(e.currentTarget.value, 10) || 200)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-chunk-length">
                                            <Icon html={renderIcon("fa-expand")} />
                                            <span data-i18n="settings.maxChunkLength" data-field-label="maxChunkLength">{t("settings.maxChunkLength")}</span>
                                        </label>
                                        <input
                                            id="settings-max-chunk-length"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="32000"
                                            step="500"
                                            value={settingsStore.appSettings.maxChunkLength ?? 8000}
                                            onChange={(e) => settingsStore.setAppSetting("maxChunkLength", parseInt(e.currentTarget.value, 10) || 8000)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-chunk-overlap">
                                            <Icon html={renderIcon("fa-layer-group")} />
                                            <span data-i18n="settings.chunkOverlap" data-field-label="chunkOverlap">{t("settings.chunkOverlap")}</span>
                                        </label>
                                        <input
                                            id="settings-chunk-overlap"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1000"
                                            step="10"
                                            value={settingsStore.appSettings.chunkOverlap ?? 100}
                                            onChange={(e) => settingsStore.setAppSetting("chunkOverlap", parseInt(e.currentTarget.value, 10) || 0)}
                                        />
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
                                    <h3>
                                        <Icon html={renderIcon("fa-window-restore")} />
                                        <span data-i18n="settings.sections.window">{t("settings.sections.window")}</span>
                                    </h3>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-file-export")} />
                                        <span data-i18n="settings.sections.outputMode">{t("settings.sections.outputMode")}</span>
                                    </h3>
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
                                            </label>
                                            <input
                                                id="settings-max-items-per-file"
                                                class={styles["form-control"]}
                                                type="number"
                                                min="100"
                                                max="1000000"
                                                step="100"
                                                value={settingsStore.appSettings.maxItemsPerFile ?? 50000}
                                                onChange={(e) => settingsStore.setAppSetting("maxItemsPerFile", parseInt(e.currentTarget.value, 10) || 50000)}
                                            />
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
                                    <h3>
                                        <Icon html={renderIcon("fa-download")} />
                                        <span data-i18n="settings.sections.export">{t("settings.sections.export")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-output-format">
                                            <Icon html={renderIcon("fa-file-code")} />
                                            <span data-i18n="settings.outputFormat" data-field-label="outputFormat">{t("settings.outputFormat")}</span>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-brain")} />
                                        <span data-i18n="settings.sections.generation">{t("settings.sections.generation")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-model">
                                            <Icon html={renderIcon("fa-brain")} />
                                            <span data-i18n="settings.model" data-field-label="model">{t("settings.model")}</span>
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
                                        </label>
                                        <input
                                            id="settings-temperature"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={settingsStore.settings.temperature}
                                            onChange={(e) => settingsStore.setTemperature(parseFloat(e.currentTarget.value) || 0)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-top-p">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.topP" data-field-label="topP">{t("settings.topP")}</span>
                                        </label>
                                        <input
                                            id="settings-top-p"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.topP ?? 0.9}
                                            onChange={(e) => settingsStore.setAppSetting("topP", parseFloat(e.currentTarget.value) || 0.9)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-top-k">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.topK" data-field-label="topK">{t("settings.topK")}</span>
                                        </label>
                                        <input
                                            id="settings-top-k"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="1000"
                                            step="1"
                                            value={settingsStore.appSettings.topK ?? 40}
                                            onChange={(e) => settingsStore.setAppSetting("topK", parseInt(e.currentTarget.value, 10) || 40)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-repeat-penalty">
                                            <Icon html={renderIcon("fa-sync-alt")} />
                                            <span data-i18n="settings.repeatPenalty" data-field-label="repeatPenalty">{t("settings.repeatPenalty")}</span>
                                        </label>
                                        <input
                                            id="settings-repeat-penalty"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0.5"
                                            max="2"
                                            step="0.05"
                                            value={settingsStore.appSettings.repeatPenalty ?? 1.1}
                                            onChange={(e) => settingsStore.setAppSetting("repeatPenalty", parseFloat(e.currentTarget.value) || 1.1)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-seed">
                                            <Icon html={renderIcon("fa-key")} />
                                            <span data-i18n="settings.seed" data-field-label="seed">{t("settings.seed")}</span>
                                        </label>
                                        <input
                                            id="settings-seed"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="-1"
                                            max="2147483647"
                                            step="1"
                                            value={settingsStore.appSettings.seed ?? -1}
                                            onChange={(e) => settingsStore.setAppSetting("seed", parseInt(e.currentTarget.value, 10) || -1)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-system-prompt-override">
                                            <Icon html={renderIcon("fa-file-alt")} />
                                            <span data-i18n="settings.systemPromptOverride" data-field-label="systemPromptOverride">{t("settings.systemPromptOverride")}</span>
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retry-count">
                                            <Icon html={renderIcon("fa-undo")} />
                                            <span data-i18n="settings.retryCount" data-field-label="retryCount">{t("settings.retryCount")}</span>
                                        </label>
                                        <input
                                            id="settings-retry-count"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.retryCount ?? 3}
                                            onChange={(e) => settingsStore.setAppSetting("retryCount", parseInt(e.currentTarget.value, 10) || 0)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retry-backoff-strategy">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.retryBackoffStrategy" data-field-label="retryBackoffStrategy">{t("settings.retryBackoffStrategy")}</span>
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
                                        </label>
                                        <input
                                            id="settings-request-timeout-ms"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="600000"
                                            step="1000"
                                            value={settingsStore.appSettings.requestTimeoutMs ?? 60000}
                                            onChange={(e) => settingsStore.setAppSetting("requestTimeoutMs", parseInt(e.currentTarget.value, 10) || 60000)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-stream-timeout-ms">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.streamTimeoutMs" data-field-label="streamTimeoutMs">{t("settings.streamTimeoutMs")}</span>
                                        </label>
                                        <input
                                            id="settings-stream-timeout-ms"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1000"
                                            max="3600000"
                                            step="1000"
                                            value={settingsStore.appSettings.streamTimeoutMs ?? 600000}
                                            onChange={(e) => settingsStore.setAppSetting("streamTimeoutMs", parseInt(e.currentTarget.value, 10) || 600000)}
                                        />
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
                                    <h3>
                                        <Icon html={renderIcon("fa-check-circle")} />
                                        <span data-i18n="settings.sections.validation">{t("settings.sections.validation")}</span>
                                    </h3>
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-validation-strictness">
                                            <Icon html={renderIcon("fa-sliders-h")} />
                                            <span data-i18n="settings.validationStrictness" data-field-label="validationStrictness">{t("settings.validationStrictness")}</span>
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-dedup-similarity-threshold">
                                            <Icon html={renderIcon("fa-layer-group")} />
                                            <span data-i18n="settings.dedupSimilarityThreshold" data-field-label="dedupSimilarityThreshold">{t("settings.dedupSimilarityThreshold")}</span>
                                        </label>
                                        <input
                                            id="settings-dedup-similarity-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0.5"
                                            max="1"
                                            step="0.01"
                                            value={settingsStore.appSettings.dedupSimilarityThreshold ?? 0.92}
                                            onChange={(e) => settingsStore.setAppSetting("dedupSimilarityThreshold", parseFloat(e.currentTarget.value) || 0.92)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-quality-threshold">
                                            <Icon html={renderIcon("fa-star")} />
                                            <span data-i18n="settings.qualityThreshold" data-field-label="qualityThreshold">{t("settings.qualityThreshold")}</span>
                                        </label>
                                        <input
                                            id="settings-quality-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.qualityThreshold ?? 0.7}
                                            onChange={(e) => settingsStore.setAppSetting("qualityThreshold", parseFloat(e.currentTarget.value) || 0.7)}
                                        />
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
                                        </label>
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-regenerate-threshold">
                                            <Icon html={renderIcon("fa-sync-alt")} />
                                            <span data-i18n="settings.regenerateThreshold" data-field-label="regenerateThreshold">{t("settings.regenerateThreshold")}</span>
                                        </label>
                                        <input
                                            id="settings-regenerate-threshold"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settingsStore.appSettings.regenerateThreshold ?? 0.6}
                                            onChange={(e) => settingsStore.setAppSetting("regenerateThreshold", parseFloat(e.currentTarget.value) || 0.6)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-regeneration-attempts">
                                            <Icon html={renderIcon("fa-undo")} />
                                            <span data-i18n="settings.maxRegenerationAttempts" data-field-label="maxRegenerationAttempts">{t("settings.maxRegenerationAttempts")}</span>
                                        </label>
                                        <input
                                            id="settings-max-regeneration-attempts"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.maxRegenerationAttempts ?? 2}
                                            onChange={(e) => settingsStore.setAppSetting("maxRegenerationAttempts", parseInt(e.currentTarget.value, 10) || 0)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-min-qa-pairs-per-file">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.minQaPairsPerFile" data-field-label="minQaPairsPerFile">{t("settings.minQaPairsPerFile")}</span>
                                        </label>
                                        <input
                                            id="settings-min-qa-pairs-per-file"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="10000"
                                            step="1"
                                            value={settingsStore.appSettings.minQaPairsPerFile ?? 1}
                                            onChange={(e) => settingsStore.setAppSetting("minQaPairsPerFile", parseInt(e.currentTarget.value, 10) || 1)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-max-qa-pairs-per-file">
                                            <Icon html={renderIcon("fa-list-ol")} />
                                            <span data-i18n="settings.maxQaPairsPerFile" data-field-label="maxQaPairsPerFile">{t("settings.maxQaPairsPerFile")}</span>
                                        </label>
                                        <input
                                            id="settings-max-qa-pairs-per-file"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="100000"
                                            step="10"
                                            value={settingsStore.appSettings.maxQaPairsPerFile ?? 1000}
                                            onChange={(e) => settingsStore.setAppSetting("maxQaPairsPerFile", parseInt(e.currentTarget.value, 10) || 1)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-refinement-passes">
                                            <Icon html={renderIcon("fa-highlighter")} />
                                            <span data-i18n="settings.refinementPasses" data-field-label="refinementPasses">{t("settings.refinementPasses")}</span>
                                        </label>
                                        <input
                                            id="settings-refinement-passes"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={settingsStore.appSettings.refinementPasses ?? 0}
                                            onChange={(e) => settingsStore.setAppSetting("refinementPasses", parseInt(e.currentTarget.value, 10) || 0)}
                                        />
                                    </div>
                                </section>
                                <section
                                    class={sectionClass("providers")}
                                    data-section-id="providers"
                                    id="settings-panel-providers"
                                    role="tabpanel"
                                    aria-labelledby="settings-tab-providers"
                                >
                                    <h3>
                                        <Icon html={renderIcon("fa-server")} />
                                        <span data-i18n="settings.sections.providers">{t("settings.sections.providers")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-api-key">
                                            <Icon html={renderIcon("fa-key")} />
                                            <span data-i18n="settings.apiKey" data-field-label="apiKey">{t("settings.apiKey")}</span>
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
                                        </label>
                                        <input
                                            id="settings-ollama-port"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="65535"
                                            step="1"
                                            value={settingsStore.settings.ollamaPort ?? 11434}
                                            onChange={(e) => settingsStore.setOllamaPort(parseInt(e.currentTarget.value, 10) || 11434)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-custom-model-endpoint">
                                            <Icon html={renderIcon("fa-link")} />
                                            <span data-i18n="settings.customModelEndpoint" data-field-label="customModelEndpoint">{t("settings.customModelEndpoint")}</span>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-eye")} />
                                        <span data-i18n="settings.sections.telemetry">{t("settings.sections.telemetry")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-enable-telemetry">
                                            <Icon html={renderIcon("fa-eye")} />
                                            <span data-i18n="settings.enableTelemetry" data-field-label="enableTelemetry">{t("settings.enableTelemetry")}</span>
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
                                        </label>
                                        <input
                                            id="settings-update-check-interval"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="720"
                                            step="1"
                                            value={settingsStore.appSettings.updateCheckIntervalHours ?? 24}
                                            onChange={(e) => settingsStore.setAppSetting("updateCheckIntervalHours", parseInt(e.currentTarget.value, 10) || 24)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-retention-days">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.retentionDays" data-field-label="retentionDays">{t("settings.retentionDays")}</span>
                                        </label>
                                        <input
                                            id="settings-retention-days"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="1"
                                            max="3650"
                                            step="1"
                                            value={settingsStore.appSettings.retentionDays ?? 30}
                                            onChange={(e) => settingsStore.setAppSetting("retentionDays", parseInt(e.currentTarget.value, 10) || 30)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-data-residency">
                                            <Icon html={renderIcon("fa-server")} />
                                            <span data-i18n="settings.dataResidency" data-field-label="dataResidency">{t("settings.dataResidency")}</span>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-sliders-h")} />
                                        <span data-i18n="settings.sections.advanced">{t("settings.sections.advanced")}</span>
                                    </h3>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-gpu-acceleration">
                                            <Icon html={renderIcon("fa-bolt")} />
                                            <span data-i18n="settings.gpuAcceleration" data-field-label="gpuAcceleration">{t("settings.gpuAcceleration")}</span>
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
                                        </label>
                                        <input
                                            id="settings-cache-max-size"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="50"
                                            max="10240"
                                            step="50"
                                            value={settingsStore.appSettings.cacheMaxSizeMB ?? 500}
                                            onChange={(e) => settingsStore.setAppSetting("cacheMaxSizeMB", parseInt(e.currentTarget.value, 10) || 500)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-cache-ttl">
                                            <Icon html={renderIcon("fa-clock")} />
                                            <span data-i18n="settings.cacheTtlSeconds" data-field-label="cacheTtlSeconds">{t("settings.cacheTtlSeconds")}</span>
                                        </label>
                                        <input
                                            id="settings-cache-ttl"
                                            class={styles["form-control"]}
                                            type="number"
                                            min="60"
                                            max="604800"
                                            step="60"
                                            value={settingsStore.appSettings.cacheTtlSeconds ?? 86400}
                                            onChange={(e) => settingsStore.setAppSetting("cacheTtlSeconds", parseInt(e.currentTarget.value, 10) || 86400)}
                                        />
                                    </div>
                                    <div class={styles["settings-field"]}>
                                        <label class={styles["settings-field__label"]} for="settings-clear-cache-on-exit">
                                            <Icon html={renderIcon("fa-times-circle")} />
                                            <span data-i18n="settings.clearCacheOnExit" data-field-label="clearCacheOnExit">{t("settings.clearCacheOnExit")}</span>
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
                                    <h3>
                                        <Icon html={renderIcon("fa-magic")} />
                                        <span data-i18n="settings.sections.experimental">{t("settings.sections.experimental")}</span>
                                        <span class={styles["settings-badge"]} data-i18n="settings.experimentalBadge">{t("settings.experimentalBadge")}</span>
                                    </h3>
                                </section>
                            </div>
                        </div>
                        <div class={styles["settings-actions"]}>
                            <button
                                class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                                aria-label={t("settings.resetAria")}
                                data-i18n-aria-label="settings.resetAria"
                                onClick={handleReset}
                            >
                                <Icon html={renderIcon("fa-undo")} />
                                <span data-i18n="settings.reset">{t("settings.reset")}</span>
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
