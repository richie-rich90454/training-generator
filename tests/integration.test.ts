// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Processor from "../src/renderer/processor.js"
import { createOutputStore, type OutputStore, type ExportFormat } from "../src/renderer/stores/outputStore.js"
import { withRoot } from "./setup.js"
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "../src/renderer/checkpoint.js"
import { deduplicate } from "../src/renderer/deduplicator.js"
import { validateItems } from "../src/renderer/qualityValidator.js"
import { semanticChunk, simpleChunk } from "../src/renderer/chunker.js"
import { clearCache, resetCacheStats } from "../src/renderer/cache.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
import type { TrainingItem, SelectedFile } from "../src/types/index.js"
let disposes: Array<() => void> = []
beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
})
function makeMockApp(format: string="jsonl"): { format: string; outputStore: OutputStore } {
    let outputStore = withRoot((dispose) => {
        disposes.push(dispose)
        return createOutputStore()
    })
    outputStore.setExportFormat(format as ExportFormat)
    return { format, outputStore }
}
afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
})
function makeMockProvider(responseText: string): Provider {
    return {
        name: "mock",
        generate: vi.fn(async (): Promise<ProviderResult> => {
            return { text: responseText, tokens: Math.ceil(responseText.length/4), provider: "mock" }
        })
    }
}
async function generatePrompt(chunk: string, processingType: string): Promise<string> {
    return `Process this ${processingType} text: ${chunk}`
}
function setOutputData(store: OutputStore, items: TrainingItem[]): void {
    store.clearOutput()
    store.appendOutput(items)
}
describe("integration: processor + output store", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let formats=["jsonl", "json", "csv", "text", "chatml"]
    formats.forEach(format => {
        it(`processes instruction chunks into ${format} format`, async() => {
            let processor=new Processor()
            processor.provider=makeMockProvider("Question: What is the capital of France?\nAnswer: Paris is the capital of France and it is beautiful.")
            processor.concurrency=1
            let app=makeMockApp(format)
            let chunks=["France is a country in Europe. Its capital is Paris."]
            let results=await processor.processChunks(
                chunks,
                "model",
                "instruction",
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            expect(results.length).toBeGreaterThan(0)
            if(format==="chatml"){
                expect(results[0].messages).toBeDefined()
            }
            else if(format==="text"){
                expect(results[0].text).toBeDefined()
            }
            else if(format==="csv"){
                expect(results[0].input).toBeDefined()
                expect(results[0].output).toBeDefined()
            }
            else{
                expect(results[0].instruction).toBeDefined()
                expect(results[0].output).toBeDefined()
            }
        })
    })
    it("processes multiple chunks concurrently", async() => {
        let processor=new Processor()
        // Each call returns a DIFFERENT Q&A pair so deduplication doesn't collapse them
        let calls=0
        processor.provider={
            name:"mock",
            async generate(){
                calls++
                return{
                    text:`Question: What is X${calls}?\nAnswer: X${calls} is a variable used in programming.`,
                    tokens:10,
                    provider:"mock"
                }
            }
        } as any
        processor.concurrency=3
        let app=makeMockApp("jsonl")
        // Chunks must be >500 chars to avoid batching (batching combines small chunks)
        let longContent="This is detailed chunk content that exceeds the 500 character batching threshold. ".repeat(10)
        let chunks=[
            longContent + " Chunk one unique suffix.",
            longContent + " Chunk two unique suffix.",
            longContent + " Chunk three unique suffix."
        ]
        let results=await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThanOrEqual(3)
    })
    it("uses cache on repeated chunks", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Answer: cached response")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let firstChunks=["Same chunk content repeated for caching test. ".repeat(30)]
        let secondChunks=["Same chunk content repeated for caching test. ".repeat(30)]
        let firstResults=await processor.processChunks(
            firstChunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        let secondResults=await processor.processChunks(
            secondChunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(firstResults.length).toBeGreaterThan(0)
        expect(secondResults.length).toBeGreaterThan(0)
        expect(vi.mocked(processor.provider.generate)).toHaveBeenCalledTimes(1)
    })
    it("processes conversation type output", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("User: Hello\nAssistant: Hi there, how can I help you?")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let chunks=["A conversation about greetings."]
        let results=await processor.processChunks(
            chunks,
            "model",
            "conversation",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
    })
    it("processes chunking type output", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("This is a detailed summary of the input text that covers all key points.")
        processor.concurrency=1
        let app=makeMockApp("text")
        let chunks=["Some text to summarize."]
        let results=await processor.processChunks(
            chunks,
            "model",
            "chunking",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].text).toBeDefined()
    })
    it("processes custom type output", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Custom structured analysis of the provided text.")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let chunks=["Text for custom processing."]
        let results=await processor.processChunks(
            chunks,
            "model",
            "custom",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
    })
    it("demo mode produces output without provider", async() => {
        let processor=new Processor()
        processor.enableDemoMode()
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let chunks=["Demo chunk content for testing demo mode integration."]
        let results=await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
    })
})
describe("integration: chunking + deduplication", () => {
    it("chunks text then deduplicates identical items", async() => {
        let text="The sky is blue. The grass is green. The sky is blue. The grass is green."
        let chunks=semanticChunk(text, 100, 0)
        expect(chunks.length).toBeGreaterThan(0)
        let items: TrainingItem[]=chunks.map((chunk, i) => ({
            format: "instruction" as const,
            instruction: `Q${i}`,
            input: "",
            output: chunk
        }))
        let result=deduplicate(items, 0.95)
        expect(result.removed).toBeGreaterThanOrEqual(0)
        expect(result.items.length).toBeGreaterThan(0)
    })
    it("deduplicates exact duplicate training items", () => {
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "Q1", input: "", output: "Same answer repeated here for deduplication." },
            { format: "instruction", instruction: "Q2", input: "", output: "Same answer repeated here for deduplication." },
            { format: "instruction", instruction: "Q3", input: "", output: "A different answer appears in this item." }
        ]
        let result=deduplicate(items, 0.95)
        expect(result.removed).toBe(1)
        expect(result.items.length).toBe(2)
    })
    let chunkSizes=[50, 100, 200, 500]
    chunkSizes.forEach(size => {
        it(`simpleChunk produces processable chunks at size ${size}`, () => {
            let text="First sentence here. Second sentence here. Third sentence here. Fourth sentence here."
            let chunks=simpleChunk(text, size)
            expect(chunks.length).toBeGreaterThan(0)
            chunks.forEach(chunk => expect(chunk.length).toBeGreaterThan(0))
        })
    })
})
describe("integration: quality validation", () => {
    it("validates processor output and reports pass rate", () => {
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "What is the capital of France?", input: "", output: "Paris is the capital of France and it is beautiful." },
            { format: "instruction", instruction: "What is 2+2?", input: "", output: "The answer is four." }
        ]
        let report=validateItems(items)
        expect(report.totalItems).toBe(2)
        expect(report.passRate).toBeLessThanOrEqual(100)
    })
    it("flags low quality output from pipeline", () => {
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "What?", input: "", output: "Yes" },
            { format: "instruction", instruction: "Why?", input: "", output: "No" }
        ]
        let report=validateItems(items)
        expect(report.flaggedItems).toBeGreaterThan(0)
    })
    it("validates chatml formatted output", () => {
        let items: TrainingItem[]=[{
            format: "chatml" as const,
            messages: [
                { role: "user", content: "Hello, how are you?" },
                { role: "assistant", content: "I am doing well, thank you for asking. How can I help?" }
            ]
        }]
        let report=validateItems(items)
        expect(report.passRate).toBe(100)
    })
})
describe("integration: checkpoint save/load", () => {
    let savedCheckpoints: any[]=[]
    beforeEach(() => {
        savedCheckpoints=[]
        vi.stubGlobal("window", {
            electronAPI: {
                saveCheckpoint: vi.fn(async(data: any) => { savedCheckpoints.push(data); return { success: true } }),
                loadCheckpoint: vi.fn(async() => {
                    if(savedCheckpoints.length===0) return { success: false }
                    return { success: true, data: savedCheckpoints[savedCheckpoints.length-1] }
                }),
                clearCheckpoint: vi.fn(async() => { savedCheckpoints=[]; return { success: true } })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("saves and loads checkpoint data", async() => {
        let data={
            files: [{ file: null, name: "test.txt", size: 0, type: "txt", path: null } as SelectedFile],
            completedChunks: { "test.txt": 1 },
            outputData: [{ format: "instruction" as const, instruction: "Q", input: "", output: "A" }],
            config: { model: "m", processingType: "instruction", chunkSize: 1000, concurrency: 1, provider: "ollama" },
            timestamp: Date.now()
        }
        await saveCheckpoint(data)
        let loaded=await loadCheckpoint()
        expect(loaded).not.toBeNull()
        expect(loaded!.outputData.length).toBe(1)
        expect(loaded!.files.length).toBe(1)
    })
    it("clears saved checkpoint", async() => {
        let data={
            files: [],
            completedChunks: {},
            outputData: [{ format: "instruction" as const, instruction: "Q", input: "", output: "A" }],
            config: { model: "m", processingType: "instruction", chunkSize: 1000, concurrency: 1, provider: "ollama" },
            timestamp: Date.now()
        }
        await saveCheckpoint(data)
        await clearCheckpoint()
        let loaded=await loadCheckpoint()
        expect(loaded).toBeNull()
    })
    it("returns null when no checkpoint exists", async() => {
        let loaded=await loadCheckpoint()
        expect(loaded).toBeNull()
    })
    it("handles save checkpoint errors gracefully", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveCheckpoint: vi.fn(async() => { throw new Error("save failed") })
            }
        })
        await expect(saveCheckpoint({} as any)).resolves.not.toThrow()
    })
    it("handles load checkpoint errors gracefully", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCheckpoint: vi.fn(async() => { throw new Error("load failed") })
            }
        })
        let loaded=await loadCheckpoint()
        expect(loaded).toBeNull()
    })
})
describe("integration: export and copy", () => {
    let savedFiles: Array<{ path: string; content: string }>=[]
    let clipboardText: string=""
    beforeEach(() => {
        savedFiles=[]
        clipboardText=""
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: true }
                })
            }
        })
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async(text: string) => { clipboardText=text })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let exportFormats=["jsonl", "json", "csv", "text"]
    exportFormats.forEach(format => {
        it(`exports output in ${format} format`, async() => {
            let app=makeMockApp(format)
            setOutputData(app.outputStore, [
                { format: "instruction", instruction: "Q1", input: "", output: "A1" },
                { format: "instruction", instruction: "Q2", input: "", output: "A2" }
            ])
            await app.outputStore.exportOutput(format)
            expect(savedFiles.length).toBe(1)
            expect(savedFiles[0].path).toContain(format==="text" ? ".txt" : `.${format}`)
            expect(savedFiles[0].content.length).toBeGreaterThan(0)
        })
    })
    it("cancels export when dialog returns no path", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async() => null),
                saveFile: vi.fn(async() => ({ success: true }))
            }
        })
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [{ format: "instruction", instruction: "Q", input: "", output: "A" }])
        await app.outputStore.exportOutput("jsonl")
        expect(savedFiles.length).toBe(0)
    })
    it("is a no-op when exporting empty output", async() => {
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [])
        await app.outputStore.exportOutput("jsonl")
        expect(savedFiles.length).toBe(0)
    })
    exportFormats.forEach(format => {
        it(`copies output in ${format} format`, async() => {
            let app=makeMockApp(format)
            setOutputData(app.outputStore, [{ format: "instruction", instruction: "Q", input: "", output: "A" }])
            await app.outputStore.copyOutput()
            expect(clipboardText.length).toBeGreaterThan(0)
        })
    })
    it("is a no-op when copying empty output", async() => {
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [])
        await app.outputStore.copyOutput()
        expect(clipboardText).toBe("")
    })
})
describe("integration: full pipeline simulation", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("chunks, processes, deduplicates, and validates output", async() => {
        let text="Machine learning is a subset of artificial intelligence. Neural networks are used in deep learning. Machine learning models learn from data."
        let chunks=semanticChunk(text, 200, 0)
        expect(chunks.length).toBeGreaterThan(0)
        let processor=new Processor()
        processor.provider=makeMockProvider("Question: What is machine learning?\nAnswer: Machine learning is a subset of artificial intelligence where models learn from data.")
        processor.concurrency=2
        let app=makeMockApp("jsonl")
        let results=await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
        let deduped=deduplicate(results, 0.9)
        expect(deduped.items.length).toBeGreaterThan(0)
        let report=validateItems(deduped.items)
        expect(report.totalItems).toBe(deduped.items.length)
    })
    it("handles empty chunk input through pipeline", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Answer: empty")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let results=await processor.processChunks(
            [],
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBe(0)
    })
    it("handles all whitespace chunks through pipeline", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Answer: whitespace")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let results=await processor.processChunks(
            ["   ", "\n\n"],
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBe(0)
    })
})
describe("integration: edge cases and error handling", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("continues processing when some chunks fail", async() => {
        let callCount=0
        let provider: Provider={
            name: "ollama",
            generate: vi.fn(async(): Promise<ProviderResult> => {
                callCount++
                if(callCount===1) throw new Error("first chunk fails")
                return { text: "Answer: success", tokens: 10, provider: "ollama" }
            })
        }
        let processor=new Processor()
        processor.provider=provider
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let results=await processor.processChunks(
            ["chunk one", "chunk two"],
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThanOrEqual(1)
    })
    it("abort stops processing mid-pipeline", async() => {
        let processor=new Processor()
        processor.provider={
            name: "slow",
            generate: vi.fn(async(): Promise<ProviderResult> => {
                await new Promise(resolve => setTimeout(resolve, 50))
                return { text: "Answer: delayed", tokens: 10, provider: "slow" }
            })
        }
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let promise=processor.processChunks(
            ["a", "b", "c", "d", "e"],
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        processor.abort()
        let results=await promise
        expect(results.length).toBeLessThanOrEqual(5)
        expect(processor.isAborted).toBe(true)
    })
    it("handles provider returning empty response", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let results=await processor.processChunks(
            ["chunk"],
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        // Empty response produces 0 Q&A pairs, so 0 items — this is correct
        // behavior (no fallback to prevent trash in the dataset)
        expect(results.length).toBe(0)
    })
})
describe("integration: processor format x processing type matrix", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let formats=["jsonl", "json", "csv", "text", "chatml"]
    let processingTypes=["conversation", "chunking", "custom"]
    let responses: Record<string, string>={
        conversation: "User: Hello\nAssistant: Hi there, how can I help you today?",
        chunking: "This is a detailed summary of the input text that covers all key points and maintains logical flow.",
        custom: "Custom structured analysis of the provided text with key concepts and relationships."
    }
    processingTypes.forEach(type => {
        formats.forEach(format => {
            it(`processes ${type} into ${format} format`, async() => {
                let processor=new Processor()
                processor.provider=makeMockProvider(responses[type])
                processor.concurrency=1
                let app=makeMockApp(format)
                let chunks=[`Sample content for ${type} processing format test.`]
                let results=await processor.processChunks(
                    chunks,
                    "model",
                    type,
                    generatePrompt,
                    (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                    () => {},
                    () => {}
                )
                expect(results.length).toBeGreaterThan(0)
            })
        })
    })
})
describe("integration: cache behavior", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("reduces provider calls when cache hits", async() => {
        let generate=vi.fn(async(): Promise<ProviderResult> => {
            return { text: "Answer: cached value", tokens: 10, provider: "mock" }
        })
        let processor=new Processor()
        processor.provider={ name: "ollama", generate }
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let chunks=["chunk for cache testing"]
        await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(generate).toHaveBeenCalledTimes(1)
    })
    let chunkVariations=["first cache key", "second cache key", "third cache key"]
    chunkVariations.forEach(chunk => {
        it(`caches result for chunk "${chunk}"`, async() => {
            let processor=new Processor()
            processor.provider=makeMockProvider("Answer: cached")
            processor.concurrency=1
            let app=makeMockApp("jsonl")
            await processor.processChunks(
                [chunk],
                "model",
                "instruction",
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            let second=await processor.processChunks(
                [chunk],
                "model",
                "instruction",
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            expect(second.length).toBeGreaterThan(0)
        })
    })
})
describe("integration: quality validator rules", () => {
    let validItems: TrainingItem[]=[
        { format: "instruction", instruction: "What is the capital of France?", input: "", output: "Paris is the capital of France and it is beautiful." }
    ]
    let shortAnswerItems: TrainingItem[]=[
        { format: "instruction", instruction: "What?", input: "", output: "Yes" }
    ]
    let missingAnswerItems: TrainingItem[]=[
        { format: "instruction", instruction: "What is the answer?", input: "", output: "" }
    ]
    let missingQuestionItems: TrainingItem[]=[
        { format: "instruction", instruction: "", input: "", output: "This is a long enough answer for validation purposes." }
    ]
    let languageMismatchItems: TrainingItem[]=[
        { format: "instruction", instruction: "这是什么？", input: "", output: "This is an English answer that is long enough." }
    ]
    let cases: Array<{ name: string; items: TrainingItem[]; expectFlagged: boolean }>=[
        { name: "valid", items: validItems, expectFlagged: false },
        { name: "short answer", items: shortAnswerItems, expectFlagged: true },
        { name: "missing answer", items: missingAnswerItems, expectFlagged: true },
        { name: "missing question", items: missingQuestionItems, expectFlagged: true },
        { name: "language mismatch", items: languageMismatchItems, expectFlagged: true }
    ]
    cases.forEach(({ name, items, expectFlagged }) => {
        it(`${expectFlagged ? "flags" : "passes"} ${name} items`, () => {
            let report=validateItems(items)
            if(expectFlagged){
                expect(report.flaggedItems).toBeGreaterThan(0)
            }
            else{
                expect(report.flaggedItems).toBe(0)
                expect(report.passRate).toBe(100)
            }
        })
    })
    it("validates multiple item formats in one report", () => {
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "Q1", input: "", output: "A long enough answer for the first question." },
            { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there, how can I help you today?" }] },
            { format: "text", text: "This is a long enough text answer for validation purposes." }
        ]
        let report=validateItems(items)
        expect(report.totalItems).toBe(3)
        expect(report.passRate).toBe(100)
    })
})
describe("integration: deduplication thresholds", () => {
    let items: TrainingItem[]=[
        { format: "instruction", instruction: "Q1", input: "", output: "This is exactly the same answer for deduplication testing." },
        { format: "instruction", instruction: "Q2", input: "", output: "This is exactly the same answer for deduplication testing." },
        { format: "instruction", instruction: "Q3", input: "", output: "This is a slightly different answer for deduplication testing." }
    ]
    let thresholds=[0.8, 0.9, 0.95, 0.99]
    thresholds.forEach(threshold => {
        it(`deduplicates at threshold ${threshold}`, () => {
            let result=deduplicate(items, threshold)
            expect(result.items.length).toBeGreaterThan(0)
            expect(result.items.length).toBeLessThanOrEqual(items.length)
        })
    })
})
describe("integration: export edge cases", () => {
    let savedFiles: Array<{ path: string; content: string }>=[]
    beforeEach(() => {
        savedFiles=[]
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: true }
                })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("exports chatml items correctly", async() => {
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [
            { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }] }
        ])
        await app.outputStore.exportOutput("jsonl")
        expect(savedFiles[0].content).toContain("messages")
    })
    it("exports text items correctly", async() => {
        let app=makeMockApp("text")
        setOutputData(app.outputStore, [
            { format: "text", text: "First text item." },
            { format: "text", text: "Second text item." }
        ])
        await app.outputStore.exportOutput("text")
        expect(savedFiles[0].content).toContain("First text item")
    })
    it("exports csv with escaped fields", async() => {
        let app=makeMockApp("csv")
        setOutputData(app.outputStore, [
            { format: "instruction", instruction: "Q, quoted", input: "", output: "A, quoted" }
        ])
        await app.outputStore.exportOutput("csv")
        expect(savedFiles[0].content).toContain('"')
    })
    it("copies chatml formatted output", async() => {
        let clipboardText=""
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async(text: string) => { clipboardText=text })
            }
        })
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [
            { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }] }
        ])
        await app.outputStore.copyOutput()
        expect(clipboardText).toContain("messages")
    })
    it("handles save file failure", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: false, error: "disk full" }
                })
            }
        })
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [{ format: "instruction", instruction: "Q", input: "", output: "A" }])
        await expect(app.outputStore.exportOutput("jsonl")).resolves.not.toThrow()
        expect(savedFiles.length).toBe(1)
    })
})
describe("integration: checkpoint variations", () => {
    let savedCheckpoints: any[]=[]
    beforeEach(() => {
        savedCheckpoints=[]
        vi.stubGlobal("window", {
            electronAPI: {
                saveCheckpoint: vi.fn(async(data: any) => { savedCheckpoints.push(data); return { success: true } }),
                loadCheckpoint: vi.fn(async() => {
                    if(savedCheckpoints.length===0) return { success: false }
                    return { success: true, data: savedCheckpoints[savedCheckpoints.length-1] }
                }),
                clearCheckpoint: vi.fn(async() => { savedCheckpoints=[]; return { success: true } })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let sizes=[0, 1, 5, 10]
    sizes.forEach(size => {
        it(`saves and loads checkpoint with ${size} output items`, async() => {
            let data={
                files: [],
                completedChunks: {},
                outputData: Array.from({ length: size }, (_, i) => ({ format: "instruction" as const, instruction: `Q${i}`, input: "", output: `A${i}` })),
                config: { model: "m", processingType: "instruction", chunkSize: 1000, concurrency: 1, provider: "ollama" },
                timestamp: Date.now()
            }
            await saveCheckpoint(data)
            let loaded=await loadCheckpoint()
            expect(loaded).not.toBeNull()
            expect(loaded!.outputData.length).toBe(size)
        })
    })
    it("preserves checkpoint config fields", async() => {
        let data={
            files: [{ file: null, name: "f.txt", size: 0, type: "txt", path: null } as SelectedFile],
            completedChunks: { "f.txt": 3 },
            outputData: [],
            config: { model: "llama3", processingType: "conversation", chunkSize: 2000, concurrency: 3, provider: "openai" },
            timestamp: 12345
        }
        await saveCheckpoint(data)
        let loaded=await loadCheckpoint()
        expect(loaded!.config.model).toBe("llama3")
        expect(loaded!.config.processingType).toBe("conversation")
        expect(loaded!.config.provider).toBe("openai")
        expect(loaded!.timestamp).toBe(12345)
    })
})
describe("integration: processor concurrency and scale", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let concurrencies=[1, 2, 3, 5]
    concurrencies.forEach(concurrency => {
        it(`processes chunks with concurrency=${concurrency}`, async() => {
            let processor=new Processor()
            processor.provider=makeMockProvider("Question: What is X?\nAnswer: X is a variable used in programming.")
            processor.concurrency=concurrency
            let app=makeMockApp("jsonl")
            let chunks=Array.from({ length: 5 }, (_, i) => `Chunk ${i} with enough content to be processed individually rather than batched for concurrency testing.`)
            let results=await processor.processChunks(
                chunks,
                "model",
                "instruction",
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            expect(results.length).toBeGreaterThan(0)
        })
    })
    let chunkCounts=[1, 3, 5, 10]
    chunkCounts.forEach(count => {
        it(`processes ${count} chunks end to end`, async() => {
            let processor=new Processor()
            processor.provider=makeMockProvider("Question: What is X?\nAnswer: X is a variable used in programming.")
            processor.concurrency=2
            let app=makeMockApp("jsonl")
            let chunks=Array.from({ length: count }, (_, i) => `Chunk ${i} with enough content to avoid batching and ensure individual chunk processing path.`)
            let results=await processor.processChunks(
                chunks,
                "model",
                "instruction",
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            expect(results.length).toBeGreaterThan(0)
        })
    })
})
describe("integration: chunking variations", () => {
    let texts=[
        "First sentence. Second sentence. Third sentence. Fourth sentence.",
        "Item one. Item two. Item three.",
        "The quick brown fox jumps over the lazy dog. The dog was not amused by the fox.",
        "Machine learning is a field of study. Neural networks are a subset. Deep learning uses many layers."
    ]
    texts.forEach((text, idx) => {
        it(`semantic chunks text ${idx} without errors`, () => {
            let chunks=semanticChunk(text, 50, 0)
            expect(chunks.length).toBeGreaterThan(0)
            chunks.forEach(chunk => expect(chunk.length).toBeGreaterThan(0))
        })
    })
    let sizes=[30, 60, 100, 250]
    sizes.forEach(size => {
        it(`simpleChunk handles text at size ${size}`, () => {
            let text="A. B. C. D. E. F. G. H. I. J."
            let chunks=simpleChunk(text, size)
            expect(chunks.length).toBeGreaterThan(0)
        })
    })
})
describe("integration: quality validator parameterized", () => {
    let cases: Array<{ name: string; item: TrainingItem; expectPass: boolean }>=[
        {
            name: "valid instruction",
            item: { format: "instruction", instruction: "What is the capital of France?", input: "", output: "Paris is the capital of France and it is beautiful." },
            expectPass: true
        },
        {
            name: "short output",
            item: { format: "instruction", instruction: "What?", input: "", output: "Yes" },
            expectPass: false
        },
        {
            name: "empty output",
            item: { format: "instruction", instruction: "What?", input: "", output: "" },
            expectPass: false
        },
        {
            name: "valid chatml",
            item: { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there, how can I help you today?" }] },
            expectPass: true
        },
        {
            name: "short chatml",
            item: { format: "chatml", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hi" }] },
            expectPass: false
        },
        {
            name: "valid text",
            item: { format: "text", text: "This is a long enough text answer for validation purposes." },
            expectPass: true
        },
        {
            name: "short text",
            item: { format: "text", text: "Short" },
            expectPass: false
        }
    ]
    cases.forEach(({ name, item, expectPass }) => {
        it(`${expectPass ? "passes" : "flags"} ${name} item`, () => {
            let report=validateItems([item])
            expect(report.passRate).toBe(expectPass ? 100 : 0)
        })
    })
})
describe("integration: export format variations", () => {
    let savedFiles: Array<{ path: string; content: string }>=[]
    beforeEach(() => {
        savedFiles=[]
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: true }
                })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let formats=["jsonl", "json", "csv", "text"]
    formats.forEach(format => {
        it(`exports ${format} with multiple item types`, async() => {
            let app=makeMockApp(format)
            setOutputData(app.outputStore, [
                { format: "instruction", instruction: "Q1", input: "", output: "A1" },
                { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }] },
                { format: "text", text: "Plain text item." }
            ])
            await app.outputStore.exportOutput(format)
            expect(savedFiles.length).toBe(1)
            expect(savedFiles[0].content.length).toBeGreaterThan(0)
        })
    })
    it("exports large output split into parts", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: true }
                })
            }
        })
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, Array.from({ length: 100001 }, (_, i) => ({ format: "instruction", instruction: `Q${i}`, input: "", output: `A${i}` })))
        await app.outputStore.exportOutput("jsonl")
        expect(savedFiles.length).toBeGreaterThan(1)
    })
})
describe("integration: additional pipeline scenarios", () => {
    beforeEach(async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                loadCache: vi.fn(async() => ({ success: true, data: {} })),
                saveCache: vi.fn(async() => ({ success: true })),
                clearCache: vi.fn(async() => ({ success: true }))
            }
        })
        await clearCache()
        resetCacheStats()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    let processingTypes=["instruction", "conversation", "chunking", "custom"]
    processingTypes.forEach(type => {
        it(`processes ${type} type through full pipeline`, async() => {
            let processor=new Processor()
            let response=type==="instruction"
                ? "Question: Q?\nAnswer: A long enough answer for instruction type testing."
                : type==="conversation"
                    ? "User: Hello\nAssistant: Hi there, how can I help you today?"
                    : type==="chunking"
                        ? "This is a detailed summary of the input text that covers all key points and maintains logical flow."
                        : "Custom structured analysis with key concepts and relationships."
            processor.provider=makeMockProvider(response)
            processor.concurrency=1
            let app=makeMockApp("jsonl")
            let chunks=["Sample content for pipeline integration testing."]
            let results=await processor.processChunks(
                chunks,
                "model",
                type,
                generatePrompt,
                (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
                () => {},
                () => {}
            )
            expect(results.length).toBeGreaterThan(0)
            let report=validateItems(results)
            expect(report.totalItems).toBe(results.length)
        })
    })
    it("deduplicates processor output before validation", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Question: Q?\nAnswer: A long enough answer for deduplication pipeline testing.")
        processor.concurrency=1
        let app=makeMockApp("jsonl")
        let chunks=["chunk one", "chunk one"]
        let results=await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        let deduped=deduplicate(results, 0.9)
        expect(deduped.items.length).toBeGreaterThan(0)
    })
    it("processes chunks with batching enabled and non-empty results", async() => {
        let processor=new Processor()
        processor.provider=makeMockProvider("Question: Q?\nAnswer: A long enough answer for batching integration testing.")
        processor.concurrency=2
        let app=makeMockApp("jsonl")
        let chunks=["small one", "small two", "small three"]
        let results=await processor.processChunks(
            chunks,
            "model",
            "instruction",
            generatePrompt,
            (input, output, type) => app.outputStore.createTrainingItem(input, output, type, app.format),
            () => {},
            () => {}
        )
        expect(results.length).toBeGreaterThan(0)
    })
})
describe("integration: i18n across supported languages", () => {
    beforeEach(() => {
        document.body.innerHTML=`<span data-i18n="app.title"></span>`
    })
    let languages=["en", "zh-Hans", "zh-Hant", "ja", "ko", "es", "fr", "de"]
    languages.forEach(lang => {
        it(`returns non-empty title translation for ${lang}`, async() => {
            let { t }=await import("../src/renderer/i18n.js")
            let title=t("app.title", lang)
            expect(title).toBeTruthy()
            expect(title.length).toBeGreaterThan(0)
        })
    })
    languages.forEach(lang => {
        it(`applies ${lang} translation to DOM`, async() => {
            let { applyLanguage }=await import("../src/renderer/i18n.js")
            applyLanguage(lang)
            let el=document.querySelector('[data-i18n="app.title"]') as HTMLElement
            expect(el.textContent).toBeTruthy()
        })
    })
})
describe("integration: logger with output store", () => {
    let savedFiles: Array<{ path: string; content: string }>=[]
    let clipboardText: string=""
    beforeEach(() => {
        savedFiles=[]
        clipboardText=""
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(defaultName: string) => `C:/mock/${defaultName}`),
                saveFile: vi.fn(async(path: string, content: string) => {
                    savedFiles.push({ path, content })
                    return { success: true }
                })
            }
        })
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async(text: string) => { clipboardText=text })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("exports output when data exists", async() => {
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [{ format: "instruction", instruction: "Q", input: "", output: "A" }])
        await app.outputStore.exportOutput("jsonl")
        expect(savedFiles.length).toBe(1)
    })
    it("copies output when data exists", async() => {
        let app=makeMockApp("jsonl")
        setOutputData(app.outputStore, [{ format: "instruction", instruction: "Q", input: "", output: "A" }])
        await app.outputStore.copyOutput()
        expect(clipboardText.length).toBeGreaterThan(0)
    })
})
