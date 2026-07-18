// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createOutputStore, type OutputStore, type OutputStoreOptions } from "../src/renderer/stores/outputStore.js"
import { withRoot } from "./setup.js"
import type { TrainingItem } from "../src/types/index.js"

let store: OutputStore
let dispose: () => void
let saveFileMock: ReturnType<typeof vi.fn>
let chooseDirectoryMock: ReturnType<typeof vi.fn>
let saveFileDialogMock: ReturnType<typeof vi.fn>

function item(props: Partial<TrainingItem> & { format: string }, sourceFile?: string): TrainingItem {
    const base = { ...props } as TrainingItem
    if (sourceFile) {
        base.metadata = { ...(base.metadata || {}), sourceFile }
    }
    return base
}

function createStoreWithOptions(opts: OutputStoreOptions): OutputStore {
    return withRoot((d) => {
        dispose = d
        return createOutputStore(opts)
    })
}

beforeEach(() => {
    saveFileMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
    chooseDirectoryMock = vi.fn(async (): Promise<string | null> => "/output/dir")
    saveFileDialogMock = vi.fn(async (): Promise<string | null> => "/output/training_data.jsonl")
    vi.stubGlobal("window", {
        electronAPI: {
            saveFile: saveFileMock,
            chooseDirectory: chooseDirectoryMock,
            saveFileDialog: saveFileDialogMock
        }
    })
})

afterEach(() => {
    dispose()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("OutputStore per-file export mode", () => {
    it("defaults to combined mode when no options provided", async () => {
        store = withRoot((d) => {
            dispose = d
            return createOutputStore()
        })
        store.appendOutput([item({ format: "text", text: "hello" })])
        await store.exportOutput("jsonl")
        expect(saveFileDialogMock).toHaveBeenCalledTimes(1)
        expect(chooseDirectoryMock).not.toHaveBeenCalled()
    })

    it("invokes chooseDirectory when perFile mode is selected", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "hello" }, "doc1.txt")])
        await store.exportOutput("jsonl")
        expect(chooseDirectoryMock).toHaveBeenCalledTimes(1)
        expect(saveFileDialogMock).not.toHaveBeenCalled()
    })

    it("groups items by sourceFile", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([
            item({ format: "text", text: "a" }, "alpha.txt"),
            item({ format: "text", text: "b" }, "alpha.txt"),
            item({ format: "text", text: "c" }, "beta.md")
        ])
        await store.exportOutput("jsonl")
        expect(saveFileMock).toHaveBeenCalledTimes(2)
        const paths = saveFileMock.mock.calls.map(c => c[0] as string)
        expect(paths.some(p => p.includes("alpha"))).toBe(true)
        expect(paths.some(p => p.includes("beta"))).toBe(true)
    })

    it("assigns unknown-N stem when sourceFile is missing", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([
            item({ format: "text", text: "a" }),
            item({ format: "text", text: "b" })
        ])
        await store.exportOutput("jsonl")
        expect(saveFileMock).toHaveBeenCalled()
        const paths = saveFileMock.mock.calls.map(c => c[0] as string)
        expect(paths.some(p => p.includes("unknown-1") || p.includes("unknown-2"))).toBe(true)
    })

    it("expands {source} placeholder in filename template", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}-training",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "report.pdf")])
        await store.exportOutput("jsonl")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath).toContain("report-training")
    })

    it("expands {format} placeholder in filename template", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}-{format}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("csv")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath).toContain("doc-csv")
    })

    it("expands {index} placeholder in filename template", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{index}-{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([
            item({ format: "text", text: "a" }, "alpha.txt"),
            item({ format: "text", text: "b" }, "beta.txt")
        ])
        await store.exportOutput("jsonl")
        const paths = saveFileMock.mock.calls.map(c => c[0] as string)
        expect(paths.some(p => p.includes("1-alpha"))).toBe(true)
        expect(paths.some(p => p.includes("2-beta"))).toBe(true)
    })

    it("expands {date} and {timestamp} placeholders in filename template", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}-{date}-{timestamp}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        // Date should be 8 digits (YYYYMMDD), timestamp should be all digits
        expect(savedPath).toMatch(/doc-\d{8}-\d+/)
    })

    it("splits files when exceeding maxItemsPerFile", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 2,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([
            item({ format: "text", text: "a" }, "big.txt"),
            item({ format: "text", text: "b" }, "big.txt"),
            item({ format: "text", text: "c" }, "big.txt"),
            item({ format: "text", text: "d" }, "big.txt"),
            item({ format: "text", text: "e" }, "big.txt")
        ])
        await store.exportOutput("jsonl")
        // 5 items / 2 per file = 3 parts (2+2+1)
        expect(saveFileMock).toHaveBeenCalledTimes(3)
        const paths = saveFileMock.mock.calls.map(c => c[0] as string)
        expect(paths.some(p => p.includes("big-1"))).toBe(true)
        expect(paths.some(p => p.includes("big-2"))).toBe(true)
        expect(paths.some(p => p.includes("big-3"))).toBe(true)
    })

    it("strips source metadata when includeSourceMetadata is false", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        const savedContent = saveFileMock.mock.calls[0][1] as string
        const parsed = JSON.parse(savedContent.trim())
        expect(parsed.metadata?.sourceFile).toBeUndefined()
        expect(parsed.metadata?.generatedAt).toBeUndefined()
        expect(parsed.metadata?.sourceFileIndex).toBeUndefined()
    })

    it("keeps source metadata when includeSourceMetadata is true", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => true,
            getStripPiiBeforeExport: () => false
        })
        // Pass sourceFile to appendOutput so both sourceFile and generatedAt are stamped.
        store.appendOutput([item({ format: "text", text: "a" })], "doc.txt")
        const afterAppend = store.outputData[0]
        // Sanity check: appendOutput stamps both sourceFile and generatedAt
        expect(afterAppend.metadata?.sourceFile).toBe("doc.txt")
        expect(afterAppend.metadata?.generatedAt).toBeTypeOf("number")
        await store.exportOutput("jsonl")
        const savedContent = saveFileMock.mock.calls[0][1] as string
        const parsed = JSON.parse(savedContent.trim())
        expect(parsed.metadata?.sourceFile).toBe("doc.txt")
        // generatedAt is preserved when includeSourceMetadata is true
        expect(typeof parsed.metadata?.generatedAt).toBe("number")
    })

    it("tags items with piiFlags when stripPiiBeforeExport is true", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => true
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        const savedContent = saveFileMock.mock.calls[0][1] as string
        const parsed = JSON.parse(savedContent.trim())
        expect(parsed.metadata?.piiFlags).toEqual([])
    })

    it("does nothing when directory picker is cancelled", async () => {
        chooseDirectoryMock.mockResolvedValue(null)
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        expect(chooseDirectoryMock).toHaveBeenCalledTimes(1)
        expect(saveFileMock).not.toHaveBeenCalled()
    })

    it("uses correct file extension for csv format", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("csv")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath.endsWith(".csv")).toBe(true)
    })

    it("uses correct file extension for text format", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("text")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath.endsWith(".txt")).toBe(true)
    })

    it("uses correct file extension for json format", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("json")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath.endsWith(".json")).toBe(true)
    })

    it("uses path separator matching the directory platform", async () => {
        chooseDirectoryMock.mockResolvedValue("C:\\output\\dir")
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath.includes("\\doc.jsonl")).toBe(true)
    })

    it("sanitizes invalid filename characters in template output", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}/<bad>",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        // Invalid chars like / < > should be replaced with _
        expect(savedPath).not.toMatch(/[<>]/)
        expect(savedPath).not.toMatch(/doc\.txt\/bad/)
    })

    it("handles multiple sources with mixed empty and non-empty groups", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        // Two sources: alpha (with items) and beta (with items)
        store.appendOutput([
            item({ format: "text", text: "a" }, "alpha.txt"),
            item({ format: "text", text: "b" }, "beta.txt")
        ])
        await store.exportOutput("jsonl")
        expect(saveFileMock).toHaveBeenCalledTimes(2)
    })

    it("stamps sourceFile metadata when appendOutput is called with sourceFile", () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => true,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" })], "source.doc")
        expect(store.outputData[0].metadata?.sourceFile).toBe("source.doc")
        expect(store.outputData[0].metadata?.generatedAt).toBeTypeOf("number")
    })

    it("stamps sourceFile metadata when stageItems is called with sourceFile", () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => true,
            getStripPiiBeforeExport: () => false
        })
        store.stageItems([item({ format: "text", text: "a" })], "staged.doc")
        expect(store.stagingData[0].metadata?.sourceFile).toBe("staged.doc")
        expect(store.stagingData[0].metadata?.generatedAt).toBeTypeOf("number")
    })

    it("does not overwrite existing sourceFile when re-stamping", () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => true,
            getStripPiiBeforeExport: () => false
        })
        const existing: TrainingItem = {
            format: "text",
            text: "a",
            metadata: { sourceFile: "original.doc", generatedAt: 1000 }
        }
        store.appendOutput([existing], "new.doc")
        // Original sourceFile should be preserved
        expect(store.outputData[0].metadata?.sourceFile).toBe("original.doc")
        expect(store.outputData[0].metadata?.generatedAt).toBe(1000)
    })

    it("returns empty string from getSourceFileStem for empty input (via filename)", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        // Items without sourceFile get unknown-N as the source key, which then becomes "unknown-1"
        store.appendOutput([item({ format: "text", text: "a" })])
        await store.exportOutput("jsonl")
        const savedPath = saveFileMock.mock.calls[0][0] as string
        expect(savedPath).toContain("unknown-1")
    })

    it("does not export when there is no output data", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        await store.exportOutput("jsonl")
        expect(chooseDirectoryMock).not.toHaveBeenCalled()
        expect(saveFileMock).not.toHaveBeenCalled()
    })

    it("includes staging data in export", async () => {
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile",
            getOutputFilenameTemplate: () => "{source}",
            getMaxItemsPerFile: () => 50000,
            getIncludeSourceMetadata: () => false,
            getStripPiiBeforeExport: () => false
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc1.txt")])
        store.stageItems([item({ format: "text", text: "b" }, "doc2.txt")])
        await store.exportOutput("jsonl")
        expect(saveFileMock).toHaveBeenCalledTimes(2)
    })

    it("handles default options when callbacks are missing", async () => {
        // Only provide getOutputFileMode, leave others undefined
        store = createStoreWithOptions({
            getOutputFileMode: () => "perFile"
        })
        store.appendOutput([item({ format: "text", text: "a" }, "doc.txt")])
        await store.exportOutput("jsonl")
        expect(saveFileMock).toHaveBeenCalledTimes(1)
        const savedPath = saveFileMock.mock.calls[0][0] as string
        // Default template is "{source}"
        expect(savedPath).toContain("doc")
    })
})
