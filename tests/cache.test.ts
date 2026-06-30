// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCachedResult, setCachedResult, clearCache, getCacheStats, resetCacheStats, warmCache } from "../src/renderer/cache.js"

describe("cache", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => ({ success: true, data: {} })),
        saveCache: vi.fn(async () => ({ success: true })),
        clearCache: vi.fn(async () => ({ success: true })),
      },
    })
    await clearCache()
  })

  it("should return null for uncached result", async () => {
    let result = await getCachedResult("chunk1", "model1", "prompt1")
    expect(result).toBeNull()
  })

  it("should return cached result after setting", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response text", 100)
    let result = await getCachedResult("chunk1", "model1", "prompt1")
    expect(result).not.toBeNull()
    expect(result!.response).toBe("response text")
    expect(result!.tokens).toBe(100)
  })

  it("should differentiate by chunk content", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    await setCachedResult("chunk2", "model1", "prompt1", "response2", 20)
    let r1 = await getCachedResult("chunk1", "model1", "prompt1")
    let r2 = await getCachedResult("chunk2", "model1", "prompt1")
    expect(r1!.response).toBe("response1")
    expect(r2!.response).toBe("response2")
  })

  it("should differentiate by model", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    let r = await getCachedResult("chunk1", "model2", "prompt1")
    expect(r).toBeNull()
  })

  it("should differentiate by prompt", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    let r = await getCachedResult("chunk1", "model1", "prompt2")
    expect(r).toBeNull()
  })

  it("should clear all cached results", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    await setCachedResult("chunk2", "model1", "prompt1", "response2", 20)
    await clearCache()
    let r1 = await getCachedResult("chunk1", "model1", "prompt1")
    let r2 = await getCachedResult("chunk2", "model1", "prompt1")
    expect(r1).toBeNull()
    expect(r2).toBeNull()
  })

  it("should overwrite existing cache entry", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    await setCachedResult("chunk1", "model1", "prompt1", "response2", 20)
    let r = await getCachedResult("chunk1", "model1", "prompt1")
    expect(r!.response).toBe("response2")
    expect(r!.tokens).toBe(20)
  })

  it("should have timestamp in cache entry", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response", 10)
    let r = await getCachedResult("chunk1", "model1", "prompt1")
    expect(r!.timestamp).toBeGreaterThan(0)
  })

  it("should handle empty strings", async () => {
    await setCachedResult("", "", "", "", 0)
    let r = await getCachedResult("", "", "")
    expect(r).not.toBeNull()
    expect(r!.response).toBe("")
  })

  it("should handle special characters in chunk", async () => {
    await setCachedResult("chunk\nwith\tspecial", "model", "prompt", "response", 10)
    let r = await getCachedResult("chunk\nwith\tspecial", "model", "prompt")
    expect(r!.response).toBe("response")
  })
})
describe("cache stats", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => ({ success: true, data: {} })),
        saveCache: vi.fn(async () => ({ success: true })),
        clearCache: vi.fn(async () => ({ success: true })),
      },
    })
    await clearCache()
    resetCacheStats()
  })
  it("should track misses", async () => {
    let statsBefore = getCacheStats()
    expect(statsBefore.misses).toBe(0)
    await getCachedResult("chunk1", "model1", "prompt1")
    let statsAfter = getCacheStats()
    expect(statsAfter.misses).toBe(1)
    expect(statsAfter.totalRequests).toBe(1)
  })
  it("should track hits", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response", 100)
    resetCacheStats()
    await getCachedResult("chunk1", "model1", "prompt1")
    let stats = getCacheStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(0)
    expect(stats.totalRequests).toBe(1)
    expect(stats.estimatedTokensSaved).toBe(100)
    expect(stats.estimatedCostSaved).toBeGreaterThan(0)
  })
  it("should reset stats", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response", 100)
    await getCachedResult("chunk1", "model1", "prompt1")
    resetCacheStats()
    let stats = getCacheStats()
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
    expect(stats.totalRequests).toBe(0)
    expect(stats.estimatedTokensSaved).toBe(0)
  })
  it("should accumulate hits across multiple lookups", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 10)
    await setCachedResult("chunk2", "model1", "prompt2", "response2", 20)
    resetCacheStats()
    await getCachedResult("chunk1", "model1", "prompt1")
    await getCachedResult("chunk2", "model1", "prompt2")
    await getCachedResult("missing", "model1", "prompt3")
    let stats = getCacheStats()
    expect(stats.hits).toBe(2)
    expect(stats.misses).toBe(1)
    expect(stats.estimatedTokensSaved).toBe(30)
  })
})
describe("cache warm", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => ({ success: true, data: {} })),
        saveCache: vi.fn(async () => ({ success: true })),
        clearCache: vi.fn(async () => ({ success: true })),
      },
    })
    await clearCache()
  })
  it("should warm cache from instruction items", async () => {
    let items = [{ instruction: "What is X?", output: "X is a variable." }]
    let warmed = await warmCache(items)
    expect(warmed).toBe(1)
  })
  it("should warm cache from text items", async () => {
    let items = [{ text: "This is a sample text with enough length." }]
    let warmed = await warmCache(items)
    expect(warmed).toBe(1)
  })
  it("should warm cache from message items", async () => {
    let items = [{ messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there, how can I help?" }] }]
    let warmed = await warmCache(items)
    expect(warmed).toBe(1)
  })
  it("should skip items without usable content", async () => {
    let items = [{}, { instruction: "Q", output: "" }, { text: "" }]
    let warmed = await warmCache(items)
    expect(warmed).toBe(0)
  })
  it("should handle empty array", async () => {
    let warmed = await warmCache([])
    expect(warmed).toBe(0)
  })
})
describe("cache failures", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => { throw new Error("load failed") }),
        saveCache: vi.fn(async () => { throw new Error("save failed") }),
        clearCache: vi.fn(async () => { throw new Error("clear failed") }),
      },
    })
    await clearCache()
    resetCacheStats()
  })
  it("should return null when load fails", async () => {
    let r = await getCachedResult("chunk1", "model1", "prompt1")
    expect(r).toBeNull()
  })
  it("should not throw when save fails", async () => {
    await expect(setCachedResult("chunk1", "model1", "prompt1", "response", 10)).resolves.not.toThrow()
  })
  it("should not throw when clear fails", async () => {
    await expect(clearCache()).resolves.not.toThrow()
  })
})