import type { JSX } from "solid-js"
import { Show, createEffect } from "solid-js"
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
    let liveStreamRef: HTMLDivElement | undefined
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
            <div
                id="output-preview"
                class={styles["output-preview"]}
                role="region"
                aria-label={t("output.previewAria")}
                data-i18n-aria-label="output.previewAria"
                aria-busy={appStore.isProcessing() && outputStore.itemCount() === 0}
            >
                <Show when={!(appStore.isProcessing() && outputStore.itemCount() === 0)} fallback={<pre>{t("common.loading")}</pre>}>
                    <pre>{outputStore.previewText()}</pre>
                </Show>
            </div>
            <Show when={hasLiveStream()}>
                <div
                    ref={liveStreamRef}
                    class={styles["output-preview"]}
                    style={{ "max-height": "200px", "margin-top": "8px", "overflow-y": "auto" }}
                    role="region"
                    aria-label={t("output.liveStreamAria")}
                >
                    <pre style={{ "white-space": "pre-wrap", "word-break": "break-all", "font-size": "11px", opacity: "0.85" }}>{liveStream()}</pre>
                </div>
            </Show>
        </div>
    )
}
