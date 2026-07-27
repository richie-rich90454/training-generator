// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import { createOrchestrator } from "../src/renderer/processing/orchestrator.js"
import type { OrchestratorSettings, OrchestratorDeps } from "../src/renderer/processing/orchestrator.js"
import Processor from "../src/renderer/processor.js"
import PromptManager from "../src/renderer/promptManager.js"
import type { SelectedFile, TrainingItem, ProcessFileResult } from "../src/types/index.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
import { clearCache } from "../src/renderer/cache.js"
import { semanticChunk } from "../src/renderer/chunker.js"

let dedupReturnValue: { items: TrainingItem[]; removed: number } | null = null

vi.mock("../src/renderer/workers/workerPool.js", async(importOriginal) => {
    const original = await importOriginal<typeof import("../src/renderer/workers/workerPool.js")>()
    return {
        ...original,
        chunkInWorker: vi.fn((text: string, chunkSize: number, overlap: number, smartSizing: boolean) => {
            return Promise.resolve(semanticChunk(text, chunkSize, overlap, smartSizing))
        }),
        dedupInWorker: vi.fn((items: TrainingItem[]) => {
            if(dedupReturnValue) return Promise.resolve(dedupReturnValue)
            return Promise.resolve({ items, removed: 0 })
        })
    }
})

function makeTextFile(name: string, content: string, type: string = "text/plain"): File {
    return new File([content], name, { type })
}

function makeSelectedFile(overrides: Partial<SelectedFile> & { name: string; type: string }): SelectedFile {
    return {
        file: null,
        path: null,
        size: 0,
        ...overrides
    } as SelectedFile
}

function baseSettings(overrides: Partial<OrchestratorSettings> = {}): OrchestratorSettings {
    return {
        model: "llama2",
        processingType: "instruction",
        outputFormat: "jsonl",
        language: "en",
        chunkSize: 8000,
        smartSizing: false,
        enableThinking: true,
        ...overrides
    }
}

function createMockProvider(name: string = "mock", generateFn?: (prompt: string, model: string) => Promise<ProviderResult>): Provider {
    return {
        name,
        generate: vi.fn(async(prompt: string, model: string): Promise<ProviderResult> => {
            if (generateFn) return generateFn(prompt, model)
            return { text: `A: ${prompt.slice(0, 40)}`, tokens: 10, provider: name }
        })
    }
}

let processor: Processor
let promptManager: PromptManager
let createTrainingItem: (input: string, output: string, processingType: string, outputFormat: string) => TrainingItem[]
let deps: OrchestratorDeps

beforeEach(async() => {
    dedupReturnValue = null
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal("window", {
        electronAPI: {
            generateWithOllamaStream: vi.fn(),
            generateWithOpenAI: vi.fn(),
            parseFile: vi.fn(),
            loadCache: vi.fn(async() => ({ success: true, data: {} })),
            saveCache: vi.fn(async() => ({ success: true })),
            clearCache: vi.fn(async() => ({ success: true })),
            readFile: vi.fn(async(filePath: string) => {
                const baseName = path.basename(filePath)
                const candidate = path.resolve(process.cwd(), "src/prompts", baseName)
                if(fs.existsSync(candidate)){
                    return { success: true, content: fs.readFileSync(candidate, "utf-8") }
                }
                return { success: false, error: "not found" }
            })
        }
    })
    await clearCache()
    processor = new Processor()
    processor.provider = createMockProvider("ollama")
    processor.concurrency = 1
    promptManager = new PromptManager()
    createTrainingItem = (input: string, output: string, processingType: string, outputFormat: string) => {
        return [{ format: outputFormat as any, instruction: input, output }]
    }
    deps = {
        processor,
        promptManager,
        createTrainingItem
    }
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("Orchestrator readFileAsArrayBuffer", () => {
    it("resolves with ArrayBuffer for a text file", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeTextFile("test.txt", "hello world")
        let buffer = await orchestrator.readFileAsArrayBuffer(file)
        expect(buffer).toBeInstanceOf(ArrayBuffer)
        expect(new TextDecoder().decode(buffer)).toBe("hello world")
    })
    it("rejects when FileReader fails", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = new File(["x"], "bad.txt", { type: "text/plain" })
        let originalReader = window.FileReader
        vi.stubGlobal("FileReader", class MockFileReader {
            onerror: ((ev: ProgressEvent<FileReader>) => any) | null = null
            onload: ((ev: ProgressEvent<FileReader>) => any) | null = null
            readAsArrayBuffer(_file: Blob): void {
                setTimeout(() => {
                    if(this.onerror) this.onerror(new ProgressEvent("error") as ProgressEvent<FileReader>)
                }, 0)
            }
        } as unknown as typeof FileReader)
        await expect(orchestrator.readFileAsArrayBuffer(file)).rejects.toThrow("Failed to read file as ArrayBuffer")
        vi.stubGlobal("FileReader", originalReader)
    })
})

describe("Orchestrator extractTextFromPDFBuffer", () => {
    it("extracts text from a simple BT/ET PDF stream", async() => {
        let orchestrator = createOrchestrator(deps)
        let pdf = "BT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET"
        let buffer = new TextEncoder().encode(pdf)
        let text = await orchestrator.extractTextFromPDFBuffer(buffer.buffer)
        expect(text).toContain("Hello PDF")
    })
    it("falls back to readable sequences when BT extraction is short", async() => {
        let orchestrator = createOrchestrator(deps)
        let pdf = "xx " + "A".repeat(200) + " yy"
        let buffer = new TextEncoder().encode(pdf)
        let text = await orchestrator.extractTextFromPDFBuffer(buffer.buffer)
        expect(text.length).toBeGreaterThan(50)
    })
    it("throws when no text is found", async() => {
        let orchestrator = createOrchestrator(deps)
        let buffer = new TextEncoder().encode("   ").buffer
        await expect(orchestrator.extractTextFromPDFBuffer(buffer)).rejects.toThrow()
    })
})

describe("Orchestrator readFileContent", () => {
    it("reads a plain text file as string", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeTextFile("doc.txt", "plain content")
        let text = await orchestrator.readFileContent(file)
        expect(text).toBe("plain content")
    })
    it("extracts text from a PDF file", async() => {
        let orchestrator = createOrchestrator(deps)
        let pdf = "BT (PDF text) Tj ET"
        let file = makeTextFile("doc.pdf", pdf, "application/pdf")
        let text = await orchestrator.readFileContent(file)
        expect(text).toContain("PDF text")
    })
    it("extracts text from a .pdf extension file", async() => {
        let orchestrator = createOrchestrator(deps)
        let pdf = "BT (Extension pdf) Tj ET"
        let file = makeTextFile("doc.PDF", pdf, "application/octet-stream")
        let text = await orchestrator.readFileContent(file)
        expect(text).toContain("Extension pdf")
    })
})

describe("Orchestrator generatePrompt", () => {
    it("uses custom prompt when provided", async() => {
        let orchestrator = createOrchestrator(deps)
        let prompt = await orchestrator.generatePrompt("source text", "instruction", "en", "Summarize: {{text}}")
        expect(prompt).toBe("Summarize: source text")
    })
    it("replaces all occurrences of {{text}} in custom prompt", async() => {
        let orchestrator = createOrchestrator(deps)
        let prompt = await orchestrator.generatePrompt("x", "instruction", "en", "{{text}} and {{text}}")
        expect(prompt).toBe("x and x")
    })
    it("falls back to i18n prompt when prompt manager returns null", async() => {
        let orchestrator = createOrchestrator(deps)
        vi.spyOn(promptManager, "getPromptWithFallback").mockResolvedValue(null)
        let prompt = await orchestrator.generatePrompt("text", "instruction", "en")
        expect(prompt).toContain("text")
        expect(prompt).toContain("Question")
    })
    it("falls back to default instruction prompt for unknown processing type", async() => {
        let orchestrator = createOrchestrator(deps)
        vi.spyOn(promptManager, "getPromptWithFallback").mockResolvedValue(null)
        let prompt = await orchestrator.generatePrompt("text", "unknown_type", "en")
        expect(prompt).toContain("Question")
    })
    it("uses prompt manager result when available", async() => {
        let orchestrator = createOrchestrator(deps)
        vi.spyOn(promptManager, "getPromptWithFallback").mockResolvedValue("Managed: {{text}}")
        let prompt = await orchestrator.generatePrompt("source", "instruction", "en")
        expect(prompt).toBe("Managed: source")
    })
    it("strips internal verification instructions when thinking is disabled", async() => {
        let orchestrator = createOrchestrator(deps)
        vi.spyOn(promptManager, "getPromptWithFallback").mockImplementation(async(language, type) => {
            return "Do work.\n18. Before producing the final output, internally verify that:\n   - no errors\nOUTPUT FORMAT:\nQuestion: {{text}}"
        })
        let prompt = await orchestrator.generatePrompt("source", "instruction", "en", undefined, false)
        expect(prompt).toContain("source")
        expect(prompt).toContain("OUTPUT FORMAT")
        expect(prompt).not.toContain("Before producing")
        expect(prompt).not.toContain("internally verify")
    })
})

describe("Orchestrator processFile", () => {
    it("processes a text File successfully", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({
            name: "doc.txt",
            type: "text/plain",
            file: makeTextFile("doc.txt", "First sentence. Second sentence.")
        })
        let result = await orchestrator.processFile(file, baseSettings(), {
            onChunkProcessed: vi.fn(),
            onChunkFailed: vi.fn(),
            onOutputUpdated: vi.fn()
        })
        expect(result.success).toBe(true)
        expect((result as ProcessFileResult & { success: true }).data!.length).toBeGreaterThan(0)
    })
    it("processes a file path through electron parseFile", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "doc.txt", type: "text/plain", path: "/docs/doc.txt" })
        vi.mocked(window.electronAPI!.parseFile).mockResolvedValue({ success: true, content: "Path content. More content." })
        let result = await orchestrator.processFile(file, baseSettings())
        expect(result.success).toBe(true)
        expect(window.electronAPI!.parseFile).toHaveBeenCalledWith("/docs/doc.txt", "text/plain")
    })
    it("returns error when parseFile fails", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "doc.txt", type: "text/plain", path: "/docs/doc.txt" })
        vi.mocked(window.electronAPI!.parseFile).mockResolvedValue({ success: false, error: "parse failed" })
        let result = await orchestrator.processFile(file, baseSettings())
        expect(result.success).toBe(false)
        expect(result.error).toContain("parse failed")
    })
    it("returns error when no file or path is provided", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "empty", type: "text/plain", file: null, path: null })
        let result = await orchestrator.processFile(file, baseSettings())
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
    })
    it("returns error when text content is empty", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "blank.txt", type: "text/plain", file: makeTextFile("blank.txt", "   ") })
        let result = await orchestrator.processFile(file, baseSettings())
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
    })
    it("clamps chunk size to a maximum of 10000", async() => {
        let orchestrator = createOrchestrator(deps)
        processor.provider = createMockProvider("ollama")
        let file = makeSelectedFile({ name: "huge.txt", type: "text/plain", file: makeTextFile("huge.txt", "A. ".repeat(2000)) })
        let result = await orchestrator.processFile(file, baseSettings({ chunkSize: 100000 }))
        expect(result.success).toBe(true)
    })
    it("clamps chunk size to a minimum of 500", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "tiny.txt", type: "text/plain", file: makeTextFile("tiny.txt", "A. ".repeat(500)) })
        let result = await orchestrator.processFile(file, baseSettings({ chunkSize: 100 }))
        expect(result.success).toBe(true)
    })
    it("uses default model and processingType when missing", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "doc.txt", type: "text/plain", file: makeTextFile("doc.txt", "Content here.") })
        let settings = baseSettings({ model: "", processingType: "" })
        let result = await orchestrator.processFile(file, settings)
        expect(result.success).toBe(true)
    })
    it("calls onChunkProcessed for each processed chunk", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "doc.txt", type: "text/plain", file: makeTextFile("doc.txt", "One. Two. Three.") })
        let onChunkProcessed = vi.fn()
        await orchestrator.processFile(file, baseSettings({ chunkSize: 20 }), { onChunkProcessed })
        expect(onChunkProcessed).toHaveBeenCalled()
    })
    it("calls onOutputUpdated when duplicates are removed", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "dup.txt", type: "text/plain", file: makeTextFile("dup.txt", "Same sentence. Same sentence. Same sentence.") })
        let onOutputUpdated = vi.fn()
        dedupReturnValue = { items: [{ format: "instruction", instruction: "x", output: "y" }], removed: 2 }
        await orchestrator.processFile(file, baseSettings({ chunkSize: 30 }), { onOutputUpdated })
        expect(onOutputUpdated).toHaveBeenCalled()
    })
    it("processes with custom prompt", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "custom.txt", type: "text/plain", file: makeTextFile("custom.txt", "Data.") })
        let settings = baseSettings({ customPrompt: "Q: {{text}}\nA:" })
        let result = await orchestrator.processFile(file, settings)
        expect(result.success).toBe(true)
    })
    it("falls back to simpleChunk when worker chunking returns empty", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "fallback.txt", type: "text/plain", file: makeTextFile("fallback.txt", "A".repeat(1000)) })
        let result = await orchestrator.processFile(file, baseSettings({ chunkSize: 2000 }))
        expect(result.success).toBe(true)
    })
    it("returns error when no chunks can be created", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "empty.txt", type: "text/plain", file: makeTextFile("empty.txt", "") })
        let result = await orchestrator.processFile(file, baseSettings())
        expect(result.success).toBe(false)
    })
    it("uses smart sizing when enabled", async() => {
        let orchestrator = createOrchestrator(deps)
        let file = makeSelectedFile({ name: "smart.txt", type: "text/plain", file: makeTextFile("smart.txt", "First sentence. Second sentence. Third sentence.") })
        let result = await orchestrator.processFile(file, baseSettings({ smartSizing: true, chunkSize: 100 }))
        expect(result.success).toBe(true)
    })
})
