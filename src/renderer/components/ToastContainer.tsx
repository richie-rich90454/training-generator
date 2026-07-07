import type { JSX } from "solid-js"
import { For } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import toastStyles from "./styles/Toast.module.css"
const styles = { ...toastStyles }
export interface ToastContainerProps {
    appStore: AppStore
}
export function ToastContainer(props: ToastContainerProps): JSX.Element {
    const { uiStore } = props.appStore
    function iconForType(type: string): string {
        switch (type) {
            case "success":
                return renderIcon("fa-check-circle")
            case "warning":
                return renderIcon("fa-exclamation-triangle")
            case "error":
                return renderIcon("fa-times-circle")
            default:
                return renderIcon("fa-info-circle")
        }
    }
    return (
        <div class={styles["toast-container"]} role="region" aria-live="polite" aria-label={t("toast.dismissAria")}>
            <For each={uiStore.toasts}>
                {(toast) => (
                    <div class={"toast toast-" + toast.type + " toast-visible"}>
                        <span class={styles["toast-icon"]}>
                            <Icon html={iconForType(toast.type)} />
                        </span>
                        <span class={styles["toast-message"]}>{toast.message}</span>
                        <button
                            class={styles["toast-close"]}
                            aria-label={t("toast.dismissAria")}
                            onClick={() => uiStore.dismissToast(toast.id)}
                        >
                            <Icon html={renderIcon("fa-times")} />
                        </button>
                    </div>
                )}
            </For>
        </div>
    )
}
