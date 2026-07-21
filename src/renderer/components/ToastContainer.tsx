import type { JSX } from "solid-js"
import { For, onMount, onCleanup, createSignal } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import type { ToastItem } from "../stores/uiStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import toastStyles from "./styles/Toast.module.css"
const styles = { ...toastStyles }
export interface ToastContainerProps {
    appStore: AppStore
}
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
function readTransitionDuration(el: HTMLElement): number {
    const duration = getComputedStyle(el).transitionDuration || "0.4s"
    const value = parseFloat(duration)
    if (isNaN(value)) return 400
    if (duration.includes("ms")) return value
    return value * 1000
}
interface ToastRowProps {
    toast: ToastItem
    onDismiss: (id: number) => void
}
const UNDO_BUTTON_VISIBLE_MS = 5000
function ToastRow(props: ToastRowProps): JSX.Element {
    let ref: HTMLDivElement | undefined
    let hiding = false
    const hasUndo = (): boolean => typeof props.toast.undoAction === "function"
    const [undoVisible, setUndoVisible] = createSignal<boolean>(true)
    let undoTimer: ReturnType<typeof setTimeout> | undefined
    let undoCalled = false

    function clearUndoTimer(): void {
        if (undoTimer !== undefined) {
            clearTimeout(undoTimer)
            undoTimer = undefined
        }
    }

    onMount(() => {
        // Enter animation: render in initial state (opacity:0, translateX(100px))
        // for one frame, then add toast-visible to transition to the final state.
        requestAnimationFrame(() => {
            ref?.classList.add("toast-visible")
        })
        if (hasUndo()) {
            undoTimer = setTimeout(() => {
                setUndoVisible(false)
                undoTimer = undefined
            }, UNDO_BUTTON_VISIBLE_MS)
        }
    })

    onCleanup(() => {
        clearUndoTimer()
    })

    function handleDismiss(): void {
        clearUndoTimer()
        if (hiding) {
            // Already animating out; ignore repeat clicks so onDismiss fires once.
            return
        }
        if (!ref) {
            props.onDismiss(props.toast.id)
            return
        }
        hiding = true
        ref.classList.remove("toast-visible")
        ref.classList.add("toast-hiding")
        let called = false
        let done = () => {
            if (called) return
            called = true
            props.onDismiss(props.toast.id)
        }
        ref.addEventListener("transitionend", done, { once: true })
        // Fallback in case transitionend does not fire (e.g. prefers-reduced-motion
        // or hidden tab). Pad by 50ms so the animation always wins the race.
        window.setTimeout(done, readTransitionDuration(ref) + 50)
    }

    function handleUndo(): void {
        if (undoCalled) return
        undoCalled = true
        clearUndoTimer()
        try {
            props.toast.undoAction?.()
        } finally {
            handleDismiss()
        }
    }

    return (
        <div
            ref={ref}
            class={"toast toast-" + props.toast.type}
            role={props.toast.type === "error" ? "alert" : "status"}
            aria-atomic="true"
        >
            <span class={styles["toast-icon"]}>
                <Icon html={iconForType(props.toast.type)} />
            </span>
            <span class={styles["toast-message"]}>{props.toast.message}</span>
            {hasUndo() && undoVisible() && (
                <button
                    type="button"
                    class={styles["toast-undo"]}
                    onClick={handleUndo}
                    disabled={undoCalled}
                >
                    {props.toast.undoLabel ?? t("toast.undo")}
                </button>
            )}
            <button
                class={styles["toast-close"]}
                aria-label={t("toast.dismissAria")}
                data-i18n-aria-label="toast.dismissAria"
                onClick={handleDismiss}
            >
                <Icon html={renderIcon("fa-times")} />
            </button>
        </div>
    )
}
export function ToastContainer(props: ToastContainerProps): JSX.Element {
    const { uiStore } = props.appStore
    return (
        <div
            class={styles["toast-container"]}
            role="region"
            aria-live="polite"
            aria-atomic="false"
            aria-label={t("toast.containerLabel")}
            data-i18n-aria-label="toast.containerLabel"
        >
            <For each={uiStore.toasts}>
                {(toast) => (
                    <ToastRow toast={toast} onDismiss={(id) => uiStore.dismissToast(id)} />
                )}
            </For>
        </div>
    )
}
