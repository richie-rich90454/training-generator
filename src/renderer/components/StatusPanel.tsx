import type { JSX } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import cardsStyles from "./styles/Cards.module.css"
const styles = { ...cardsStyles }
export interface StatusPanelProps {
    appStore: AppStore
}
export function StatusPanel(props: StatusPanelProps): JSX.Element {
    const { uiStore } = props.appStore
    function statusText(): string {
        const status = uiStore.ollamaStatus()
        if (uiStore.ollamaLoading()) {
            return t("status.ollamaChecking")
        }
        if (!status) {
            return t("status.ollamaChecking")
        }
        if (status.running) {
            return t("status.ollamaOnline", undefined, { version: status.version || "", count: String(status.models.length) })
        }
        if (status.error) {
            return t("status.ollamaError")
        }
        return t("status.ollamaOffline")
    }
    function statusClass(): string {
        const status = uiStore.ollamaStatus()
        if (!status || uiStore.ollamaLoading()) {
            return "status-indicator status-indicator--checking"
        }
        if (status.running) {
            return "status-indicator status-indicator--online"
        }
        if (status.error) {
            return "status-indicator status-indicator--error"
        }
        return "status-indicator status-indicator--offline"
    }
    return (
        <div class={`${styles["card"]} status-panel`}>
            <div class={styles["card-header"]}>
                <div class={styles["card-title"]}>
                    <Icon html={renderIcon("fa-server")} />
                    <span data-i18n="status.title">{t("status.title")}</span>
                </div>
            </div>
            <div class={`status-list`}>
                <div
                    class={statusClass()}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <span class={`status-dot`} aria-hidden="true" />
                    <span class={`status-label`}>{statusText()}</span>
                </div>
                <div class={`status-row`}>
                    <span class={`status-key`} data-i18n="status.filesProcessed">{t("status.filesProcessed")}</span>
                    <span class={`status-value`}>{uiStore.filesProcessed()}</span>
                </div>
                <div class={`status-row`}>
                    <span class={`status-key`} data-i18n="status.lastProcessed">{t("status.lastProcessed")}</span>
                    <span class={`status-value`}>{uiStore.lastProcessed()}</span>
                </div>
            </div>
        </div>
    )
}
