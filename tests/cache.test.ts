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
  it("should round accumulated cost saved to 4 decimals", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response1", 1234)
    await setCachedResult("chunk2", "model1", "prompt2", "response2", 5678)
    resetCacheStats()
    await getCachedResult("chunk1", "model1", "prompt1")
    await getCachedResult("chunk2", "model1", "prompt2")
    let stats = getCacheStats()
    let expected = Math.round(((1234 + 5678) / 1000) * 0.002 * 10000) / 10000
    expect(stats.estimatedCostSaved).toBe(expected)
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
    let warmed = await warmCache(items, "model1", "prompt1")
    expect(warmed).toBe(1)
  })
  it("should warm cache from text items", async () => {
    let items = [{ text: "This is a sample text with enough length." }]
    let warmed = await warmCache(items, "model1", "prompt1")
    expect(warmed).toBe(1)
  })
  it("should warm cache from message items", async () => {
    let items = [{ messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there, how can I help?" }] }]
    let warmed = await warmCache(items, "model1", "prompt1")
    expect(warmed).toBe(1)
  })
  it("should skip items without usable content", async () => {
    let items = [{}, { instruction: "Q", output: "" }, { text: "" }]
    let warmed = await warmCache(items, "model1", "prompt1")
    expect(warmed).toBe(0)
  })
  it("should handle empty array", async () => {
    let warmed = await warmCache([], "model1", "prompt1")
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
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    await clearCache()
    resetCacheStats()
  })
  afterEach(() => {
    vi.restoreAllMocks()
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
describe("cache error branch coverage", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => ({ success: true, data: {} })),
        saveCache: vi.fn(async () => ({ success: true })),
        clearCache: vi.fn(async () => ({ success: true })),
      },
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    await clearCache()
    resetCacheStats()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Load-failure: the catch block in loadCache should log the error.
  it("should log error when load fails", async () => {
    window.electronAPI!.loadCache = vi.fn(async () => { throw new Error("parse error") })
    await getCachedResult("chunk1", "model1", "prompt1")
    expect(console.error).toHaveBeenCalledWith("Cache: failed to load cache", "parse error")
  })

  // Load-failure: cacheLoaded is still set after a failure so load is not retried.
  it("should not retry load after a failure", async () => {
    let loadFn = vi.fn(async () => { throw new Error("parse error") })
    window.electronAPI!.loadCache = loadFn
    await getCachedResult("chunk1", "model1", "prompt1")
    await getCachedResult("chunk2", "model1", "prompt2")
    expect(loadFn).toHaveBeenCalledTimes(1)
  })

  // Save-failure: the debounced save in setCachedResult should catch and log.
  it("should catch and log error when debounced save fails", async () => {
    vi.useFakeTimers()
    window.electronAPI!.saveCache = vi.fn(async () => { throw new Error("quota exceeded") })
    await setCachedResult("chunk1", "model1", "prompt1", "response", 10)
    await vi.advanceTimersByTimeAsync(500)
    expect(console.error).toHaveBeenCalledWith("Cache: failed to save cache entry", "quota exceeded")
  })

  // Clear-failure: the catch block in clearCache should log the error.
  it("should log error when clear fails", async () => {
    window.electronAPI!.clearCache = vi.fn(async () => { throw new Error("ipc error") })
    await clearCache()
    expect(console.error).toHaveBeenCalledWith("Cache: failed to clear cache", "ipc error")
  })

  // Warm-failure: a save error during warm should be handled gracefully.
  it("should handle warm save failure gracefully and return warmed count", async () => {
    window.electronAPI!.saveCache = vi.fn(async () => { throw new Error("warm save failed") })
    let items = [{ instruction: "What is X?", output: "X is a variable." }]
    let warmed = await warmCache(items, "model1", "prompt1")
    expect(warmed).toBe(1)
    expect(console.error).toHaveBeenCalledWith("Cache: failed to save warmed cache entries", "warm save failed")
  })
})
describe("cache TTL and eviction", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {
      electronAPI: {
        loadCache: vi.fn(async () => ({ success: true, data: {} })),
        saveCache: vi.fn(async () => ({ success: true })),
        clearCache: vi.fn(async () => ({ success: true })),
      },
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))
    await clearCache()
    resetCacheStats()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // TTL expiry: an entry older than CACHE_TTL_MS (7 days) is treated as a miss
  // and removed from the cache (cache.ts lines 82-84).
  it("treats expired entries as misses and deletes them", async () => {
    await setCachedResult("chunk1", "model1", "prompt1", "response", 10)
    // Advance past the 7-day TTL (7 * 24 * 60 * 60 * 1000 ms).
    vi.setSystemTime(new Date("2024-01-08T00:00:01Z"))
    let r = await getCachedResult("chunk1", "model1", "prompt1")
    expect(r).toBeNull()
    // The expired entry should have been removed; a second lookup is also a miss.
    let r2 = await getCachedResult("chunk1", "model1", "prompt1")
    expect(r2).toBeNull()
  })

  // Eviction: once the cache exceeds MAX_CACHE_SIZE (10000), the oldest entries
  // are removed (cache.ts lines 106-110).
  it("evicts oldest entries when cache exceeds max size", async () => {
    // Insert 10001 unique entries to trigger eviction on the final insert.
    for (let i = 0; i < 10001; i++) {
      await setCachedResult(`chunk${i}`, "model1", "prompt1", `response${i}`, i)
    }
    // The oldest entry (chunk0) should have been evicted.
    let r0 = await getCachedResult("chunk0", "model1", "prompt1")
    expect(r0).toBeNull()
    // A recent entry should still be present.
    let rLast = await getCachedResult("chunk10000", "model1", "prompt1")
    expect(rLast).not.toBeNull()
  }, 30000)
})