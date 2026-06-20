// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCachedResult, setCachedResult, clearCache } from "../src/renderer/cache.js"

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