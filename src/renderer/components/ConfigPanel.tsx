import type { JSX } from "solid-js"
import { For, Show } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import { ModelCombobox } from "./ModelCombobox.js"
import cardsStyles from "./styles/Cards.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
import formsStyles from "./styles/Forms.module.css"
import configPanelStyles from "./styles/ConfigPanel.module.css"
const styles = { ...cardsStyles, ...buttonsStyles, ...formsStyles, ...configPanelStyles }
export interface ConfigPanelProps {
    appStore: AppStore
}
const PROVIDERS = ["ollama", "openai", "anthropic", "gemini"]
const PROCESSING_TYPES = ["instruction", "conversation", "chunking", "custom"]
const OUTPUT_FORMATS = ["jsonl", "chatml", "text", "csv"]
const LANGUAGES = ["en", "zh-Hans", "zh-Hant", "es", "fr", "de", "ja", "ko"]
const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 5]
const CHUNK_OPTIONS = [500, 1000, 2000, 4000, 8000, 10000]
export function ConfigPanel(props: ConfigPanelProps): JSX.Element {
    const { settingsStore, savePreset } = props.appStore
    function handleSavePreset(): void {
        savePreset()
    }
    function temperatureStyle() {
        const display = settingsStore.updateTemperatureDisplay(settingsStore.settings.temperature ?? 0.7)
        return {
            "--range-fill": display.rangeFill,
            "--temperature-color": display.temperatureColor,
            "--temperature-color-hover": display.temperatureColorHover,
            "--temperature-shadow": display.temperatureShadow
        }
    }
    function temperatureDisplay() {
        return settingsStore.updateTemperatureDisplay(settingsStore.settings.temperature ?? 0.7)
    }
    return (
        <div class={`${styles["card"]} ${styles["config-panel"]}`}>
            <div class={`${styles["card-header"]} ${styles["config-panel__header"]}`}>
                <div class={styles["card-title"]}>
                    <Icon html={renderIcon("fa-sliders-h")} />
                    <span data-i18n="config.title">{t("config.title")}</span>
                </div>
            </div>
            <form class={styles["config-panel__fields"]} aria-label={t("config.formAria")} data-i18n-aria-label="config.formAria" onSubmit={(e) => e.preventDefault()}>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-model">
                        <Icon html={renderIcon("fa-brain")} />
                        <span data-i18n="config.model">{t("config.model")}</span>
                    </label>
                    <div class={styles["config-field__control"]}>
                        <ModelCombobox
                            value={settingsStore.settings.model || ""}
                            options={props.appStore.uiStore.availableOllamaModels()}
                            onChange={settingsStore.setModel}
                            placeholder={t("config.model")}
                            inputId="config-model"
                            ariaLabel={t("config.model")}
                            onRefresh={() => props.appStore.refreshOllamaModels()}
                        />
                    </div>
                </div>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-provider">
                        <Icon html={renderIcon("fa-cloud")} />
                        <span data-i18n="config.provider">{t("config.provider")}</span>
                    </label>
                    <select
                        id="config-provider"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.provider}
                        onChange={(e) => {
                            settingsStore.setProvider(e.currentTarget.value)
                            props.appStore.initProvider()
                        }}
                    >
                        <For each={PROVIDERS}>
                            {(provider) => (
                                <option value={provider} data-i18n={`config.provider.${provider}`}>
                                    {t(`config.provider.${provider}`)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
                <Show when={settingsStore.isCloudProvider()}>
                    <div class={styles["config-field"]}>
                        <label class={styles["config-field__label"]} for="config-api-key">
                            <Icon html={renderIcon("fa-key")} />
                            <span data-i18n="config.apiKey">{t("config.apiKey")}</span>
                        </label>
                        <input
                            id="config-api-key"
                            class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                            type="password"
                            value={settingsStore.apiKeyPlain()}
                            placeholder={t("config.apiKey.placeholder")}
                            data-i18n-placeholder="config.apiKey.placeholder"
                            onInput={(e) => settingsStore.setApiKey(e.currentTarget.value)}
                        />
                    </div>
                    <div class={styles["config-field"]}>
                        <label class={styles["config-field__label"]} for="config-base-url">
                            <Icon html={renderIcon("fa-link")} />
                            <span data-i18n="config.baseUrl">{t("config.baseUrl")}</span>
                        </label>
                        <input
                            id="config-base-url"
                            class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                            type="text"
                            value={settingsStore.settings.baseUrl}
                            placeholder={t("config.baseUrl.placeholder")}
                            data-i18n-placeholder="config.baseUrl.placeholder"
                            onInput={(e) => settingsStore.setBaseUrl(e.currentTarget.value)}
                        />
                    </div>
                </Show>
                <Show when={settingsStore.settings.provider === "ollama"}>
                    <div class={styles["config-field"]}>
                        <label class={styles["config-field__label"]} for="config-ollama-host">
                            <Icon html={renderIcon("fa-server")} />
                            <span data-i18n="config.ollamaHost">{t("config.ollamaHost")}</span>
                        </label>
                        <input
                            id="config-ollama-host"
                            class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                            type="text"
                            value={settingsStore.settings.ollamaHost ?? "localhost"}
                            placeholder={t("config.ollamaHost.placeholder")}
                            data-i18n-placeholder="config.ollamaHost.placeholder"
                            onInput={(e) => settingsStore.setOllamaHost(e.currentTarget.value)}
                        />
                    </div>
                    <div class={styles["config-field"]}>
                        <label class={styles["config-field__label"]} for="config-ollama-port">
                            <Icon html={renderIcon("fa-link")} />
                            <span data-i18n="config.ollamaPort">{t("config.ollamaPort")}</span>
                        </label>
                        <input
                            id="config-ollama-port"
                            class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                            type="number"
                            min="1"
                            max="65535"
                            value={settingsStore.settings.ollamaPort ?? 11434}
                            onChange={(e) => settingsStore.setOllamaPort(parseInt(e.currentTarget.value, 10) || 11434)}
                        />
                    </div>
                </Show>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-processing-type">
                        <Icon html={renderIcon("fa-cogs")} />
                        <span data-i18n="config.processingType">{t("config.processingType")}</span>
                    </label>
                    <select
                        id="config-processing-type"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.processingType}
                        onChange={(e) => settingsStore.setProcessingType(e.currentTarget.value)}
                    >
                        <For each={PROCESSING_TYPES}>
                            {(type) => (
                                <option value={type} data-i18n={`config.processingType.${type}`}>
                                    {t(`config.processingType.${type}`)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
                <Show when={settingsStore.settings.processingType === "custom"}>
                    <div class={styles["config-field"]}>
                        <label class={styles["config-field__label"]} for="config-custom-prompt">
                            <Icon html={renderIcon("fa-terminal")} />
                            <span data-i18n="config.customPrompt">{t("config.customPrompt")}</span>
                        </label>
                        <textarea
                            id="config-custom-prompt"
                            class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                            rows={4}
                            value={settingsStore.settings.customPrompt}
                            placeholder={t("config.customPrompt.placeholder")}
                            data-i18n-placeholder="config.customPrompt.placeholder"
                            onInput={(e) => settingsStore.setCustomPrompt(e.currentTarget.value)}
                        />
                        <button
                            type="button"
                            class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                            style={{ "margin-top": "var(--spacing-sm)" }}
                            aria-label={t("config.openPromptEditorAria")}
                            data-i18n-aria-label="config.openPromptEditorAria"
                            onClick={() => props.appStore.uiStore.openPromptEditor()}
                        >
                            <Icon html={renderIcon("fa-expand")} />
                            <span data-i18n="config.openPromptEditor">{t("config.openPromptEditor")}</span>
                        </button>
                    </div>
                </Show>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-output-format">
                        <Icon html={renderIcon("fa-file-export")} />
                        <span data-i18n="config.outputFormat">{t("config.outputFormat")}</span>
                    </label>
                    <select
                        id="config-output-format"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.outputFormat}
                        onChange={(e) => settingsStore.setOutputFormat(e.currentTarget.value)}
                    >
                        <For each={OUTPUT_FORMATS}>
                            {(format) => (
                                <option value={format} data-i18n={`config.outputFormat.${format}`}>
                                    {t(`config.outputFormat.${format}`)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-language">
                        <Icon html={renderIcon("fa-language")} />
                        <span data-i18n="config.outputLanguage">{t("config.outputLanguage")}</span>
                    </label>
                    <select
                        id="config-language"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.language}
                        onChange={(e) => settingsStore.setLanguage(e.currentTarget.value)}
                    >
                        <For each={LANGUAGES}>
                            {(lang) => (
                                <option value={lang} data-i18n={`language.${lang}`}>
                                    {t(`language.${lang}`)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-chunk-size">
                        <Icon html={renderIcon("fa-cut")} />
                        <span data-i18n="config.chunkSize">{t("config.chunkSize")}</span>
                    </label>
                    <select
                        id="config-chunk-size"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.chunkSize}
                        onChange={(e) => settingsStore.setChunkSize(parseInt(e.currentTarget.value, 10))}
                    >
                        <For each={CHUNK_OPTIONS}>
                            {(size) => <option value={size}>{size}</option>}
                        </For>
                    </select>
                </div>
                <div class={styles["config-field"]}>
                    <label class={styles["config-field__label"]} for="config-concurrency">
                        <Icon html={renderIcon("fa-bolt")} />
                        <span data-i18n="config.concurrency">{t("config.concurrency")}</span>
                    </label>
                    <select
                        id="config-concurrency"
                        class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                        value={settingsStore.settings.concurrency}
                        onChange={(e) => settingsStore.setConcurrency(parseInt(e.currentTarget.value, 10))}
                    >
                        <For each={CONCURRENCY_OPTIONS}>
                            {(n) => (
                                <option value={n} data-i18n={n === 1 ? "config.concurrency.serial" : n === 3 ? "config.concurrency.recommended" : n === 5 ? "config.concurrency.fast" : undefined}>
                                    {n === 1 ? t("config.concurrency.serial") : n === 3 ? t("config.concurrency.recommended") : n === 5 ? t("config.concurrency.fast") : String(n)}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
                <div class={`${styles["config-field"]} ${styles["config-field--range"]}`}>
                    <label class={styles["config-field__label"]} for="config-temperature">
                        <Icon html={renderIcon("fa-thermometer-half")} />
                        <span data-i18n="config.temperature">{t("config.temperature")}</span>
                    </label>
                    <div class={`${styles["range-control"]} ${styles["config-field__control"]}`} style={temperatureStyle()}>
                        <div class={styles["range-track-wrapper"]}>
                            <input
                                id="config-temperature"
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={settingsStore.settings.temperature}
                                aria-valuemin={0}
                                aria-valuemax={1}
                                aria-valuenow={settingsStore.settings.temperature}
                                onInput={(e) => settingsStore.setTemperature(parseFloat(e.currentTarget.value))}
                            />
                            <div class={styles["range-ticks"]} aria-hidden="true">
                                <span data-i18n="config.temperature.tick.0">{t("config.temperature.tick.0")}</span>
                                <span data-i18n="config.temperature.tick.05">{t("config.temperature.tick.05")}</span>
                                <span data-i18n="config.temperature.tick.1">{t("config.temperature.tick.1")}</span>
                            </div>
                        </div>
                        <span class={styles["range-value-pill"]} aria-live="polite">{temperatureDisplay().text}</span>
                    </div>
                </div>
                <fieldset class={styles["config-section"]}>
                    <legend class={styles["config-section__title"]}>
                        <Icon html={renderIcon("fa-file-export")} />
                        <span data-i18n="config.outputMode">{t("config.outputMode")}</span>
                    </legend>
                    <p class={styles["config-section__description"]} data-i18n="config.outputMode.description">
                        {t("config.outputMode.description")}
                    </p>
                    <div class={`${styles["config-field"]} ${styles["config-field--full"]}`}>
                        <div class={styles["radio-group"]} role="radiogroup" aria-label={t("config.outputModeAria")} data-i18n-aria-label="config.outputModeAria">
                            <label class={styles["radio-group__option"]}>
                                <input
                                    type="radio"
                                    name="output-file-mode"
                                    value="combined"
                                    checked={settingsStore.appSettings.outputFileMode === "combined"}
                                    onChange={() => settingsStore.setAppSetting("outputFileMode", "combined")}
                                />
                                <span data-i18n="config.outputMode.combined">{t("config.outputMode.combined")}</span>
                            </label>
                            <label class={styles["radio-group__option"]}>
                                <input
                                    type="radio"
                                    name="output-file-mode"
                                    value="perFile"
                                    checked={settingsStore.appSettings.outputFileMode === "perFile"}
                                    onChange={() => settingsStore.setAppSetting("outputFileMode", "perFile")}
                                />
                                <span data-i18n="config.outputMode.perFile">{t("config.outputMode.perFile")}</span>
                            </label>
                        </div>
                    </div>
                    <Show when={settingsStore.appSettings.outputFileMode === "perFile"}>
                        <div class={styles["config-field"]}>
                            <label class={styles["config-field__label"]} for="config-output-filename-template">
                                <Icon html={renderIcon("fa-file-signature")} />
                                <span data-i18n="config.outputFilenameTemplate">{t("config.outputFilenameTemplate")}</span>
                            </label>
                            <input
                                id="config-output-filename-template"
                                class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                                type="text"
                                value={settingsStore.appSettings.outputFilenameTemplate ?? "{source}"}
                                placeholder={t("config.outputFilenameTemplate.placeholder")}
                                data-i18n-placeholder="config.outputFilenameTemplate.placeholder"
                                aria-label={t("config.outputFilenameTemplateAria")}
                                data-i18n-aria-label="config.outputFilenameTemplateAria"
                                aria-describedby="config-output-filename-template-help"
                                onInput={(e) => settingsStore.setAppSetting("outputFilenameTemplate", e.currentTarget.value)}
                            />
                            <p id="config-output-filename-template-help" class={styles["config-field__help"]} data-i18n="config.outputFilenameTemplate.help">
                                {t("config.outputFilenameTemplate.help")}
                            </p>
                        </div>
                        <div class={styles["config-field"]}>
                            <label class={styles["config-field__label"]} for="config-max-items-per-file">
                                <Icon html={renderIcon("fa-list-ol")} />
                                <span data-i18n="config.maxItemsPerFile">{t("config.maxItemsPerFile")}</span>
                            </label>
                            <input
                                id="config-max-items-per-file"
                                class={`${styles["form-control"]} ${styles["config-field__control"]}`}
                                type="number"
                                min="100"
                                max="1000000"
                                step="100"
                                value={settingsStore.appSettings.maxItemsPerFile ?? 50000}
                                aria-label={t("config.maxItemsPerFileAria")}
                                data-i18n-aria-label="config.maxItemsPerFileAria"
                                onChange={(e) => settingsStore.setAppSetting("maxItemsPerFile", parseInt(e.currentTarget.value, 10) || 50000)}
                            />
                        </div>
                        <div class={`${styles["checkbox-field"]} ${styles["config-field--full"]}`}>
                            <label for="config-include-source-metadata">
                                <input
                                    id="config-include-source-metadata"
                                    class={styles["form-checkbox"]}
                                    type="checkbox"
                                    checked={settingsStore.appSettings.includeSourceMetadata ?? false}
                                    onChange={(e) => settingsStore.setAppSetting("includeSourceMetadata", e.currentTarget.checked)}
                                />
                                <span data-i18n="config.includeSourceMetadata">{t("config.includeSourceMetadata")}</span>
                            </label>
                        </div>
                        <div class={`${styles["checkbox-field"]} ${styles["config-field--full"]}`}>
                            <label for="config-strip-pii-before-export">
                                <input
                                    id="config-strip-pii-before-export"
                                    class={styles["form-checkbox"]}
                                    type="checkbox"
                                    checked={settingsStore.appSettings.stripPiiBeforeExport ?? false}
                                    onChange={(e) => settingsStore.setAppSetting("stripPiiBeforeExport", e.currentTarget.checked)}
                                />
                                <span data-i18n="config.stripPiiBeforeExport">{t("config.stripPiiBeforeExport")}</span>
                            </label>
                        </div>
                    </Show>
                    <div class={`${styles["checkbox-field"]} ${styles["config-field--full"]}`}>
                        <label for="config-confirm-before-export">
                            <input
                                id="config-confirm-before-export"
                                class={styles["form-checkbox"]}
                                type="checkbox"
                                checked={settingsStore.appSettings.confirmBeforeExport ?? false}
                                onChange={(e) => settingsStore.setAppSetting("confirmBeforeExport", e.currentTarget.checked)}
                            />
                            <span data-i18n="config.confirmBeforeExport">{t("config.confirmBeforeExport")}</span>
                        </label>
                    </div>
                    <div class={`${styles["checkbox-field"]} ${styles["config-field--full"]}`}>
                        <label for="config-auto-export-on-completion">
                            <input
                                id="config-auto-export-on-completion"
                                class={styles["form-checkbox"]}
                                type="checkbox"
                                checked={settingsStore.appSettings.autoExportOnCompletion ?? false}
                                onChange={(e) => settingsStore.setAppSetting("autoExportOnCompletion", e.currentTarget.checked)}
                            />
                            <span data-i18n="config.autoExportOnCompletion">{t("config.autoExportOnCompletion")}</span>
                        </label>
                    </div>
                </fieldset>
                <button
                    type="button"
                    class={`${styles["btn"]} ${styles["btn--save-preset"]} ${styles["config-panel__save-preset"]}`}
                    aria-label={t("config.savePresetAria")}
                    data-i18n-aria-label="config.savePresetAria"
                    onClick={handleSavePreset}
                >
                    <Icon html={renderIcon("fa-save")} />
                    <span data-i18n="config.savePreset">{t("config.savePreset")}</span>
                </button>
            </form>
        </div>
    )
}
