// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { retryWithBackoff, createProvider, OllamaProvider, OpenAIProvider } from "../src/renderer/provider.js"
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
    let result = await retryWithBackoff(fn, 3, 10, onRetry)
    expect(result).toBe("eventual success")
    expect(fn).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it("should throw after max retries", async () => {
    let fn = vi.fn(async () => {
      throw new Error("persistent failure")
    })
    await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow("persistent failure")
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
    let start = Date.now()
    try {
      await retryWithBackoff(fn, 3, 50, onRetry)
    } catch {}
    let elapsed = Date.now() - start
    // 50 + 100 + 200 = 350ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(300)
    expect(onRetry).toHaveBeenCalledTimes(3)
  })

  it("should call onRetry with attempt number and error message", async () => {
    let callCount = 0
    let fn = vi.fn(async () => {
      callCount++
      throw new Error(`error ${callCount}`)
    })
    let onRetry = vi.fn()
    try {
      await retryWithBackoff(fn, 3, 10, onRetry)
    } catch {}
    expect(onRetry).toHaveBeenCalledWith(1, "error 1")
    expect(onRetry).toHaveBeenCalledWith(2, "error 2")
    expect(onRetry).toHaveBeenCalledWith(3, "error 3")
  })
})

describe("createProvider", () => {
  it("should create OllamaProvider for ollama type", () => {
    let provider = createProvider("ollama")
    expect(provider.name).toBe("ollama")
    expect(provider).toBeInstanceOf(OllamaProvider)
  })

  it("should create OpenAIProvider for openai type", () => {
    let provider = createProvider("openai", { apiKey: "sk-test" })
    expect(provider.name).toBe("openai")
    expect(provider).toBeInstanceOf(OpenAIProvider)
  })

  it("should create OpenAIProvider for anthropic type", () => {
    let provider = createProvider("anthropic", { apiKey: "sk-test" })
    expect(provider.name).toBe("openai")
    expect(provider).toBeInstanceOf(OpenAIProvider)
  })

  it("should create OpenAIProvider for gemini type", () => {
    let provider = createProvider("gemini", { apiKey: "sk-test" })
    expect(provider.name).toBe("openai")
    expect(provider).toBeInstanceOf(OpenAIProvider)
  })

  it("should default to OllamaProvider for unknown type", () => {
    let provider = createProvider("unknown")
    expect(provider.name).toBe("ollama")
  })
})

describe("OllamaProvider", () => {
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
    })
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