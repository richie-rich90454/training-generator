import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import type { JSX } from "solid-js"

// Mock child components to isolate ContentGrid behavior (splitter, listeners, cleanup)
vi.mock("../src/renderer/components/UploadCard.tsx", () => ({
    UploadCard: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-upload-card">UploadCard</div>
    )
}))
vi.mock("../src/renderer/components/ProcessingCard.tsx", () => ({
    ProcessingCard: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-processing-card">ProcessingCard</div>
    )
}))
vi.mock("../src/renderer/components/OutputCard.tsx", () => ({
    OutputCard: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-output-card">OutputCard</div>
    )
}))
vi.mock("../src/renderer/components/ConfigPanel.tsx", () => ({
    ConfigPanel: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-config-panel">ConfigPanel</div>
    )
}))
vi.mock("../src/renderer/components/StatusPanel.tsx", () => ({
    StatusPanel: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-status-panel">StatusPanel</div>
    )
}))

import { ContentGrid } from "../src/renderer/components/ContentGrid.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"

const SPLITTER_KEY = "tg-splitter-left-width"

function makeAppStore(): AppStore {
    return {
        fileStore: {} as any,
        outputStore: {} as any,
        settingsStore: {} as any,
        uiStore: {} as any,
        processor: {} as any,
        providerManager: null,
        promptManager: {} as any,
        logger: {} as any,
        audit: {} as any
    } as unknown as AppStore
}

function setupRect(main: HTMLElement, width: number = 1200): void {
    Object.defineProperty(main, "clientWidth", { configurable: true, value: width })
    Object.defineProperty(main, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
            left: 0, top: 0, right: width, bottom: 600,
            width, height: 600, x: 0, y: 0, toJSON: () => ({})
        })
    })
}

function mockGetComputedStyle(gridTemplateColumns: string): () => void {
    const original = window.getComputedStyle
    window.getComputedStyle = (() => ({
        gridTemplateColumns,
        getPropertyValue: () => ""
    })) as any
    return () => { window.getComputedStyle = original }
}

describe("ContentGrid", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        cleanup()
    })
    test("renders without crashing", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        expect(screen.queryByRole("separator")).not.toBeNull()
    })
    test("renders left column children", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        expect(screen.queryByTestId("mock-upload-card")).not.toBeNull()
        expect(screen.queryByTestId("mock-processing-card")).not.toBeNull()
        expect(screen.queryByTestId("mock-output-card")).not.toBeNull()
    })
    test("renders right column children", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        expect(screen.queryByTestId("mock-config-panel")).not.toBeNull()
        expect(screen.queryByTestId("mock-status-panel")).not.toBeNull()
    })
    test("splitter bar has separator role and aria-orientation", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        expect(splitter.getAttribute("aria-orientation")).toBe("vertical")
    })
    test("splitter bar is keyboard focusable", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        expect(splitter.getAttribute("tabindex")).toBe("0")
    })
    test("splitter has resize aria-label", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        expect(splitter.getAttribute("aria-label")).toBe("Resize panels")
    })
    test("mousedown on splitter starts drag (subsequent mousemove applies width)", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }))
        await Promise.resolve()
        // isDragging=true means mousemove applies and saves width
        expect(main.style.gridTemplateColumns).not.toBe("")
        expect(localStorage.getItem(SPLITTER_KEY)).not.toBeNull()
    })
    test("mouseup on document ends drag (subsequent mousemove does not apply width)", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        document.dispatchEvent(new MouseEvent("mouseup"))
        await Promise.resolve()
        localStorage.removeItem(SPLITTER_KEY)
        const widthBefore = main.style.gridTemplateColumns
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 700 }))
        await Promise.resolve()
        // isDragging=false means mousemove is a no-op
        expect(main.style.gridTemplateColumns).toBe(widthBefore)
        expect(localStorage.getItem(SPLITTER_KEY)).toBeNull()
    })
    test("mousemove without drag does not modify style", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const widthBefore = main.style.gridTemplateColumns
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }))
        await Promise.resolve()
        expect(main.style.gridTemplateColumns).toBe(widthBefore)
        expect(localStorage.getItem(SPLITTER_KEY)).toBeNull()
    })
    test("ArrowRight keydown increases left width and saves", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const restore = mockGetComputedStyle("600px 4px 596px")
        fireEvent.keyDown(splitter, { key: "ArrowRight" })
        expect(localStorage.getItem(SPLITTER_KEY)).not.toBeNull()
        expect(main.style.gridTemplateColumns).not.toBe("")
        restore()
    })
    test("ArrowLeft keydown decreases left width and saves", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const restore = mockGetComputedStyle("600px 4px 596px")
        fireEvent.keyDown(splitter, { key: "ArrowLeft" })
        expect(localStorage.getItem(SPLITTER_KEY)).not.toBeNull()
        // ArrowLeft: 600 - 5 = 595
        expect(localStorage.getItem(SPLITTER_KEY)).toBe("595")
        restore()
    })
    test("shift+Arrow uses larger step", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const restore = mockGetComputedStyle("600px 4px 596px")
        fireEvent.keyDown(splitter, { key: "ArrowRight", shiftKey: true })
        // shift+ArrowRight: 600 + 20 = 620
        expect(localStorage.getItem(SPLITTER_KEY)).toBe("620")
        restore()
    })
    test("non-arrow key does not trigger saveWidth", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        fireEvent.keyDown(splitter, { key: "Enter" })
        expect(localStorage.getItem(SPLITTER_KEY)).toBeNull()
    })
    test("applies saved width on mount when localStorage has value", () => {
        localStorage.setItem(SPLITTER_KEY, "500")
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        expect(main.style.gridTemplateColumns).not.toBe("")
    })
    test("does not apply width when no saved value", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        expect(main.style.gridTemplateColumns).toBe("")
    })
    test("handles localStorage get error gracefully", () => {
        const originalGetItem = Storage.prototype.getItem
        Storage.prototype.getItem = vi.fn(() => {
            throw new Error("storage denied")
        })
        expect(() => render(() => <ContentGrid appStore={makeAppStore()} />)).not.toThrow()
        Storage.prototype.getItem = originalGetItem
    })
    test("handles localStorage set error gracefully", () => {
        const originalSetItem = Storage.prototype.setItem
        Storage.prototype.setItem = vi.fn(() => {
            throw new Error("storage denied")
        })
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        expect(() => {
            fireEvent.mouseDown(splitter)
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }))
        }).not.toThrow()
        Storage.prototype.setItem = originalSetItem
    })
    test("unmounts without errors after drag", () => {
        const { unmount } = render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        fireEvent.mouseDown(splitter)
        document.dispatchEvent(new MouseEvent("mouseup"))
        expect(() => unmount()).not.toThrow()
    })
    test("cleanup removes document mousemove and mouseup listeners", () => {
        const removeSpy = vi.spyOn(document, "removeEventListener")
        const { unmount } = render(() => <ContentGrid appStore={makeAppStore()} />)
        unmount()
        const mouseMoveCalls = removeSpy.mock.calls.filter(([evt]) => evt === "mousemove")
        expect(mouseMoveCalls.length).toBeGreaterThanOrEqual(1)
        const mouseUpCalls = removeSpy.mock.calls.filter(([evt]) => evt === "mouseup")
        expect(mouseUpCalls.length).toBeGreaterThanOrEqual(1)
        removeSpy.mockRestore()
    })
    test("drag clamps left width to MIN_LEFT_WIDTH", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        // clientX=0 should clamp to MIN_LEFT_WIDTH=320
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0 }))
        await Promise.resolve()
        expect(localStorage.getItem(SPLITTER_KEY)).not.toBeNull()
        expect(Number(localStorage.getItem(SPLITTER_KEY))).toBeGreaterThanOrEqual(320)
    })
    test("drag clamps to not exceed total minus MIN_RIGHT_WIDTH", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        // clientX well beyond total - MIN_RIGHT_WIDTH - 4 should clamp
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 2000 }))
        await Promise.resolve()
        expect(localStorage.getItem(SPLITTER_KEY)).not.toBeNull()
        // total=1200, MIN_RIGHT_WIDTH=280, splitter=4 => max left = 1200-280-4 = 916
        expect(Number(localStorage.getItem(SPLITTER_KEY))).toBeLessThanOrEqual(916)
    })
    test("drag accounts for grid gap and padding so tracks never overflow content box", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        // Simulate real CSS: 24px padding, 24px gap, 0 border
        // clientWidth=1200 → contentWidth=1152 → available=1152-4-48=1100 → maxLeft=1100-280=820
        setupRect(main, 1200)
        const original = window.getComputedStyle
        window.getComputedStyle = (() => ({
            gridTemplateColumns: "",
            getPropertyValue: () => "",
            paddingLeft: "24px",
            paddingRight: "24px",
            borderLeftWidth: "0px",
            columnGap: "24px"
        })) as any
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        // clientX=900 → width = 900 - contentLeft(24) - gap(24) = 852 → clamped to 820
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 900 }))
        await Promise.resolve()
        const saved = Number(localStorage.getItem(SPLITTER_KEY))
        expect(saved).toBe(820)
        // Verify tracks + splitter + gaps = contentWidth (no overflow)
        const cols = main.style.gridTemplateColumns.split(" ")
        const leftTrack = parseInt(cols[0], 10)
        const rightTrack = parseInt(cols[2], 10)
        // leftTrack + 4 + rightTrack + 2*24 + 2*24 = 1200 (clientWidth)
        expect(leftTrack + 4 + rightTrack + 48 + 48).toBe(1200)
        window.getComputedStyle = original
    })
    test("RTL drag inverts width calculation (right edge grows left column)", async () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        // clientWidth=1200, no padding/border/gap → available=1196, maxLeft=916
        setupRect(main, 1200)
        const original = window.getComputedStyle
        window.getComputedStyle = (() => ({
            gridTemplateColumns: "",
            getPropertyValue: () => "",
            paddingLeft: "0px",
            paddingRight: "0px",
            borderLeftWidth: "0px",
            columnGap: "0px",
            direction: "rtl"
        })) as any
        fireEvent.mouseDown(splitter)
        await Promise.resolve()
        // In RTL, the left column is mirrored to the right edge of the content
        // area. Dragging the splitter to clientX=1000 (near the right edge)
        // should produce a large left width (close to max).
        // LTR formula: width = 1000 - 0 - 0 = 1000 → clamped to 916
        // RTL formula: width = available(1196) - 1000 = 196 → clamped to 320 (min)
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1000 }))
        await Promise.resolve()
        expect(Number(localStorage.getItem(SPLITTER_KEY))).toBe(320)
        // Conversely, dragging near the left edge (clientX=100) should produce
        // a near-max left width: available - 100 = 1096 → clamped to 916.
        document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }))
        await Promise.resolve()
        expect(Number(localStorage.getItem(SPLITTER_KEY))).toBe(916)
        window.getComputedStyle = original
    })
    test("RTL ArrowRight shrinks left column (visual right moves splitter right)", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const original = window.getComputedStyle
        window.getComputedStyle = (() => ({
            gridTemplateColumns: "600px 4px 596px",
            getPropertyValue: () => "",
            direction: "rtl"
        })) as any
        // LTR: ArrowRight grows left → 600+5=605. RTL: ArrowRight shrinks → 600-5=595.
        fireEvent.keyDown(splitter, { key: "ArrowRight" })
        expect(localStorage.getItem(SPLITTER_KEY)).toBe("595")
        window.getComputedStyle = original
    })
    test("RTL ArrowLeft grows left column (visual left moves splitter left)", () => {
        render(() => <ContentGrid appStore={makeAppStore()} />)
        const splitter = screen.getByRole("separator")
        const main = splitter.parentElement as HTMLElement
        setupRect(main, 1200)
        const original = window.getComputedStyle
        window.getComputedStyle = (() => ({
            gridTemplateColumns: "600px 4px 596px",
            getPropertyValue: () => "",
            direction: "rtl"
        })) as any
        // LTR: ArrowLeft shrinks left → 600-5=595. RTL: ArrowLeft grows → 600+5=605.
        fireEvent.keyDown(splitter, { key: "ArrowLeft" })
        expect(localStorage.getItem(SPLITTER_KEY)).toBe("605")
        window.getComputedStyle = original
    })
})
