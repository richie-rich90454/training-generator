import type { JSX } from "solid-js"
import { For } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import cardsStyles from "./styles/Cards.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
import processingCardStyles from "./styles/ProcessingCard.module.css"
const styles = { ...cardsStyles, ...buttonsStyles, ...processingCardStyles }
export interface ProcessingCardProps {
    appStore: AppStore
}
export function ProcessingCard(props: ProcessingCardProps): JSX.Element {
    const { appStore } = props
    const { uiStore, fileStore } = appStore
    function handleProcess(): void {
        if (appStore.isProcessing()) {
            appStore.stopProcessing()
        }
        else {
            appStore.processFiles()
        }
    }
    function handleDemo(): void {
        appStore.toggleDemoMode()
    }
    function handleDashboard(): void {
        appStore.uiStore.toggleDashboard()
    }
    return (
        <div class={styles["card"]}>
            <div class={styles["card-header"]}>
                <div class={styles["card-title"]}>
                    <Icon html={renderIcon("fa-cogs")} />
                    <span data-i18n="processing.title">{t("processing.title")}</span>
                </div>
                <div class={styles["section-actions"]}>
                    <button
                        id="process-btn"
                        class={`${styles["btn"]} ${styles["btn-primary"]} ${styles["btn--process"]}`}
                        disabled={!fileStore.canProcess()}
                        title={t("processing.startTitle")}
                        aria-label={t("processing.startAria")}
                        data-i18n-title="processing.startTitle"
                        data-i18n-aria-label="processing.startAria"
                        onClick={handleProcess}
                    >
                        <Icon html={appStore.isProcessing() ? renderIcon("fa-times") : renderIcon("fa-play")} />
                        <span data-i18n={appStore.isProcessing() ? "processing.running" : "processing.start"}>
                            {appStore.isProcessing() ? t("processing.running") : t("processing.start")}
                        </span>
                    </button>
                    <button
                        id="demo-btn"
                        class={"btn btn-secondary" + (fileStore.demoActive() ? " active" : "")}
                        title={t("processing.demoTitle")}
                        aria-label={t("processing.demoAria")}
                        data-i18n-title="processing.demoTitle"
                        data-i18n-aria-label="processing.demoAria"
                        onClick={handleDemo}
                    >
                        <Icon html={renderIcon("fa-magic")} />
                        <span data-i18n={fileStore.demoActive() ? "processing.demoActive" : "processing.demo"}>
                            {fileStore.demoActive() ? t("processing.demoActive") : t("processing.demo")}
                        </span>
                    </button>
                    <button
                        id="dashboard-btn"
                        class={`${styles["btn"]} ${styles["btn-secondary"]}`}
                        title={t("dashboard.toggleTitle")}
                        aria-label={t("dashboard.toggleAria")}
                        data-i18n-title="dashboard.toggleTitle"
                        data-i18n-aria-label="dashboard.toggleAria"
                        onClick={handleDashboard}
                    >
                        <Icon html={renderIcon("fa-tachometer-alt")} />
                        <span data-i18n="processing.dashboard">{t("processing.dashboard")}</span>
                    </button>
                </div>
            </div>
            <div class={styles["progress-section"]}>
                <div class={styles["progress-header"]}>
                    <span id="progress-text">{uiStore.progressText()}</span>
                    <span id="progress-percent" class={styles["progress-percent"]}>{uiStore.progressPercent() + t("common.percent")}</span>
                </div>
                <div
                    class={styles["progress-bar"]}
                    role="progressbar"
                    aria-valuenow={uiStore.progressPercent()}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("processing.progressAria")}
                    data-i18n-aria-label="processing.progressAria"
                >
                    <div id="progress-fill" class={styles["progress-fill"]} style={{ width: uiStore.progressPercent() + "%" }} />
                </div>
            </div>
            <div
                id="processing-log"
                class={styles["processing-log"]}
                role="log"
                aria-live="polite"
                aria-label={t("processing.logAria")}
                data-i18n-aria-label="processing.logAria"
            >
                <For each={uiStore.logs}>
                    {(entry) => (
                        <div class={"log-entry " + entry.type}>
                            <Icon html={renderIcon(uiStore.getLogIcon(entry.type))} />
                            <span>{entry.message}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    )
}
