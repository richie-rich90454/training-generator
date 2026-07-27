// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createOrchestrator } from "../src/renderer/processing/orchestrator.js"
import type { OrchestratorSettings } from "../src/renderer/processing/orchestrator.js"
import Processor from "../src/renderer/processor.js"
import PromptManager from "../src/renderer/promptManager.js"
import type { SelectedFile, TrainingItem } from "../src/types/index.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
import { semanticChunk } from "../src/renderer/chunker.js"

vi.mock("../src/renderer/workers/workerPool.js", async (importOriginal) => {
    const original = await importOriginal<typeof import("../src/renderer/workers/workerPool.js")>()
    return {
        ...original,
        chunkInWorker: vi.fn((text: string, chunkSize: number, overlap: number, smartSizing: boolean) => {
            // For memory-safety coverage, avoid expensive NLP on huge inputs while still
            // producing enough chunks to exercise maxChunks truncation.
            if (text.length > 50000) {
                return Promise.resolve(Array.from({ length: 10 }, (_, i) => `chunk-${i} ${text.slice(0, 100)}`))
            }
            return Promise.resolve(semanticChunk(text, chunkSize, overlap, smartSizing))
        }),
        dedupInWorker: vi.fn((items: TrainingItem[]) => {
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

function createMockProvider(name: string = "mock", generateFn?: (prompt: string, model: string) => Promise<ProviderResult>): Provider {
    return {
        name,
        generate: vi.fn(async (prompt: string, model: string): Promise<ProviderResult> => {
            if (generateFn) return generateFn(prompt, model)
            return { text: `A: ${prompt.slice(0, 40)}`, tokens: 10, provider: name }
        })
    }
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
        maxChunks: 5,
        ...overrides
    }
}

describe("memory safety", () => {
    let processor: Processor
    let promptManager: PromptManager

    beforeEach(() => {
        vi.stubGlobal("window", {
            electronAPI: {
                getPrompt: vi.fn(async () => ({ success: false })),
                readFile: vi.fn(async () => ({ success: false })),
            },
        })
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "log").mockImplementation(() => {})
        processor = new Processor()
        processor.provider = createMockProvider("ollama")
        processor.concurrency = 1
        promptManager = new PromptManager()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it("caps chunks to maxChunks when chunking yields more than maxChunks", async () => {
        const orchestrator = createOrchestrator({
            processor,
            promptManager,
            createTrainingItem: (input: string, output: string, type: string, format: string) => {
                return [{ format: format as any, instruction: input, output }]
            }
        })
        // Large enough to trigger the synthetic multi-chunk path in the mocked worker
        // without paying the cost of full semantic chunking in tests.
        const largeText = "word ".repeat(12001)
        const file = makeSelectedFile({
            name: "big.txt",
            type: "text/plain",
            file: makeTextFile("big.txt", largeText)
        })
        const onChunkProcessed = vi.fn()
        const onChunkFailed = vi.fn()
        const result = await orchestrator.processFile(file, baseSettings(), { onChunkProcessed, onChunkFailed })
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.length).toBe(5)
        expect(onChunkProcessed).toHaveBeenCalledTimes(5)
        expect(onChunkFailed).toHaveBeenCalledTimes(0)
    })
})
