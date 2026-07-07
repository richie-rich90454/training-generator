import type { JSX } from "solid-js"
import { Show, onMount, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import dashboardStyles from "./styles/Dashboard.module.css"
const styles = { ...dashboardStyles }
export interface DashboardProps {
    appStore: AppStore
}
export function Dashboard(props: DashboardProps): JSX.Element {
    let overlayRef: HTMLDivElement | undefined
    let lastFocusedElement: HTMLElement | null = null
    let focusTrapHandler: ((e: Event) => void) | null = null
    let keydownHandler: ((e: Event) => void) | null = null
    function removeFocusTrap(): void {
        if (focusTrapHandler) {
            document.removeEventListener("keydown", focusTrapHandler)
            focusTrapHandler = null
        }
        if (keydownHandler) {
            document.removeEventListener("keydown", keydownHandler)
            keydownHandler = null
        }
    }
    function trapFocus(): void {
        if (focusTrapHandler) {
            return
        }
        let selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        focusTrapHandler = (e: Event) => {
            let ke = e as KeyboardEvent
            if (ke.key !== "Tab" || !overlayRef) {
                return
            }
            let focusable = Array.from(overlayRef.querySelectorAll<HTMLElement>(selector))
            if (focusable.length === 0) {
                return
            }
            let first = focusable[0]
            let last = focusable[focusable.length - 1]
            if (ke.shiftKey && document.activeElement === first) {
                ke.preventDefault()
                last.focus()
            }
            else if (!ke.shiftKey && document.activeElement === last) {
                ke.preventDefault()
                first.focus()
            }
        }
        keydownHandler = (e: Event) => {
            let ke = e as KeyboardEvent
            if (ke.key === "Escape") {
                ke.preventDefault()
                props.appStore.uiStore.setDashboardOpen(false)
            }
        }
        document.addEventListener("keydown", focusTrapHandler)
        document.addEventListener("keydown", keydownHandler)
    }
    onMount(() => {
        if (props.appStore.uiStore.dashboardOpen()) {
            lastFocusedElement = document.activeElement as HTMLElement
            trapFocus()
            let focusable = overlayRef?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            )
            if (focusable && focusable.length > 0) {
                focusable[0].focus()
            }
        }
    })
    onCleanup(() => {
        removeFocusTrap()
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus()
            lastFocusedElement = null
        }
    })
    let metrics = () => props.appStore.uiStore.dashboardMetrics()
    return (
        <Show when={props.appStore.uiStore.dashboardOpen()}>
            <Portal mount={document.body}>
                <div
                    ref={overlayRef}
                    class={styles["dashboard-overlay"]}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("dashboard.aria")}
                    data-testid="dashboard-overlay"
                >
                    <div class={styles["dashboard-panel"]} role="document">
                        <div class={styles["dashboard-header"]}>
                            <h3><Icon html={renderIcon("fa-tachometer-alt", 20)} /> {t("dashboard.title")}</h3>
                            <button
                                class={styles["dashboard-close"]}
                                aria-label={t("dashboard.closeAria")}
                                onClick={() => props.appStore.uiStore.setDashboardOpen(false)}
                                data-testid="dashboard-close"
                            >
                                &times;
                            </button>
                        </div>
                        <div class={styles["dashboard-body"]}>
                            <table>
                                <tbody>
                                    <tr><td>{t("dashboard.label.chunks")}</td><td data-testid="dash-chunks">{metrics().chunksDone} / {metrics().chunksTotal}</td></tr>
                                    <tr><td>{t("dashboard.label.chunksPerSecond")}</td><td data-testid="dash-cps">{metrics().chunksPerSecond}</td></tr>
                                    <tr><td>{t("dashboard.label.tokensPerSecond")}</td><td data-testid="dash-tps">{metrics().tokensPerSecond}</td></tr>
                                    <tr><td>{t("dashboard.label.cacheHitRate")}</td><td data-testid="dash-cache">{metrics().cacheHitRate}%</td></tr>
                                    <tr><td>{t("dashboard.label.providerLatency")}</td><td data-testid="dash-latency">{metrics().providerLatency} ms</td></tr>
                                    <tr><td>{t("dashboard.label.activeProvider")}</td><td data-testid="dash-provider">{metrics().activeProvider}</td></tr>
                                    <tr><td>{t("dashboard.label.eta")}</td><td data-testid="dash-eta">{metrics().eta}</td></tr>
                                    <tr><td>{t("dashboard.label.elapsed")}</td><td data-testid="dash-elapsed">{metrics().elapsed}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    )
}
