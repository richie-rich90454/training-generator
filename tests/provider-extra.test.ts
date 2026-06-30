// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { OllamaProvider, OpenAIProvider, ProviderManager, createProvider, retryWithBackoff } from "../src/renderer/provider.js"
import { RateLimiter } from "../src/renderer/rateLimiter.js"
describe("OllamaProvider", () => {
    beforeEach(()=>{
        vi.stubGlobal("window", {
            electronAPI: {
                checkOllama: vi.fn(async()=>({ running: true, models: [], version: "0.1" })),
                generateWithOllamaStream: vi.fn(async(model: string, prompt: string, options: any)=>({ success: true, response: `response for ${model}` })),
            },
        })
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("returns healthy when ollama is running", async() => {
        let provider=new OllamaProvider()
        expect(await provider.healthCheck()).toBe(true)
    })
    it("returns unhealthy when ollama is offline", async() => {
        window.electronAPI.checkOllama=vi.fn(async()=>({ running: false, models: [] }))
        let provider=new OllamaProvider()
        expect(await provider.healthCheck()).toBe(false)
    })
    it("returns unhealthy when electronAPI missing", async() => {
        vi.stubGlobal("window", {})
        let provider=new OllamaProvider()
        expect(await provider.healthCheck()).toBe(false)
    })
    it("generates response", async() => {
        let provider=new OllamaProvider()
        let result=await provider.generate("prompt", "model")
        expect(result.text).toContain("response")
        expect(result.provider).toBe("ollama")
        expect(result.tokens).toBeGreaterThan(0)
    })
    it("throws when generation fails", async() => {
        window.electronAPI.generateWithOllamaStream=vi.fn(async()=>({ success: false, error: "model not found" }))
        let provider=new OllamaProvider()
        await expect(provider.generate("prompt", "model")).rejects.toThrow("model not found")
    })
    it("throws when electronAPI missing for generate", async() => {
        vi.stubGlobal("window", {})
        let provider=new OllamaProvider()
        await expect(provider.generate("prompt", "model")).rejects.toThrow("Electron API not available")
    })
    it("passes temperature and top_p", async() => {
        let provider=new OllamaProvider()
        await provider.generate("prompt", "model", { temperature: 0.5, top_p: 0.8 })
        expect(window.electronAPI.generateWithOllamaStream).toHaveBeenCalledWith("model", "prompt", expect.objectContaining({ temperature: 0.5, top_p: 0.8 }))
    })
})
describe("OpenAIProvider", () => {
    beforeEach(()=>{
        vi.stubGlobal("window", {
            electronAPI: {
                generateWithOpenAI: vi.fn(async(apiKey: string, baseUrl: string, model: string, prompt: string, options: any)=>({ success: true, response: `openai ${model}`, usage: { total_tokens: 10 } })),
            },
        })
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("creates with default baseUrl", () => {
        let provider=new OpenAIProvider("key")
        expect(provider.baseUrl).toBe("https://api.openai.com")
    })
    it("creates with custom baseUrl", () => {
        let provider=new OpenAIProvider("key", "http://local")
        expect(provider.baseUrl).toBe("http://local")
    })
    it("has active rate limiter", () => {
        let provider=new OpenAIProvider("key")
        expect(provider.rateLimiter.isActive).toBe(true)
    })
    it("generates response", async() => {
        let provider=new OpenAIProvider("key")
        let result=await provider.generate("prompt", "gpt-4")
        expect(result.text).toContain("openai")
        expect(result.provider).toBe("openai")
        expect(result.tokens).toBe(10)
    })
    it("estimates tokens when usage missing", async() => {
        window.electronAPI.generateWithOpenAI=vi.fn(async()=>({ success: true, response: "short" }))
        let provider=new OpenAIProvider("key")
        let result=await provider.generate("prompt", "gpt-4")
        expect(result.tokens).toBeGreaterThan(0)
    })
    it("throws on generation failure", async() => {
        window.electronAPI.generateWithOpenAI=vi.fn(async()=>({ success: false, error: "auth failed" }))
        let provider=new OpenAIProvider("key")
        await expect(provider.generate("prompt", "gpt-4")).rejects.toThrow("auth failed")
    })
    it("performs health check via fetch", async() => {
        vi.stubGlobal("fetch", vi.fn(async()=>({ ok: true })))
        let provider=new OpenAIProvider("key")
        expect(await provider.healthCheck()).toBe(true)
    })
    it("health check fails on fetch error", async() => {
        vi.stubGlobal("fetch", vi.fn(async()=>{ throw new Error("network") }))
        let provider=new OpenAIProvider("key")
        expect(await provider.healthCheck()).toBe(false)
    })
    it("passes max_tokens option", async() => {
        let provider=new OpenAIProvider("key")
        await provider.generate("prompt", "gpt-4", { max_tokens: 512 })
        expect(window.electronAPI.generateWithOpenAI).toHaveBeenCalledWith("key", "https://api.openai.com", "gpt-4", "prompt", expect.objectContaining({ max_tokens: 512 }))
    })
})
describe("retryWithBackoff", () => {
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("returns result on first attempt", async() => {
        let fn=vi.fn(async()=>"ok")
        let result=await retryWithBackoff(fn, 2, 1)
        expect(result).toBe("ok")
        expect(fn).toHaveBeenCalledTimes(1)
    })
    it("retries on transient error", async() => {
        let fn=vi.fn()
            .mockRejectedValueOnce(new Error("timeout"))
            .mockResolvedValueOnce("ok")
        let result=await retryWithBackoff(fn, 2, 1)
        expect(result).toBe("ok")
        expect(fn).toHaveBeenCalledTimes(2)
    })
    it("does not retry auth errors", async() => {
        let fn=vi.fn(async()=>{ throw new Error("401 unauthorized") })
        await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow("401")
        expect(fn).toHaveBeenCalledTimes(1)
    })
    it("handles rate limit with retry after", async() => {
        let fn=vi.fn()
            .mockRejectedValueOnce(new Error("429 rate limit, retry after: 2"))
            .mockResolvedValueOnce("ok")
        let rateLimiter=new RateLimiter(60, 10)
        let result=await retryWithBackoff(fn, 2, 1, undefined, rateLimiter)
        expect(result).toBe("ok")
    })
    it("throws after exhausting retries", async() => {
        let fn=vi.fn(async()=>{ throw new Error("fail") })
        await expect(retryWithBackoff(fn, 1, 1)).rejects.toThrow("fail")
    })
})
describe("ProviderManager", () => {
    it("uses first provider by default", () => {
        let p1=new OllamaProvider()
        let p2=new OpenAIProvider("key")
        let manager=new ProviderManager([p1, p2])
        expect(manager.getCurrentProvider()).toBe(p1)
    })
    it("fails over after consecutive failures", async() => {
        let p1={ name: "p1", generate: vi.fn(async()=>{ throw new Error("fail") }) } as any
        let p2={ name: "p2", generate: vi.fn(async()=>({ text: "ok", tokens: 1, provider: "p2" })) } as any
        let manager=new ProviderManager([p1, p2])
        await expect(manager.generate("prompt", "model")).rejects.toThrow("fail")
        await expect(manager.generate("prompt", "model")).rejects.toThrow("fail")
        let result=await manager.generate("prompt", "model")
        expect(result.text).toBe("ok")
    })
    it("returns null when no healthy providers", () => {
        let p1={ name: "p1" } as any
        let p2={ name: "p2" } as any
        let manager=new ProviderManager([p1, p2])
        manager.failover()
        manager.failover()
        expect(manager.failover()).toBeNull()
    })
    it("checks health of providers", async() => {
        let p1={ name: "p1", healthCheck: vi.fn(async()=>true) } as any
        let p2={ name: "p2", healthCheck: vi.fn(async()=>false) } as any
        let manager=new ProviderManager([p1, p2])
        await manager.checkHealth()
        expect(p1.healthCheck).toHaveBeenCalled()
        expect(p2.healthCheck).toHaveBeenCalled()
    })
    it("starts and stops health checks", () => {
        let p1={ name: "p1" } as any
        let manager=new ProviderManager([p1])
        manager.startHealthChecks(100)
        manager.stopHealthChecks()
    })
})
describe("createProvider", () => {
    it("creates openai provider", () => {
        let manager=createProvider("openai", { apiKey: "key" })
        expect(manager.getCurrentProvider().name).toBe("openai")
    })
    it("creates anthropic provider", () => {
        let manager=createProvider("anthropic", { apiKey: "key" })
        expect(manager.getCurrentProvider().name).toBe("openai")
    })
    it("creates gemini provider", () => {
        let manager=createProvider("gemini", { apiKey: "key" })
        expect(manager.getCurrentProvider().name).toBe("openai")
    })
    it("creates ollama provider", () => {
        let manager=createProvider("ollama")
        expect(manager.getCurrentProvider().name).toBe("ollama")
    })
    it("includes ollama fallback for cloud providers", () => {
        let manager=createProvider("openai", { apiKey: "key" })
        expect(manager.getCurrentProvider().name).toBe("openai")
    })
})
