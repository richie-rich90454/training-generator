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
                                        <label class={styles["settings-field__label"]} for="settings-enable-thinking">
                                            <input
                                                id="settings-enable-thinking"
                                                class={styles["form-checkbox"]}
                                                type="checkbox"
                                                checked={settingsStore.appSettings.enableThinking}
                                                onChange={(e) => settingsStore.setEnableThinking(e.currentTarget.checked)}
                                            />
                                            <span data-i18n="settings.enableThinking" data-field-label="enableThinking">{t("settings.enableThinking")}</span>
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
