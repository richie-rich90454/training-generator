import type { Provider, ProviderOptions, ProviderResult } from "../renderer/provider.ts"
import { RateLimiter } from "../renderer/rateLimiter.ts"
import axios from "axios"

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    onRetry?: (attempt: number, error: string) => void,
    rateLimiter?: RateLimiter
): Promise<T> {
    let lastError: Error
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        }
        catch (error) {
            lastError = error as Error
            let msg = lastError.message || ""
            if (msg.includes("401") || msg.includes("403") || msg.includes("invalid api key")) {
                throw lastError
            }
            if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
                if (rateLimiter) {
                    let retryAfter = parseRetryAfter(msg)
                    rateLimiter.handleRateLimitResponse(retryAfter)
                }
                if (attempt < maxRetries) {
                    let delay = baseDelay * Math.pow(2, attempt)
                    if (onRetry) onRetry(attempt + 1, msg)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
            else if (attempt < maxRetries) {
                let delay = baseDelay * Math.pow(2, attempt)
                if (onRetry) onRetry(attempt + 1, msg)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    throw lastError!
}

function parseRetryAfter(msg: string): number | undefined {
    let match = msg.match(/retry[_-]?after[:\s]*(\d+)/i)
    if (match) return parseInt(match[1], 10)
    return undefined
}

export class CliOllamaProvider implements Provider {
    name = "ollama"
    rateLimiter?: RateLimiter = undefined
    private baseUrl: string

    constructor(baseUrl: string = "http://localhost:11434") {
        this.baseUrl = baseUrl
    }

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<ProviderResult> {
        try {
            let result = await retryWithBackoff(async () => {
                let response = await axios.post(`${this.baseUrl}/api/generate`, {
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        top_p: options?.top_p ?? 0.9,
                        num_predict: options?.max_tokens ?? 16384
                    }
                }, {
                    timeout: 300000
                })
                return response.data
            }, 3, 1000)
            let text = result.response || ""
            return { text, tokens: Math.ceil(text.length / 4), provider: "ollama" }
        }
        catch (error) {
            let msg = (error as any)?.response?.data?.error || (error as Error).message
            throw new Error(`Ollama generation failed: ${msg}`)
        }
    }
}

export class CliOpenAIProvider implements Provider {
    name = "openai"
    apiKey: string
    baseUrl: string
    rateLimiter: RateLimiter

    constructor(apiKey: string, baseUrl: string = "https://api.openai.com") {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.rateLimiter = new RateLimiter(60, 10)
        this.rateLimiter.enable()
    }

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<ProviderResult> {
        try {
            await this.rateLimiter.acquire()
            let result = await retryWithBackoff(async () => {
                let response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
                    model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: options?.temperature ?? 0.7,
                    top_p: options?.top_p ?? 0.9,
                    max_tokens: options?.max_tokens ?? 4096
                }, {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 120000
                })
                return response.data
            }, 3, 1000, undefined, this.rateLimiter)
            let text = result.choices?.[0]?.message?.content || ""
            let tokens = result.usage?.total_tokens ?? Math.ceil(text.length / 4)
            return { text, tokens, provider: "openai" }
        }
        catch (error) {
            let msg = (error as any)?.response?.data?.error?.message || (error as Error).message
            throw new Error(`OpenAI generation failed: ${msg}`)
        }
    }
}

export class CliAnthropicProvider implements Provider {
    name = "anthropic"
    apiKey: string
    baseUrl: string
    rateLimiter: RateLimiter

    constructor(apiKey: string, baseUrl: string = "https://api.anthropic.com") {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.rateLimiter = new RateLimiter(60, 10)
        this.rateLimiter.enable()
    }

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<ProviderResult> {
        try {
            await this.rateLimiter.acquire()
            let result = await retryWithBackoff(async () => {
                let response = await axios.post(`${this.baseUrl}/v1/messages`, {
                    model,
                    max_tokens: options?.max_tokens ?? 4096,
                    messages: [{ role: "user", content: prompt }]
                }, {
                    headers: {
                        "x-api-key": this.apiKey,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    timeout: 120000
                })
                return response.data
            }, 3, 1000, undefined, this.rateLimiter)
            let text = result.content?.[0]?.text || ""
            let tokens = result.usage?.output_tokens ?? Math.ceil(text.length / 4)
            return { text, tokens, provider: "anthropic" }
        }
        catch (error) {
            let msg = (error as any)?.response?.data?.error?.message || (error as Error).message
            throw new Error(`Anthropic generation failed: ${msg}`)
        }
    }
}

export function createCliProvider(type: string, config?: { apiKey?: string; baseUrl?: string }): Provider {
    if (type === "openai" || type === "anthropic" || type === "gemini") {
        let baseUrl = config?.baseUrl ||
            (type === "anthropic" ? "https://api.anthropic.com" :
                type === "gemini" ? "https://generativelanguage.googleapis.com" :
                    "https://api.openai.com")
        return new CliOpenAIProvider(config?.apiKey || "", baseUrl)
    }
    return new CliOllamaProvider()
}
