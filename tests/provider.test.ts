// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { retryWithBackoff, createProvider, OllamaProvider, OpenAIProvider, AnthropicProvider, GeminiProvider, ProviderManager, getStrictGenerationOptions } from "../src/renderer/provider.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"

// Mock window.electronAPI for provider tests
beforeEach(() => {
  vi.stubGlobal("window", {
    electronAPI: {
      generateWithOllamaStream: vi.fn(),
      generateWithOpenAI: vi.fn(),
    },
  })
})

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  it("should return result on first success", async () => {
    let fn = vi.fn(async () => "success")
    let result = await retryWithBackoff(fn)
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("should retry on failure and succeed", async () => {
    let callCount = 0
    let fn = vi.fn(async () => {
      callCount++
      if (callCount < 3) throw new Error("network error")
      return "eventual success"
    })
    let onRetry = vi.fn()
    let promise = retryWithBackoff(fn, 3, 10, onRetry)
    let [result] = await Promise.allSettled([promise, vi.advanceTimersByTimeAsync(100)])
    expect(result.status).toBe("fulfilled")
    expect((result as PromiseFulfilledResult<string>).value).toBe("eventual success")
    expect(fn).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it("should throw after max retries", async () => {
    let fn = vi.fn(async () => {
      throw new Error("persistent failure")
    })
    let promise = retryWithBackoff(fn, 2, 10)
    let [result] = await Promise.allSettled([promise, vi.advanceTimersByTimeAsync(100)])
    expect(result.status).toBe("rejected")
    expect((result as PromiseRejectedResult).reason.message).toBe("persistent failure")
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it("should not retry on 401 auth errors", async () => {
    let fn = vi.fn(async () => {
      throw new Error("401 Unauthorized")
    })
    await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow("401 Unauthorized")
    expect(fn).toHaveBeenCalledTimes(1) // no retries
  })

  it("should not retry on 403 auth errors", async () => {
    let fn = vi.fn(async () => {
      throw new Error("403 Forbidden")
    })
    await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow("403 Forbidden")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("should not retry on invalid api key errors", async () => {
    let fn = vi.fn(async () => {
      throw new Error("invalid api key")
    })
    await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow("invalid api key")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("should use exponential backoff delays", async () => {
    let callCount = 0
    let fn = vi.fn(async () => {
      callCount++
      throw new Error("retry me")
    })
    let onRetry = vi.fn()
    let promise = retryWithBackoff(fn, 3, 10, onRetry)
    let [result] = await Promise.allSettled([promise, vi.advanceTimersByTimeAsync(100)])
    expect(result.status).toBe("rejected")
    expect((result as PromiseRejectedResult).reason.message).toBe("retry me")
    expect(onRetry).toHaveBeenCalledTimes(3)
  })

  it("should call onRetry with attempt number and error message", async () => {
    let callCount = 0
    let fn = vi.fn(async () => {
      callCount++
      throw new Error(`error ${callCount}`)
    })
    let onRetry = vi.fn()
    let promise = retryWithBackoff(fn, 3, 10, onRetry)
    let [result] = await Promise.allSettled([promise, vi.advanceTimersByTimeAsync(100)])
    expect(result.status).toBe("rejected")
    expect(onRetry).toHaveBeenCalledWith(1, "error 1")
    expect(onRetry).toHaveBeenCalledWith(2, "error 2")
    expect(onRetry).toHaveBeenCalledWith(3, "error 3")
  })
})

describe("createProvider", () => {
  it("should create ProviderManager for ollama type", () => {
    let provider = createProvider("ollama")
    expect(provider).toBeInstanceOf(ProviderManager)
    expect(provider.name).toBe("provider-manager")
    expect(provider.getCurrentProvider().name).toBe("ollama")
  })

  it("should create ProviderManager for openai type", () => {
    let provider = createProvider("openai", { apiKey: "sk-test" })
    expect(provider).toBeInstanceOf(ProviderManager)
    expect(provider.getCurrentProvider().name).toBe("openai")
    expect(provider.getCurrentProvider()).toBeInstanceOf(OpenAIProvider)
  })

  it("should create ProviderManager for anthropic type", () => {
    let provider = createProvider("anthropic", { apiKey: "sk-test" })
    expect(provider).toBeInstanceOf(ProviderManager)
    expect(provider.getCurrentProvider().name).toBe("anthropic")
    expect(provider.getCurrentProvider()).toBeInstanceOf(AnthropicProvider)
  })

  it("should create ProviderManager for gemini type", () => {
    let provider = createProvider("gemini", { apiKey: "sk-test" })
    expect(provider).toBeInstanceOf(ProviderManager)
    expect(provider.getCurrentProvider().name).toBe("gemini")
    expect(provider.getCurrentProvider()).toBeInstanceOf(GeminiProvider)
  })

  it("should default to OllamaProvider for unknown type", () => {
    let provider = createProvider("unknown")
    expect(provider).toBeInstanceOf(ProviderManager)
    expect(provider.getCurrentProvider().name).toBe("ollama")
  })
})

describe("OllamaProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it("should have name 'ollama'", () => {
    let provider = new OllamaProvider()
    expect(provider.name).toBe("ollama")
  })

  it("should call window.electronAPI.generateWithOllamaStream", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: true,
      response: "test response",
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOllamaStream: mockGenerate },
    })
    let provider = new OllamaProvider()
    let result = await provider.generate("test prompt", "llama2")
    expect(result.text).toBe("test response")
    expect(result.provider).toBe("ollama")
    expect(result.tokens).toBeGreaterThan(0)
    expect(mockGenerate).toHaveBeenCalledWith("llama2", "test prompt", {
      temperature: 0.7,
      top_p: 0.9,
      repeat_penalty: 1.15,
      num_predict: 4096,
    }, undefined, undefined)
  })

  it("should throw on failure", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: false,
      error: "model not found",
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOllamaStream: mockGenerate },
    })
    let provider = new OllamaProvider()
    await expect(provider.generate("prompt", "nonexistent")).rejects.toThrow("model not found")
  })
})

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it("should have name 'openai'", () => {
    let provider = new OpenAIProvider("sk-test")
    expect(provider.name).toBe("openai")
  })

  it("should use custom baseUrl", () => {
    let provider = new OpenAIProvider("sk-test", "https://custom.api.com")
    expect(provider.baseUrl).toBe("https://custom.api.com")
  })

  it("should default to openai baseUrl", () => {
    let provider = new OpenAIProvider("sk-test")
    expect(provider.baseUrl).toBe("https://api.openai.com")
  })

  it("should call window.electronAPI.generateWithOpenAI", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: true,
      response: "openai response",
      usage: { total_tokens: 50 },
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOpenAI: mockGenerate },
    })
    let provider = new OpenAIProvider("sk-test")
    let result = await provider.generate("test prompt", "gpt-4")
    expect(result.text).toBe("openai response")
    expect(result.tokens).toBe(50)
    expect(result.provider).toBe("openai")
    expect(mockGenerate).toHaveBeenCalledWith(
      "sk-test",
      "https://api.openai.com",
      "gpt-4",
      "test prompt",
      { temperature: 0.7, top_p: 0.9, max_tokens: 4096 }
    )
  })

  it("should estimate tokens when usage is missing", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: true,
      response: "short response",
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOpenAI: mockGenerate },
    })
    let provider = new OpenAIProvider("sk-test")
    let result = await provider.generate("prompt", "gpt-4")
    expect(result.tokens).toBeGreaterThan(0)
  })

  it("should throw on failure", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: false,
      error: "invalid api key",
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOpenAI: mockGenerate },
    })
    let provider = new OpenAIProvider("bad-key")
    await expect(provider.generate("prompt", "gpt-4")).rejects.toThrow("invalid api key")
  })
})

describe("getStrictGenerationOptions", () => {
  it("returns strict preset for instruction processing type", () => {
    expect(getStrictGenerationOptions("instruction")).toEqual({
      temperature: 0.3,
      top_p: 0.85,
      repeat_penalty: 1.2,
    })
  })
  it("returns strict preset for conversation processing type", () => {
    expect(getStrictGenerationOptions("conversation")).toEqual({
      temperature: 0.3,
      top_p: 0.85,
      repeat_penalty: 1.2,
    })
  })
  it("returns strict preset for chunking processing type", () => {
    expect(getStrictGenerationOptions("chunking")).toEqual({
      temperature: 0.4,
      top_p: 0.85,
      repeat_penalty: 1.15,
    })
  })
  it("returns strict preset for custom processing type", () => {
    expect(getStrictGenerationOptions("custom")).toEqual({
      temperature: 0.4,
      top_p: 0.85,
      repeat_penalty: 1.15,
    })
  })
})

describe("OllamaProvider with processingType", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it("includes repeat_penalty in payload when processingType is set", async () => {
    let mockGenerate = vi.fn(async () => ({
      success: true,
      response: "strict response",
    }))
    vi.stubGlobal("window", {
      electronAPI: { generateWithOllamaStream: mockGenerate },
    })
    let provider = new OllamaProvider()
    await provider.generate("prompt", "llama2", { processingType: "instruction" })
    expect(mockGenerate).toHaveBeenCalledTimes(1)
    expect(mockGenerate).toHaveBeenCalledWith(
      "llama2",
      "prompt",
      expect.objectContaining({
        repeat_penalty: 1.2,
        temperature: 0.3,
        top_p: 0.85,
        num_predict: 4096,
      }),
      undefined,
      undefined
    )
  })
})