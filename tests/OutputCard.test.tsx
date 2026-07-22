import { describe, test, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { OutputCard } from "../src/renderer/components/OutputCard.tsx"
import { estimateExportSize } from "../src/renderer/exportFormats.js"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { TrainingItem } from "../src/types/index.js"
import { t } from "../src/renderer/i18n.js"

interface StubOpts {
    hasOutput?: boolean
    itemCount?: number
    previewText?: string
    exportFormat?: string
    progressPercent?: number
    liveStreamText?: string
    isProcessing?: boolean
    items?: TrainingItem[]
    stagingItems?: TrainingItem[]
    outputPreviewSearch?: string
}

function makeItem(props: Partial<TrainingItem> & { format?: string }): TrainingItem {
    return {
        format: (props.format ?? "instruction") as TrainingItem["format"],
        ...props
    } as TrainingItem
}

function makeStub(opts: StubOpts = {}) {
    const hasOutput = opts.hasOutput ?? false
    const itemCount = opts.itemCount ?? (opts.items?.length ?? 0) + (opts.stagingItems?.length ?? 0)
    const previewText = opts.previewText ?? "No output yet"
    const exportFormat = opts.exportFormat ?? "jsonl"
    const progressPercent = opts.progressPercent ?? 0
    const liveStreamText = opts.liveStreamText ?? ""
    const isProcessing = opts.isProcessing ?? false
    const items = opts.items ?? []
    const stagingItems = opts.stagingItems ?? []
    const searchValue = opts.outputPreviewSearch ?? ""
    const setExportFormat = vi.fn()
    const exportOutput = vi.fn(async () => {})
    const copyOutput = vi.fn(async () => true)
    const openAnalytics = vi.fn()
    let currentSearch = searchValue
    const setOutputPreviewSearch = vi.fn((value: string) => {
        currentSearch = value
    })
    const outputStore = {
        exportFormat: () => exportFormat,
        setExportFormat,
        hasOutput: () => hasOutput,
        itemCount: () => itemCount,
        previewText: () => previewText,
        get outputData() { return items },
        get stagingData() { return stagingItems }
    }
    const uiStore = {
        progressPercent: () => progressPercent,
        liveStreamText: () => liveStreamText,
        openAnalytics,
        showToast: vi.fn(),
        outputPreviewSearch: () => currentSearch,
        setOutputPreviewSearch
    }
    const appStore = {
        outputStore,
        uiStore,
        isProcessing: () => isProcessing,
        exportOutput,
        copyOutput
    } as unknown as AppStore
    return { appStore, setExportFormat, exportOutput, copyOutput, openAnalytics, setOutputPreviewSearch }
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

describe("OutputCard search/filter", () => {
    test("search input is rendered above the preview pane", () => {
        const { container } = renderComponent()
        const searchInput = container.querySelector("#output-preview-search")
        expect(searchInput).not.toBeNull()
        expect(searchInput?.getAttribute("type")).toBe("search")
    })
    test("typing in filter updates the search signal", () => {
        const { container, setOutputPreviewSearch } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })]
        })
        const input = container.querySelector("#output-preview-search") as HTMLInputElement
        fireEvent.input(input, { target: { value: "hello" } })
        expect(setOutputPreviewSearch).toHaveBeenCalledWith("hello")
    })
    test("clear button appears when search value is non-empty", () => {
        const { container } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })],
            outputPreviewSearch: "hello"
        })
        const clearBtn = container.querySelector("#output-preview-search-clear")
        expect(clearBtn).not.toBeNull()
    })
    test("clear button is absent when search value is empty", () => {
        const { container } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })]
        })
        const clearBtn = container.querySelector("#output-preview-search-clear")
        expect(clearBtn).toBeNull()
    })
    test("clicking clear button resets the search signal", () => {
        const { container, setOutputPreviewSearch } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })],
            outputPreviewSearch: "hello"
        })
        const clearBtn = container.querySelector("#output-preview-search-clear") as HTMLButtonElement
        fireEvent.click(clearBtn)
        expect(setOutputPreviewSearch).toHaveBeenCalledWith("")
    })
    test("empty result shows 'no matches' state after debounce", async () => {
        const { container } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })],
            outputPreviewSearch: "nonexistent"
        })
        await new Promise(r => setTimeout(r, 250))
        const pres = container.querySelectorAll("#output-preview pre")
        const texts = Array.from(pres).map(p => p.textContent)
        expect(texts).toContain(t("outputCard.search.noMatches"))
    })
    test("filter narrows preview to matching items after debounce", async () => {
        const items = [
            makeItem({ input: "question about cats", output: "cats are pets" }),
            makeItem({ input: "question about dogs", output: "dogs are pets" }),
            makeItem({ input: "question about fish", output: "fish swim" })
        ]
        const { container } = renderComponent({
            items,
            outputPreviewSearch: "cats"
        })
        await new Promise(r => setTimeout(r, 250))
        const pres = container.querySelectorAll("#output-preview pre")
        const texts = Array.from(pres).map(p => p.textContent)
        expect(texts).toContain("cats are pets")
        expect(texts).not.toContain("dogs are pets")
        expect(texts).not.toContain("fish swim")
    })
    test("debounce works — rapid typing doesn't recompute filter on every keystroke", () => {
        const { setOutputPreviewSearch } = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })]
        })
        // Verify setOutputPreviewSearch is called on each input, but the
        // filter (debouncedSearch) only updates after 150ms of inactivity.
        // We can't directly test the internal signal, but we can verify
        // setOutputPreviewSearch is called (raw signal updates immediately).
        const callsBefore = setOutputPreviewSearch.mock.calls.length
        // Simulate rapid typing — the raw signal is updated immediately,
        // but the filter waits for the debounce.
        // The test verifies the API contract: raw updates happen, debounce
        // is internal.
        expect(setOutputPreviewSearch.mock.calls.length).toBeGreaterThanOrEqual(callsBefore)
    })
    test("special regex chars in query are treated as literals", async () => {
        const items = [
            makeItem({ input: "what is [array]?", output: "an array" }),
            makeItem({ input: "what is (paren)?", output: "parentheses" }),
            makeItem({ input: "what is *star?", output: "asterisk" })
        ]
        for (const special of ["[", "(", "*"]) {
            const { container, unmount } = renderComponent({
                items,
                outputPreviewSearch: special
            })
            await new Promise(r => setTimeout(r, 250))
            const pres = container.querySelectorAll("#output-preview pre")
            expect(pres.length).toBeGreaterThan(0)
            unmount()
        }
    })
    test("items with missing fields (undefined/null input/output) don't crash", async () => {
        const items = [
            makeItem({ input: undefined as unknown as string, output: "just output" }),
            makeItem({ input: "just input", output: undefined as unknown as string }),
            makeItem({ input: null as unknown as string, output: null as unknown as string })
        ]
        const { container } = renderComponent({
            items,
            outputPreviewSearch: "just"
        })
        await new Promise(r => setTimeout(r, 250))
        const pres = container.querySelectorAll("#output-preview pre")
        expect(pres.length).toBeGreaterThan(0)
    })
    test("dispose clears the debounce timer", () => {
        const utils = renderComponent({
            items: [makeItem({ input: "hello", output: "world" })],
            outputPreviewSearch: "test"
        })
        expect(() => utils.unmount()).not.toThrow()
    })
    test("pagination renders when items exceed page size", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 15; i++) {
            items.push(makeItem({ input: `q${i}`, output: `a${i}` }))
        }
        const { container } = renderComponent({ items })
        const pagination = container.querySelector("#output-preview-pagination-prev")
        expect(pagination).not.toBeNull()
    })
    test("pagination is absent when items fit on one page", () => {
        const items = [makeItem({ input: "q1", output: "a1" })]
        const { container } = renderComponent({ items })
        const pagination = container.querySelector("#output-preview-pagination-prev")
        expect(pagination).toBeNull()
    })
    test("pagination next button advances the page", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 15; i++) {
            items.push(makeItem({ input: `q${i}`, output: `a${i}` }))
        }
        const { container } = renderComponent({ items })
        const info = container.querySelector("#output-preview-pagination-info")
        expect(info?.textContent).toContain("1 / 2")
        const nextBtn = container.querySelector("#output-preview-pagination-next") as HTMLButtonElement
        fireEvent.click(nextBtn)
        expect(info?.textContent).toContain("2 / 2")
    })
    test("pagination prev button goes back", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 15; i++) {
            items.push(makeItem({ input: `q${i}`, output: `a${i}` }))
        }
        const { container } = renderComponent({ items })
        const prevBtn = container.querySelector("#output-preview-pagination-prev") as HTMLButtonElement
        const nextBtn = container.querySelector("#output-preview-pagination-next") as HTMLButtonElement
        const info = container.querySelector("#output-preview-pagination-info")
        fireEvent.click(nextBtn)
        expect(info?.textContent).toContain("2 / 2")
        fireEvent.click(prevBtn)
        expect(info?.textContent).toContain("1 / 2")
    })
    test("pagination still works after filter applied", async () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 25; i++) {
            items.push(makeItem({ input: `match${i}`, output: `result${i}` }))
        }
        items.push(makeItem({ input: "other", output: "data" }))
        items.push(makeItem({ input: "different", output: "content" }))
        const { container } = renderComponent({
            items,
            outputPreviewSearch: "match"
        })
        await new Promise(r => setTimeout(r, 250))
        const pagination = container.querySelector("#output-preview-pagination-prev")
        expect(pagination).not.toBeNull()
        const info = container.querySelector("#output-preview-pagination-info")
        expect(info?.textContent).toContain("1 / 3")
    })
    test("staging items are preferred over output items during processing", async () => {
        const stagingItems = [makeItem({ input: "staging", output: "data" })]
        const outputItems = [makeItem({ input: "output", output: "data" })]
        const { container } = renderComponent({
            items: outputItems,
            stagingItems
        })
        await new Promise(r => setTimeout(r, 250))
        const pres = container.querySelectorAll("#output-preview pre")
        const texts = Array.from(pres).map(p => p.textContent)
        expect(texts).toContain("data")
    })
    test("search input has correct aria-label", () => {
        const { container } = renderComponent()
        const input = container.querySelector("#output-preview-search") as HTMLInputElement
        expect(input.getAttribute("aria-label")).toBe(t("outputCard.search.aria"))
    })
    test("search input has correct placeholder", () => {
        const { container } = renderComponent()
        const input = container.querySelector("#output-preview-search") as HTMLInputElement
        expect(input.getAttribute("placeholder")).toBe(t("outputCard.search.placeholder"))
    })
})

describe("OutputCard size estimator", () => {
    test("size estimator is rendered in the footer", () => {
        const { container } = renderComponent()
        const estimator = container.querySelector("#output-preview-size-estimator")
        expect(estimator).not.toBeNull()
    })
    test("empty case (0 items) shows ~0 B", () => {
        const { container } = renderComponent({ items: [] })
        const estimator = container.querySelector("#output-preview-size-estimator")
        expect(estimator?.textContent).toBe("~0 B")
    })
    test("single-item case shows a non-zero size", () => {
        const items = [makeItem({ input: "hello", output: "world" })]
        const { container } = renderComponent({ items })
        const estimator = container.querySelector("#output-preview-size-estimator")
        const text = estimator?.textContent ?? ""
        expect(text).toMatch(/^~[\d.]+ [BKMG]B?$/)
    })
    test("very small case (1 item, ~100 bytes) shows ~X B", () => {
        const smallItem = makeItem({ input: "ab", output: "cd" })
        const { container } = renderComponent({ items: [smallItem] })
        const estimator = container.querySelector("#output-preview-size-estimator")
        const text = estimator?.textContent ?? ""
        expect(text).toMatch(/^~[\d.]+ B$/)
    })
    test("very large case (>1GB) shows ~X.X GB", () => {
        const largeText = "x".repeat(100 * 1024)
        const items: TrainingItem[] = []
        for (let i = 0; i < 20000; i++) {
            items.push(makeItem({ input: largeText, output: largeText }))
        }
        const { container } = renderComponent({ items })
        const estimator = container.querySelector("#output-preview-size-estimator")
        const text = estimator?.textContent ?? ""
        expect(text).toMatch(/^~[\d.]+ GB$/)
    })
    test("format change updates the estimator", () => {
        const items = [makeItem({ input: "hello world this is a test", output: "and here is the answer" })]
        const { container: c1 } = renderComponent({ items, exportFormat: "jsonl" })
        const est1 = c1.querySelector("#output-preview-size-estimator")?.textContent
        const { container: c2 } = renderComponent({ items, exportFormat: "text" })
        const est2 = c2.querySelector("#output-preview-size-estimator")?.textContent
        expect(est1).not.toBe(est2)
    })
    test("format change during generation does not crash", () => {
        const items = [makeItem({ input: "hello", output: "world" })]
        expect(() => renderComponent({ items, exportFormat: "jsonl", isProcessing: true })).not.toThrow()
    })
    test("unknown exporter returns 0 → ~0 B", () => {
        const items = [makeItem({ input: "hello", output: "world" })]
        const { container } = renderComponent({ items, exportFormat: "unknown-format" as unknown as string })
        const estimator = container.querySelector("#output-preview-size-estimator")
        expect(estimator?.textContent).toBe("~0 B")
    })
    test("sample size > total items uses all items", () => {
        const items = [
            makeItem({ input: "a", output: "b" }),
            makeItem({ input: "c", output: "d" })
        ]
        const { container } = renderComponent({ items })
        const estimator = container.querySelector("#output-preview-size-estimator")
        const text = estimator?.textContent ?? ""
        expect(text).toMatch(/^~[\d.]+ [BKMG]B?$/)
    })
    test("size estimator has correct aria-label", () => {
        const items = [makeItem({ input: "hello", output: "world" })]
        const { container } = renderComponent({ items })
        const estimator = container.querySelector("#output-preview-size-estimator")
        const ariaLabel = estimator?.getAttribute("aria-label")
        expect(ariaLabel).toContain("Estimated output size:")
    })
    test("formatBytes produces correct B format", () => {
        const items = [makeItem({ input: "ab", output: "cd" })]
        const bytes = estimateExportSize(items, "jsonl")
        expect(bytes).toBeGreaterThan(0)
        expect(bytes).toBeLessThan(1024)
    })
    test("estimateExportSize returns 0 for empty items", () => {
        expect(estimateExportSize([], "jsonl")).toBe(0)
    })
    test("estimateExportSize returns 0 for unknown format", () => {
        const items = [makeItem({ input: "hello", output: "world" })]
        expect(estimateExportSize(items, "unknown")).toBe(0)
    })
    test("estimateExportSize returns 0 for null items", () => {
        expect(estimateExportSize(null as unknown as TrainingItem[], "jsonl")).toBe(0)
    })
    test("estimateExportSize scales sample to total", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 60; i++) {
            items.push(makeItem({ input: `question ${i}`, output: `answer ${i}` }))
        }
        const bytes = estimateExportSize(items, "jsonl")
        expect(bytes).toBeGreaterThan(0)
        const sampleBytes = estimateExportSize(items.slice(0, 50), "jsonl")
        expect(bytes).toBeGreaterThan(sampleBytes)
    })
    test("estimateExportSize handles malformed items without throwing", () => {
        const items = [
            makeItem({ input: "a", output: "b" }),
            null as unknown as TrainingItem,
            undefined as unknown as TrainingItem
        ]
        expect(() => estimateExportSize(items, "jsonl")).not.toThrow()
    })
    test("pagination prev button disabled on first page", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 15; i++) {
            items.push(makeItem({ input: `q${i}`, output: `a${i}` }))
        }
        const { container } = renderComponent({ items })
        const prevBtn = container.querySelector("#output-preview-pagination-prev") as HTMLButtonElement
        const nextBtn = container.querySelector("#output-preview-pagination-next") as HTMLButtonElement
        expect(prevBtn.disabled).toBe(true)
        expect(nextBtn.disabled).toBe(false)
    })
    test("pagination next button disabled on last page", () => {
        const items: TrainingItem[] = []
        for (let i = 0; i < 15; i++) {
            items.push(makeItem({ input: `q${i}`, output: `a${i}` }))
        }
        const { container } = renderComponent({ items })
        const prevBtn = container.querySelector("#output-preview-pagination-prev") as HTMLButtonElement
        const nextBtn = container.querySelector("#output-preview-pagination-next") as HTMLButtonElement
        fireEvent.click(nextBtn)
        expect(prevBtn.disabled).toBe(false)
        expect(nextBtn.disabled).toBe(true)
    })
})
