import { describe, test, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { ProcessingCard } from "../src/renderer/components/ProcessingCard.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"

interface StubOpts {
    isProcessing?: boolean
    canProcess?: boolean
    demoActive?: boolean
    progressPercent?: number
    progressText?: string
    logs?: { id: number; message: string; type: "info" | "success" | "warning" | "error"; timestamp: number }[]
}
function makeStub(opts: StubOpts = {}) {
    const isProcessing = opts.isProcessing ?? false
    const canProcess = opts.canProcess ?? false
    const demoActive = opts.demoActive ?? false
    const progressPercent = opts.progressPercent ?? 0
    const progressText = opts.progressText ?? t("processing.ready")
    const logs = opts.logs ?? []
    const processFiles = vi.fn(async () => {})
    const stopProcessing = vi.fn()
    const toggleDemoMode = vi.fn()
    const toggleDashboard = vi.fn()
    const uiStore = {
        progressPercent: () => progressPercent,
        progressText: () => progressText,
        logs,
        getLogIcon: () => "fa-info-circle",
        toggleDashboard,
        showToast: vi.fn()
    }
    const fileStore = {
        canProcess: () => canProcess,
        demoActive: () => demoActive
    }
    const appStore = {
        uiStore,
        fileStore,
        isProcessing: () => isProcessing,
        processFiles,
        stopProcessing,
        toggleDemoMode
    } as unknown as AppStore
    return { appStore, processFiles, stopProcessing, toggleDemoMode, toggleDashboard }
}
function renderComponent(opts: StubOpts = {}) {
    const stub = makeStub(opts)
    const result = render(() => <ProcessingCard appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("ProcessingCard", () => {
    test("renders title, process button and progress bar", () => {
        const { container } = renderComponent()
        expect(container.querySelector("#process-btn")).not.toBeNull()
        expect(container.querySelector("#progress-fill")).not.toBeNull()
        expect(container.querySelector("#processing-log")).not.toBeNull()
    })
    test("progress percent and fill reflect uiStore progress", () => {
        const { container } = renderComponent({ progressPercent: 50, progressText: "Halfway" })
        expect(container.querySelector("#progress-percent")!.textContent).toBe("50" + t("common.percent"))
        const fill = container.querySelector("#progress-fill") as HTMLElement
        expect(fill.style.width).toBe("50%")
        expect(container.querySelector("#progress-text")!.textContent).toBe("Halfway")
    })
    test("process button disabled when not processing and cannot process", () => {
        const { container } = renderComponent({ isProcessing: false, canProcess: false })
        const btn = container.querySelector("#process-btn") as HTMLButtonElement
        expect(btn.disabled).toBe(true)
    })
    test("process button enabled and labeled start when canProcess and not processing", () => {
        const { container } = renderComponent({ isProcessing: false, canProcess: true })
        const btn = container.querySelector("#process-btn") as HTMLButtonElement
        expect(btn.disabled).toBe(false)
        expect(btn.textContent).toContain(t("processing.start"))
    })
    test("process button labeled running when processing and not disabled", () => {
        const { container } = renderComponent({ isProcessing: true })
        const btn = container.querySelector("#process-btn") as HTMLButtonElement
        expect(btn.disabled).toBe(false)
        expect(btn.textContent).toContain(t("processing.running"))
    })
    test("clicking start calls appStore.processFiles", () => {
        const { processFiles, container } = renderComponent({ isProcessing: false, canProcess: true })
        fireEvent.click(container.querySelector("#process-btn") as HTMLButtonElement)
        expect(processFiles).toHaveBeenCalledTimes(1)
    })
    test("clicking stop calls appStore.stopProcessing", () => {
        const { stopProcessing, container } = renderComponent({ isProcessing: true })
        fireEvent.click(container.querySelector("#process-btn") as HTMLButtonElement)
        expect(stopProcessing).toHaveBeenCalledTimes(1)
    })
    test("demo button click calls appStore.toggleDemoMode", () => {
        const { toggleDemoMode, container } = renderComponent()
        fireEvent.click(container.querySelector("#demo-btn") as HTMLButtonElement)
        expect(toggleDemoMode).toHaveBeenCalledTimes(1)
    })
    test("dashboard button click calls uiStore.toggleDashboard", () => {
        const { toggleDashboard, container } = renderComponent()
        fireEvent.click(container.querySelector("#dashboard-btn") as HTMLButtonElement)
        expect(toggleDashboard).toHaveBeenCalledTimes(1)
    })
    test("renders log entries from uiStore.logs", () => {
        const logs = [
            { id: 1, message: "Started processing", type: "info" as const, timestamp: 1 },
            { id: 2, message: "Finished successfully", type: "success" as const, timestamp: 2 }
        ]
        const { container } = renderComponent({ logs })
        const logEl = container.querySelector("#processing-log") as HTMLElement
        // Each entry renders a <span> with the message; count message spans (not icon spans)
        const spans = logEl.querySelectorAll("span")
        const messages = Array.from(spans).map((s) => s.textContent)
        expect(messages).toContain("Started processing")
        expect(messages).toContain("Finished successfully")
    })
    test("demo button gets active class when demo active", () => {
        const { container } = renderComponent({ demoActive: true })
        const demoBtn = container.querySelector("#demo-btn") as HTMLButtonElement
        expect(demoBtn.className).toContain("active")
    })
    test("unmounts without throwing", () => {
        const utils = renderComponent()
        expect(() => utils.unmount()).not.toThrow()
    })
})
