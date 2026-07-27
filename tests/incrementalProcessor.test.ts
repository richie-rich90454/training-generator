// @vitest-environment node
import { describe, test, expect, vi } from "vitest"
import type { TrainingItem } from "../src/types/index.js"
import type { ProcessCacheEntry } from "../src/core/incrementalProcessor.js"
import { IncrementalProcessor, chunkHash } from "../src/core/incrementalProcessor.js"
describe("chunkHash", ()=>{
    test("returns 64-character hex for a chunk", ()=>{
        let hash=chunkHash("hello")
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
    test("returns same hash for same input", ()=>{
        expect(chunkHash("same")).toBe(chunkHash("same"))
    })
    test("returns different hash for different input", ()=>{
        expect(chunkHash("a")).not.toBe(chunkHash("b"))
    })
})
describe("IncrementalProcessor", ()=>{
    test("computeHash is consistent", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        expect(processor.computeHash("chunk")).toBe(processor.computeHash("chunk"))
    })
    test("computeHash uses custom hasher", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p", hasher: (chunk: string)=>`hashed:${chunk}`})
        expect(processor.computeHash("chunk")).toBe("hashed:chunk")
    })
    test("makeCacheKey includes hash model and prompt", ()=>{
        let processor=new IncrementalProcessor({model: "model-a", prompt: "prompt-b"})
        let key=processor.makeCacheKey("hash123")
        expect(key).toBe("hash123:model-a:prompt-b")
    })
    test("isCached returns true after setCached", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        processor.setCached("chunk", [{format: "instruction", instruction: "q", output: "a"}])
        expect(processor.isCached("chunk")).toBe(true)
    })
    test("getCached returns stored items", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        let items: TrainingItem[]=[{format: "instruction", instruction: "q", output: "a"}]
        processor.setCached("chunk", items)
        expect(processor.getCached("chunk")).toEqual(items)
    })
    test("process skips cached chunks", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        let items: TrainingItem[]=[{format: "instruction", instruction: "cached", output: "a"}]
        processor.setCached("chunk", items)
        let result=await processor.process(["chunk"], async (): Promise<TrainingItem[]>=>[{format: "instruction", instruction: "new", output: "a"}])
        expect(result.skipped).toBe(1)
        expect(result.processed).toBe(0)
        expect(result.results[0]).toEqual(items)
    })
    test("process processes uncached chunks", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        let result=await processor.process(["chunk"], async (chunk: string): Promise<TrainingItem[]>=>[{format: "instruction", instruction: chunk, output: "a"}])
        expect(result.processed).toBe(1)
        expect(result.skipped).toBe(0)
        expect(result.results[0]).toEqual([{format: "instruction", instruction: "chunk", output: "a"}])
    })
    test("stats updated correctly", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        processor.setCached("cached", [{format: "instruction", instruction: "q", output: "a"}])
        await processor.process(["cached", "new"], async (chunk: string): Promise<TrainingItem[]>=>[{format: "instruction", instruction: chunk, output: "a"}])
        let stats=processor.getStats()
        expect(stats.hitCount).toBe(1)
        expect(stats.missCount).toBe(1)
        expect(stats.skipCount).toBe(1)
    })
    test("different model produces different cache key", ()=>{
        let p1=new IncrementalProcessor({model: "m1", prompt: "p"})
        let p2=new IncrementalProcessor({model: "m2", prompt: "p"})
        expect(p1.makeCacheKey("h")).not.toBe(p2.makeCacheKey("h"))
    })
    test("different prompt produces different cache key", ()=>{
        let p1=new IncrementalProcessor({model: "m", prompt: "p1"})
        let p2=new IncrementalProcessor({model: "m", prompt: "p2"})
        expect(p1.makeCacheKey("h")).not.toBe(p2.makeCacheKey("h"))
    })
    test("empty chunks returns empty results and zero counts", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        let result=await processor.process([], async (): Promise<TrainingItem[]>=>[])
        expect(result.results).toEqual([])
        expect(result.skipped).toBe(0)
        expect(result.processed).toBe(0)
    })
    test("processor not called for cached chunks", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        processor.setCached("chunk", [{format: "instruction", instruction: "q", output: "a"}])
        let mockProcessor=vi.fn(async (_chunk: string): Promise<TrainingItem[]>=>[{format: "instruction", instruction: "new", output: "a"}])
        await processor.process(["chunk"], mockProcessor)
        expect(mockProcessor).not.toHaveBeenCalled()
    })
    test("process returns results matrix in order", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        let result=await processor.process(["a", "b", "c"], async (chunk: string): Promise<TrainingItem[]>=>[{format: "instruction", instruction: chunk, output: "a"}])
        expect(result.results.map(r=>r[0].instruction)).toEqual(["a", "b", "c"])
    })
    test("setCached stores processedAt timestamp", ()=>{
        let cache=new Map<string, ProcessCacheEntry>()
        let processor=new IncrementalProcessor({model: "m", prompt: "p", cache})
        let before=Date.now()
        processor.setCached("chunk", [{format: "instruction", instruction: "q", output: "a"}])
        let after=Date.now()
        let key=processor.makeCacheKey(processor.computeHash("chunk"))
        let entry=cache.get(key)!
        expect(entry.processedAt).toBeGreaterThanOrEqual(before)
        expect(entry.processedAt).toBeLessThanOrEqual(after)
    })
    test("constructor uses provided cache", ()=>{
        let cache=new Map<string, ProcessCacheEntry>()
        let processor=new IncrementalProcessor({model: "m", prompt: "p", cache})
        processor.setCached("chunk", [{format: "instruction", instruction: "q", output: "a"}])
        expect(cache.size).toBe(1)
    })
    test("isCached returns false before setCached", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        expect(processor.isCached("chunk")).toBe(false)
    })
    test("getCached returns undefined for missing chunk", ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        expect(processor.getCached("chunk")).toBeUndefined()
    })
    test("cache entries include hash model prompt and items", ()=>{
        let cache=new Map<string, ProcessCacheEntry>()
        let processor=new IncrementalProcessor({model: "m", prompt: "p", cache})
        let items: TrainingItem[]=[{format: "instruction", instruction: "q", output: "a"}]
        processor.setCached("chunk", items)
        let key=processor.makeCacheKey(processor.computeHash("chunk"))
        let entry=cache.get(key)!
        expect(entry.hash).toBe(processor.computeHash("chunk"))
        expect(entry.model).toBe("m")
        expect(entry.prompt).toBe("p")
        expect(entry.items).toEqual(items)
    })
    test("process caches newly processed chunks", async ()=>{
        let processor=new IncrementalProcessor({model: "m", prompt: "p"})
        await processor.process(["chunk"], async (): Promise<TrainingItem[]>=>[{format: "instruction", instruction: "q", output: "a"}])
        expect(processor.isCached("chunk")).toBe(true)
        let result=await processor.process(["chunk"], async (): Promise<TrainingItem[]>=>[{format: "instruction", instruction: "new", output: "a"}])
        expect(result.skipped).toBe(1)
    })
})
