import { describe, test, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { OutputCard } from "../src/renderer/components/OutputCard.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"

interface StubOpts {
    hasOutput?: boolean
    itemCount?: number
    previewText?: string
    exportFormat?: string
    progressPercent?: number
    liveStreamText?: string
    isProcessing?: boolean
}
function makeStub(opts: StubOpts = {}) {
    const hasOutput = opts.hasOutput ?? false
    const itemCount = opts.itemCount ?? 0
    const previewText = opts.previewText ?? "No output yet"
    const exportFormat = opts.exportFormat ?? "jsonl"
    const progressPercent = opts.progressPercent ?? 0
    const liveStreamText = opts.liveStreamText ?? ""
    const isProcessing = opts.isProcessing ?? false
    const setExportFormat = vi.fn()
    const exportOutput = vi.fn(async () => {})
    const copyOutput = vi.fn(async () => true)
    const openAnalytics = vi.fn()
    const outputStore = {
        exportFormat: () => exportFormat,
        setExportFormat,
        hasOutput: () => hasOutput,
        itemCount: () => itemCount,
        previewText: () => previewText
    }
    const uiStore = {
        progressPercent: () => progressPercent,
        liveStreamText: () => liveStreamText,
        openAnalytics,
        showToast: vi.fn()
    }
    const appStore = {
        outputStore,
        uiStore,
        isProcessing: () => isProcessing,
        exportOutput,
        copyOutput
    } as unknown as AppStore
    return { appStore, setExportFormat, exportOutput, copyOutput, openAnalytics }
}
function renderComponent(opts: StubOpts = {}) {
    const stub = makeStub(opts)
    const result = render(() => <OutputCard appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("OutputCard", () => {
    test("renders title and action buttons", () => {
        const { container } = renderComponent()
        expect(container.querySelector("#export-btn")).not.toBeNull()
        expect(container.querySelector("#copy-btn")).not.toBeNull()
        expect(container.querySelector("#analytics-btn")).not.toBeNull()
        expect(container.querySelector("#export-format")).not.toBeNull()
    })
    test("action buttons disabled when no output", () => {
        const { container } = renderComponent({ hasOutput: false })
        expect((container.querySelector("#export-btn") as HTMLButtonElement).disabled).toBe(true)
        expect((container.querySelector("#copy-btn") as HTMLButtonElement).disabled).toBe(true)
        expect((container.querySelector("#analytics-btn") as HTMLButtonElement).disabled).toBe(true)
    })
    test("action buttons enabled when output present", () => {
        const { container } = renderComponent({ hasOutput: true, itemCount: 3 })
        expect((container.querySelector("#export-btn") as HTMLButtonElement).disabled).toBe(false)
        expect((container.querySelector("#copy-btn") as HTMLButtonElement).disabled).toBe(false)
        expect((container.querySelector("#analytics-btn") as HTMLButtonElement).disabled).toBe(false)
    })
    test("preview text reflects outputStore.previewText", () => {
        const { container } = renderComponent({ previewText: "Item 1: hello" })
        const pres = container.querySelectorAll("pre")
        expect(pres[0].textContent).toContain("Item 1: hello")
    })
    test("shows loading fallback when processing with no items", () => {
        const { container } = renderComponent({ isProcessing: true, itemCount: 0 })
        const pres = container.querySelectorAll("pre")
        expect(pres[0].textContent).toBe(t("common.loading"))
    })
    test("clicking export calls appStore.exportOutput with current format", () => {
        const { exportOutput, container } = renderComponent({ hasOutput: true, exportFormat: "jsonl" })
        fireEvent.click(container.querySelector("#export-btn") as HTMLButtonElement)
        expect(exportOutput).toHaveBeenCalledWith("jsonl")
    })
    test("clicking copy calls appStore.copyOutput", () => {
        const { copyOutput, container } = renderComponent({ hasOutput: true })
        fireEvent.click(container.querySelector("#copy-btn") as HTMLButtonElement)
        expect(copyOutput).toHaveBeenCalledTimes(1)
    })
    test("clicking analytics calls uiStore.openAnalytics", () => {
        const { openAnalytics, container } = renderComponent({ hasOutput: true })
        fireEvent.click(container.querySelector("#analytics-btn") as HTMLButtonElement)
        expect(openAnalytics).toHaveBeenCalledTimes(1)
    })
    test("changing export format select calls outputStore.setExportFormat", () => {
        const { setExportFormat, container } = renderComponent({ hasOutput: true })
        fireEvent.change(container.querySelector("#export-format") as HTMLSelectElement, { target: { value: "csv" } })
        expect(setExportFormat).toHaveBeenCalledWith("csv")
    })
    test("live stream renders when liveStreamText non-empty", () => {
        const { container } = renderComponent({ liveStreamText: "streaming chunk 1..." })
        const pres = container.querySelectorAll("pre")
        const texts = Array.from(pres).map((p) => p.textContent)
        expect(texts).toContain("streaming chunk 1...")
    })
    test("live stream hidden when liveStreamText empty", () => {
        const { container } = renderComponent({ liveStreamText: "" })
        // Only the main preview <pre> should exist (no live stream block)
        const pres = container.querySelectorAll("pre")
        expect(pres.length).toBe(1)
    })
    test("progress percent reflected in output progress text", () => {
        const { container } = renderComponent({ progressPercent: 75 })
        expect(container.textContent).toContain("75%")
    })
    test("unmounts without throwing", () => {
        const utils = renderComponent()
        expect(() => utils.unmount()).not.toThrow()
    })
})
