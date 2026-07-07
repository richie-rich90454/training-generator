import type { JSX } from "solid-js"
import { Show } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import cardsStyles from "./styles/Cards.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
import outputCardStyles from "./styles/OutputCard.module.css"
const styles = { ...cardsStyles, ...buttonsStyles, ...outputCardStyles }
export interface OutputCardProps {
    appStore: AppStore
}
export function OutputCard(props: OutputCardProps): JSX.Element {
    const { appStore } = props
    const { outputStore, uiStore } = appStore
    function handleExport(): void {
        appStore.exportOutput(outputStore.exportFormat())
    }
    function handleCopy(): void {
        appStore.copyOutput()
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
                        onChange={(e) => outputStore.setExportFormat(e.currentTarget.value as "jsonl" | "json" | "csv" | "text")}
                    >
                        <option value="jsonl" data-i18n="output.exportFormat.jsonl">{t("output.exportFormat.jsonl")}</option>
                        <option value="json" data-i18n="output.exportFormat.json">{t("output.exportFormat.json")}</option>
                        <option value="csv" data-i18n="output.exportFormat.csv">{t("output.exportFormat.csv")}</option>
                    </select>
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
            <div
                class={styles["output-preview"]}
                role="region"
                aria-label={t("output.previewAria")}
                data-i18n-aria-label="output.previewAria"
                aria-busy={uiStore.outputPreviewLoading()}
            >
                <Show when={!uiStore.outputPreviewLoading()} fallback={<pre>{t("common.loading")}</pre>}>
                    <pre>{uiStore.outputPreview()}</pre>
                </Show>
            </div>
        </div>
    )
}
