// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Processor from "../src/renderer/processor.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
import type { TrainingItem } from "../src/types/index.js"
import { clearCache } from "../src/renderer/cache.js"
function makeProvider(responseText: string="output"): Provider {
    return {
        name: "mock",
        generate: vi.fn(async(): Promise<ProviderResult> => ({ text: responseText, tokens: Math.ceil(responseText.length/4), provider: "mock" }))
    }
}
function makeOutputManager(): any {
    return {
        createTrainingItem: vi.fn((input: string, output: string, processingType: string): TrainingItem[] => {
            return [{ format: "instruction", instruction: "test", input, output }]
        })
    }
}
async function generatePrompt(chunk: string, processingType: string): Promise<string> {
    return `prompt for ${processingType}: ${chunk}`
}
describe("Processor basic processing", () => {
    beforeEach(async()=>{
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("processes chunks with mocked provider", async() => {
        let processor=new Processor()
        processor.provider=makeProvider("Answer: 42")
        processor.concurrency=1
        let completed=0
        let errors=0
        let items=await processor.processChunks(
            ["chunk1", "chunk2"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{ completed++ },
            ()=>{ errors++ }
        )
        expect(items.length).toBe(2)
        expect(completed).toBe(2)
        expect(errors).toBe(0)
    })
    it("tracks stats", async() => {
        let processor=new Processor()
        processor.provider=makeProvider("response")
        processor.concurrency=1
        await processor.processChunks(
            ["chunk1"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        expect(processor.stats.totalChunks).toBe(1)
        expect(processor.stats.successfulChunks).toBe(1)
        expect(processor.stats.failedChunks).toBe(0)
    })
    it("processes empty chunk list", async() => {
        let processor=new Processor()
        processor.provider=makeProvider()
        let items=await processor.processChunks(
            [],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        expect(items.length).toBe(0)
    })
    it("skips empty chunks", async() => {
        let processor=new Processor()
        processor.provider=makeProvider()
        processor.concurrency=1
        let completed=0
        let items=await processor.processChunks(
            ["", "   ", "valid"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{ completed++ },
            ()=>{}
        )
        expect(items.length).toBe(1)
        expect(completed).toBe(1)
    })
})
describe("Processor abort", () => {
    beforeEach(async()=>{
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("aborts processing", async() => {
        let processor=new Processor()
        processor.provider=makeProvider()
        processor.concurrency=1
        let promise=processor.processChunks(
            ["chunk1", "chunk2", "chunk3"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        processor.abort()
        let items=await promise
        expect(processor.isAborted).toBe(true)
        expect(items.length).toBeLessThanOrEqual(3)
    })
    it("reset creates new abort controller", () => {
        let processor=new Processor()
        processor.abort()
        processor.reset()
        expect(processor.isAborted).toBe(false)
    })
})
describe("Processor demo mode", () => {
    beforeEach(async()=>{
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("enables and disables demo mode", () => {
        let processor=new Processor()
        processor.enableDemoMode()
        expect(processor.demoMode).toBe(true)
        processor.disableDemoMode()
        expect(processor.demoMode).toBe(false)
    })
    it("processes chunks in demo mode without provider", async() => {
        let processor=new Processor()
        processor.enableDemoMode()
        processor.concurrency=1
        let completed=0
        let items=await processor.processChunks(
            ["chunk1"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{ completed++ },
            ()=>{}
        )
        expect(items.length).toBe(1)
        expect(completed).toBe(1)
        expect(items[0].output).toContain("Question")
    })
    it("generates conversation response in demo mode", async() => {
        let processor=new Processor()
        processor.enableDemoMode()
        processor.concurrency=1
        let items=await processor.processChunks(
            ["chunk1"],
            "model",
            "conversation",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        expect(items.length).toBe(1)
        expect(items[0].output).toContain("User")
    })
})
describe("Processor batching", () => {
    beforeEach(async()=>{
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("batches small chunks for non-ollama providers", async() => {
        let processor=new Processor()
        processor.provider={
            name: "openai",
            generate: vi.fn(async(): Promise<ProviderResult> => ({ text: "--- CHUNK 1 ---\nA\n\n--- CHUNK 2 ---\nB", tokens: 2, provider: "openai" }))
        }
        processor.concurrency=1
        let items=await processor.processChunks(
            ["small1", "small2"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        expect(items.length).toBe(2)
    })
    it("splitBatchedResponse parses markers", () => {
        let processor=new Processor()
        let parts=processor.splitBatchedResponse("--- CHUNK 1 ---\nA\n\n--- CHUNK 2 ---\nB", 2)
        expect(parts.length).toBe(2)
        expect(parts[0]).toContain("A")
        expect(parts[1]).toContain("B")
    })
    it("splitBatchedResponse pads missing parts", () => {
        let processor=new Processor()
        let parts=processor.splitBatchedResponse("", 3)
        expect(parts.length).toBe(3)
        expect(parts[0]).toBe("")
    })
    it("does not batch for ollama provider", async() => {
        let processor=new Processor()
        processor.provider=makeProvider("response")
        processor.concurrency=1
        let items=await processor.processChunks(
            ["small1", "small2"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{}
        )
        expect(items.length).toBe(2)
    })
})
describe("Processor error handling", () => {
    beforeEach(async()=>{
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("records chunk failures", async() => {
        let processor=new Processor()
        processor.provider={
            name: "mock",
            generate: vi.fn(async()=>{ throw new Error("fail") })
        }
        processor.concurrency=1
        let errors=0
        await processor.processChunks(
            ["chunk1"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            ()=>{ errors++ }
        )
        expect(processor.stats.failedChunks).toBe(1)
        expect(errors).toBe(1)
    })
    it("calls error callback when no provider and not demo", async() => {
        let processor=new Processor()
        processor.concurrency=1
        let errors=0
        let errorMsg=""
        let items=await processor.processChunks(
            ["chunk1"],
            "model",
            "instruction",
            generatePrompt,
            makeOutputManager().createTrainingItem,
            ()=>{},
            (_idx:number,msg:string)=>{ errors++; errorMsg=msg }
        )
        expect(errors).toBe(1)
        expect(errorMsg).toContain("No provider configured")
        expect(items.length).toBe(0)
    })
})
