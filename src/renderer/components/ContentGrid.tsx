import type { JSX } from "solid-js"
import { createSignal, onMount, onCleanup } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { UploadCard } from "./UploadCard.js"
import { ProcessingCard } from "./ProcessingCard.js"
import { OutputCard } from "./OutputCard.js"
import { ConfigPanel } from "./ConfigPanel.js"
import { StatusPanel } from "./StatusPanel.js"
import { t } from "../i18n.js"
import appStyles from "./styles/App.module.css"
const styles = { ...appStyles }
export interface ContentGridProps {
    appStore: AppStore
}
const SPLITTER_KEY = "tg-splitter-left-width"
const MIN_LEFT_WIDTH = 320
const MIN_RIGHT_WIDTH = 280
export function ContentGrid(props: ContentGridProps): JSX.Element {
    const [isDragging, setIsDragging] = createSignal(false)
    let gridRef: HTMLDivElement | undefined
    function getSavedWidth(): number | null {
        try {
            const raw = localStorage.getItem(SPLITTER_KEY)
            if (raw) {
                return parseInt(raw, 10)
            }
        }
        catch {
            // ignore storage errors
        }
        return null
    }
    function saveWidth(width: number): void {
        try {
            localStorage.setItem(SPLITTER_KEY, String(width))
        }
        catch {
            // ignore storage errors
        }
    }
    function getContentWidth(): number {
        if (!gridRef) {
            return 0
        }
        const style = window.getComputedStyle(gridRef)
        const pl = parseFloat(style.paddingLeft) || 0
        const pr = parseFloat(style.paddingRight) || 0
        return Math.max(0, gridRef.clientWidth - pl - pr)
    }
    function getContentLeft(): number {
        if (!gridRef) {
            return 0
        }
        const rect = gridRef.getBoundingClientRect()
        const style = window.getComputedStyle(gridRef)
        const bl = parseFloat(style.borderLeftWidth) || 0
        const pl = parseFloat(style.paddingLeft) || 0
        return rect.left + bl + pl
    }
    function applyWidth(width: number): void {
        if (!gridRef) {
            return
        }
        const total = getContentWidth()
        const rightWidth = Math.max(MIN_RIGHT_WIDTH, total - width - 4)
        const leftWidth = total - rightWidth - 4
        gridRef.style.gridTemplateColumns = `${Math.max(MIN_LEFT_WIDTH, leftWidth)}px 4px ${rightWidth}px`
    }
    function resetToDefault(): void {
        if (!gridRef) {
            return
        }
        gridRef.style.gridTemplateColumns = ""
    }
    function handleMouseMove(e: MouseEvent): void {
        if (!isDragging() || !gridRef) {
            return
        }
        const total = getContentWidth()
        let width = e.clientX - getContentLeft()
        width = Math.max(MIN_LEFT_WIDTH, Math.min(width, total - MIN_RIGHT_WIDTH - 4))
        applyWidth(width)
        saveWidth(width)
    }
    function handleMouseUp(): void {
        if (isDragging()) {
            setIsDragging(false)
        }
    }
    function handleKeydown(e: KeyboardEvent): void {
        if (!gridRef || e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
            return
        }
        const total = getContentWidth()
        const computed = window.getComputedStyle(gridRef)
        const cols = computed.gridTemplateColumns.split(" ")
        let left = cols[0] ? parseInt(cols[0], 10) : total * 0.6
        if (isNaN(left)) {
            left = total * 0.6
        }
        const step = e.shiftKey ? 20 : 5
        const next = e.key === "ArrowLeft" ? left - step : left + step
        const clamped = Math.max(MIN_LEFT_WIDTH, Math.min(next, total - MIN_RIGHT_WIDTH - 4))
        applyWidth(clamped)
        saveWidth(clamped)
        e.preventDefault()
    }
    onMount(() => {
        const saved = getSavedWidth()
        if (saved != null && gridRef) {
            applyWidth(saved)
        }
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    })
    onCleanup(() => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
    })
    return (
        <main
            ref={gridRef}
            class={styles["content-grid"]}
            classList={{ [styles["splitter-active"]]: isDragging() }}
        >
            <div class={styles["left-column"]}>
                <UploadCard appStore={props.appStore} />
                <ProcessingCard appStore={props.appStore} />
                <OutputCard appStore={props.appStore} />
            </div>
            <div
                class={styles["splitter-bar"]}
                role="separator"
                aria-orientation="vertical"
                aria-label={t("splitter.resizeAria")}
                tabindex="0"
                onMouseDown={() => setIsDragging(true)}
                onKeyDown={handleKeydown}
                classList={{ [styles["splitter-active"]]: isDragging() }}
            />
            <div class={styles["right-column"]}>
                <ConfigPanel appStore={props.appStore} />
                <StatusPanel appStore={props.appStore} />
            </div>
        </main>
    )
}
