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
    function getLayoutMetrics(): { contentLeft: number; gap: number; available: number; isRTL: boolean } {
        if (!gridRef) {
            return { contentLeft: 0, gap: 0, available: 0, isRTL: false }
        }
        const rect = gridRef.getBoundingClientRect()
        const style = window.getComputedStyle(gridRef)
        const bl = parseFloat(style.borderLeftWidth) || 0
        const pl = parseFloat(style.paddingLeft) || 0
        const pr = parseFloat(style.paddingRight) || 0
        const gap = parseFloat(style.columnGap) || 0
        const isRTL = style.direction === "rtl"
        const contentWidth = Math.max(0, gridRef.clientWidth - pl - pr)
        const contentLeft = rect.left + bl + pl
        const available = Math.max(0, contentWidth - 4 - 2 * gap)
        return { contentLeft, gap, available, isRTL }
    }
    function applyWidth(width: number): void {
        if (!gridRef) {
            return
        }
        const { available } = getLayoutMetrics()
        const rightWidth = Math.max(MIN_RIGHT_WIDTH, available - width)
        const leftWidth = available - rightWidth
        gridRef.style.gridTemplateColumns = `${Math.max(MIN_LEFT_WIDTH, leftWidth)}px 4px ${rightWidth}px`
    }
    function resetToDefault(): void {
        if (!gridRef) {
            return
        }
        gridRef.style.gridTemplateColumns = ""
        try {
            localStorage.removeItem(SPLITTER_KEY)
        }
        catch {
            // ignore storage errors
        }
    }
    function calcLeftWidth(clientX: number): number {
        const { contentLeft, gap, available, isRTL } = getLayoutMetrics()
        let width = clientX - contentLeft - gap
        if (isRTL) {
            // In RTL, the left column is visually on the right, so dragging the
            // splitter toward the right of the content area should shrink it.
            width = available - width
        }
        return Math.max(MIN_LEFT_WIDTH, Math.min(width, available - MIN_RIGHT_WIDTH))
    }
    function handleMouseMove(e: MouseEvent): void {
        if (!isDragging() || !gridRef) {
            return
        }
        const width = calcLeftWidth(e.clientX)
        applyWidth(width)
        saveWidth(width)
    }
    function handleTouchMove(e: TouchEvent): void {
        if (!isDragging() || !gridRef || e.touches.length === 0) {
            return
        }
        const width = calcLeftWidth(e.touches[0].clientX)
        applyWidth(width)
        saveWidth(width)
    }
    function handleMouseUp(): void {
        if (isDragging()) {
            setIsDragging(false)
        }
    }
    function handleTouchEnd(): void {
        if (isDragging()) {
            setIsDragging(false)
        }
    }
    function handleKeydown(e: KeyboardEvent): void {
        if (!gridRef || e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
            return
        }
        const { available, isRTL } = getLayoutMetrics()
        const computed = window.getComputedStyle(gridRef)
        const cols = computed.gridTemplateColumns.split(" ")
        let left = cols[0] ? parseInt(cols[0], 10) : available * 0.6
        if (isNaN(left)) {
            left = available * 0.6
        }
        const step = e.shiftKey ? 20 : 5
        // ArrowRight visually moves the splitter right. In LTR that grows the
        // left column; in RTL it shrinks it (the left column is mirrored to
        // the right edge of the content area).
        const visualRight = e.key === "ArrowRight"
        const growLeft = visualRight !== isRTL
        const next = growLeft ? left + step : left - step
        const clamped = Math.max(MIN_LEFT_WIDTH, Math.min(next, available - MIN_RIGHT_WIDTH))
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
        document.addEventListener("touchmove", handleTouchMove, { passive: false })
        document.addEventListener("touchend", handleTouchEnd)
    })
    onCleanup(() => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.removeEventListener("touchmove", handleTouchMove)
        document.removeEventListener("touchend", handleTouchEnd)
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
                data-i18n-aria-label="splitter.resizeAria"
                tabindex="0"
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDblClick={resetToDefault}
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
