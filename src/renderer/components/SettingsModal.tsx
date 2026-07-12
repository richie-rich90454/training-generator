import type { JSX } from "solid-js"
import { createSignal, For, Show, createEffect, onCleanup } from "solid-js"
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
export function SettingsModal(props: SettingsModalProps): JSX.Element {
    const { settingsStore, hideSettings, savePreset } = props.appStore
    const [profileName, setProfileName] = createSignal("")
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
                firstFocusable = focusable[0]
                lastFocusable = focusable[focusable.length - 1]
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
                <div class={styles["modal-content"]}>
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
                        <section class={styles["settings-section"]}>
                            <h3>
                                <Icon html={renderIcon("fa-palette")} />
                                <span data-i18n="settings.appearance">{t("settings.appearance")}</span>
                            </h3>
                            <div class={styles["settings-field"]}>
                                <label class={styles["settings-field__label"]} for="settings-theme">
                                    <Icon html={renderIcon("fa-display")} />
                                    <span data-i18n="settings.theme">{t("settings.theme")}</span>
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
                                    <span data-i18n="settings.fontSize">{t("settings.fontSize")}</span>
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
                                    <span data-i18n="settings.uiLanguage">{t("settings.uiLanguage")}</span>
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
                        <section class={styles["settings-section"]}>
                            <h3>
                                <Icon html={renderIcon("fa-layer-group")} />
                                <span data-i18n="settings.profiles">{t("settings.profiles")}</span>
                            </h3>
                            <div class={styles["settings-field"]}>
                                <label class={styles["settings-field__label"]} for="settings-profile-select">
                                    <Icon html={renderIcon("fa-list-ol")} />
                                    <span data-i18n="settings.profileSelect">{t("settings.profileSelect")}</span>
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
                                    <span data-i18n="settings.saveProfile">{t("settings.saveProfile")}</span>
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
                        <section class={styles["settings-section"]}>
                            <h3>
                                <Icon html={renderIcon("fa-cogs")} />
                                <span data-i18n="settings.processing">{t("settings.processing")}</span>
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
                                    <span data-i18n="settings.autoSave">{t("settings.autoSave")}</span>
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
                                    <span data-i18n="settings.autoCheckOllama">{t("settings.autoCheckOllama")}</span>
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
                                    <span data-i18n="settings.enableThinking">{t("settings.enableThinking")}</span>
                                </label>
                            </div>
                            <div class={styles["settings-field"]}>
                                <label class={styles["settings-field__label"]} for="settings-max-file-size">
                                    <Icon html={renderIcon("fa-hdd")} />
                                    <span data-i18n="settings.maxFileSize">{t("settings.maxFileSize")}</span>
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
                                    <span data-i18n="settings.maxOutputItems">{t("settings.maxOutputItems")}</span>
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
                                    <span data-i18n="settings.maxChunks">{t("settings.maxChunks")}</span>
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
                                    <span data-i18n="settings.maxParallelFiles">{t("settings.maxParallelFiles")}</span>
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
                        <section class={styles["settings-section"]}>
                            <h3>
                                <Icon html={renderIcon("fa-window-restore")} />
                                <span data-i18n="settings.window">{t("settings.window")}</span>
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
                                    <span data-i18n="settings.startMaximized">{t("settings.startMaximized")}</span>
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
                                    <span data-i18n="settings.rememberWindowSize">{t("settings.rememberWindowSize")}</span>
                                </label>
                            </div>
                        </section>
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
