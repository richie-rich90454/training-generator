// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Processor from "../src/renderer/processor.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
import { clearCache } from "../src/renderer/cache.js"
let processor: Processor
let mockGeneratePrompt: any
let mockCreateTrainingItem: any
let mockOnChunkComplete: any
let mockOnChunkError: any
function stubElectronAPI(cacheData: Record<string, any> = {}): void {
    vi.stubGlobal("window", {
        electronAPI: {
            generateWithOllamaStream: vi.fn(),
            loadCache: vi.fn(async() => ({ success: true, data: cacheData })),
            saveCache: vi.fn(async() => ({ success: true })),
            clearCache: vi.fn(async() => ({ success: true }))
        }
    })
}
function createMockProvider(name: string, generateFn?: (prompt: string, model: string) => Promise<ProviderResult>): Provider {
    return {
        name,
        generate: vi.fn(async(prompt: string, model: string): Promise<ProviderResult> => {
            if (generateFn) return generateFn(prompt, model)
            return { text: `Response for: ${prompt.substring(0, 30)}`, tokens: 10, provider: name }
        })
    }
}
beforeEach(async() => {
    stubElectronAPI()
    await clearCache()
    processor = new Processor()
    mockGeneratePrompt = vi.fn(async(chunk: string, type: string) => `Prompt for: ${chunk}`)
    mockCreateTrainingItem = vi.fn((input: string, output: string, type: string) => [{ input, output }])
    mockOnChunkComplete = vi.fn()
    mockOnChunkError = vi.fn()
})
afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("Processor splitBatchedResponse", () => {
    it("splits on chunk markers", () => {
        let response = "--- CHUNK 1 ---\nfirst\n\n--- CHUNK 2 ---\nsecond"
        let parts = processor.splitBatchedResponse(response, 2)
        expect(parts.length).toBe(2)
        expect(parts[0]).toBe("first")
        expect(parts[1]).toBe("second")
    })
    it("pads missing responses with empty strings", () => {
        let response = "--- CHUNK 1 ---\nonly"
        let parts = processor.splitBatchedResponse(response, 3)
        expect(parts.length).toBe(3)
        expect(parts[0]).toBe("only")
        expect(parts[1]).toBe("")
        expect(parts[2]).toBe("")
    })
    it("trims excess responses", () => {
        let response = "--- CHUNK 1 ---\na\n\n--- CHUNK 2 ---\nb\n\n--- CHUNK 3 ---\nc"
        let parts = processor.splitBatchedResponse(response, 2)
        expect(parts.length).toBe(2)
    })
    it("handles empty response", () => {
        let parts = processor.splitBatchedResponse("", 2)
        expect(parts.length).toBe(2)
        expect(parts[0]).toBe("")
        expect(parts[1]).toBe("")
    })
    it("handles response with only whitespace before first marker", () => {
        let response = "   \n--- CHUNK 1 ---\na"
        let parts = processor.splitBatchedResponse(response, 1)
        expect(parts[0]).toBe("a")
    })
})
describe("Processor batching", () => {
    it("batches small chunks when provider is not ollama", async() => {
        processor.provider = createMockProvider("openai")
        processor.concurrency = 1
        let chunks = ["small a", "small b", "small c"]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(3)
        let generateCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(generateCalls).toBe(1)
    })
    it("does not batch when provider is ollama", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        let chunks = ["small a", "small b"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let generateCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(generateCalls).toBe(2)
    })
    it("does not batch in demo mode", async() => {
        processor.provider = createMockProvider("openai")
        processor.enableDemoMode()
        processor.concurrency = 1
        let chunks = ["small a", "small b"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let generateCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(generateCalls).toBe(0)
    })
    it("falls back to individual processing when batch fails", async() => {
        let callCount = 0
        processor.provider = createMockProvider("openai", async() => {
            callCount++
            throw new Error("batch failed")
        })
        processor.concurrency = 1
        let chunks = ["small a", "small b"]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(0)
        expect(mockOnChunkError).toHaveBeenCalledTimes(2)
    })
    it("respects batch size limit by splitting into multiple batches", async() => {
        processor.provider = createMockProvider("openai")
        processor.concurrency = 1
        let chunks = ["x".repeat(400), "x".repeat(400)]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let generateCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(generateCalls).toBeGreaterThanOrEqual(1)
    })
})
describe("Processor caching", () => {
    it("uses cached result without calling provider", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        let chunks = ["cached chunk"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let firstCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(firstCalls).toBe(1)
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let secondCalls = (processor.provider!.generate as ReturnType<typeof vi.fn>).mock.calls.length
        expect(secondCalls).toBe(1)
    })
    it("stores result in cache after generation", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        let chunks = ["store me"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        await new Promise(resolve => setTimeout(resolve, 600))
        expect(window.electronAPI!.saveCache).toHaveBeenCalled()
    })
})
describe("Processor abort", () => {
    it("aborts during batch processing", async() => {
        processor.provider = createMockProvider("openai", async() => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return { text: "batch response", tokens: 10, provider: "openai" }
        })
        processor.concurrency = 1
        let chunks = ["small a", "small b", "small c"]
        let promise = processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        await new Promise(resolve => setTimeout(resolve, 10))
        processor.abort()
        let results = await promise
        expect(results.length).toBeLessThan(3)
    })
    it("reset clears aborted state", () => {
        processor.abort()
        expect(processor.isAborted).toBe(true)
        processor.reset()
        expect(processor.isAborted).toBe(false)
    })
})
describe("Processor edge cases", () => {
    it("skips chunks with empty prompts", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        mockGeneratePrompt = vi.fn(async() => "")
        let chunks = ["chunk"]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(0)
        expect(mockOnChunkComplete).not.toHaveBeenCalled()
    })
    it("handles all empty chunks", async() => {
        processor.provider = createMockProvider("ollama")
        let chunks = ["", "   ", "\n"]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(0)
    })
    it("records stats for successful chunks", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        let chunks = ["chunk"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let report = processor.stats.report
        expect(report.totalChunks).toBeGreaterThan(0)
    })
    it("records stats for failed chunks", async() => {
        processor.provider = createMockProvider("ollama", async() => { throw new Error("fail") })
        processor.concurrency = 1
        let chunks = ["chunk"]
        await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        let report = processor.stats.report
        expect(report.failedChunks).toBeGreaterThan(0)
    })
    it("processes large chunks individually when mixed with small ones", async() => {
        processor.provider = createMockProvider("openai")
        processor.concurrency = 1
        let chunks = ["small", "x".repeat(600), "small2"]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(3)
    })
    it("handles single chunk", async() => {
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        let results = await processor.processChunks(
            ["only"], "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(1)
    })
    it("handles chunks larger than batch max alone", async() => {
        processor.provider = createMockProvider("openai")
        processor.concurrency = 1
        let chunks = ["x".repeat(50000)]
        let results = await processor.processChunks(
            chunks, "model", "instruction",
            mockGeneratePrompt, mockCreateTrainingItem,
            mockOnChunkComplete, mockOnChunkError
        )
        expect(results.length).toBe(1)
    })
})
