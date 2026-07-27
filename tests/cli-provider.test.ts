// @vitest-environment node
import{describe,it,expect,vi,beforeEach,afterEach}from "vitest"
import axios from "axios"
import{CliOllamaProvider,CliOpenAIProvider,CliAnthropicProvider,CliGeminiProvider,createCliProvider}from "../src/cli/provider.ts"
import{RateLimiter}from "../src/renderer/rateLimiter.ts"

vi.mock("axios")

// Clear mock state between every test so call history and resolved/rejected
// values do not leak across test cases.
beforeEach(()=>{
    vi.mocked(axios.post).mockReset()
})

describe("createCliProvider",()=>{
    it("returns CliOllamaProvider by default",()=>{
        let p=createCliProvider("ollama")
        expect(p).toBeInstanceOf(CliOllamaProvider)
        expect(p.name).toBe("ollama")
    })
    it("returns CliOpenAIProvider for openai",()=>{
        let p=createCliProvider("openai",{apiKey:"k"})
        expect(p).toBeInstanceOf(CliOpenAIProvider)
        expect(p.name).toBe("openai")
    })
    it("returns CliAnthropicProvider for anthropic",()=>{
        let p=createCliProvider("anthropic",{apiKey:"k"})
        expect(p).toBeInstanceOf(CliAnthropicProvider)
        expect(p.name).toBe("anthropic")
    })
    it("returns CliGeminiProvider for gemini",()=>{
        let p=createCliProvider("gemini",{apiKey:"k"})
        expect(p).toBeInstanceOf(CliGeminiProvider)
        expect(p.name).toBe("gemini")
    })
    it("falls back to ollama for unknown type",()=>{
        let p=createCliProvider("unknown")
        expect(p).toBeInstanceOf(CliOllamaProvider)
    })
    it("uses default baseUrl when not provided",()=>{
        let p=createCliProvider("openai",{apiKey:"k"}) as CliOpenAIProvider
        expect(p.baseUrl).toBe("https://api.openai.com")
    })
    it("uses provided baseUrl",()=>{
        let p=createCliProvider("openai",{apiKey:"k",baseUrl:"https://custom.api.com"}) as CliOpenAIProvider
        expect(p.baseUrl).toBe("https://custom.api.com")
    })
    it("uses empty apiKey when not provided",()=>{
        let p=createCliProvider("openai") as CliOpenAIProvider
        expect(p.apiKey).toBe("")
    })
})

describe("CliOllamaProvider",()=>{
    it("constructs with default baseUrl",()=>{
        let p=new CliOllamaProvider()
        expect(p.name).toBe("ollama")
        expect(p.rateLimiter).toBeInstanceOf(RateLimiter)
    })
    it("constructs with custom baseUrl",()=>{
        let p=new CliOllamaProvider("http://myhost:1234")
        // No public getter for baseUrl; verify by successful generation call shape
        expect(p.name).toBe("ollama")
    })
    it("generate returns text and tokens",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{response:"hello",eval_count:5}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("prompt","llama3")
        expect(result.text).toBe("hello")
        expect(result.tokens).toBe(5)
        expect(result.provider).toBe("ollama")
    })
    it("generate uses token count fallback when eval_count missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{response:"hello world"}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("prompt","llama3")
        expect(result.tokens).toBe(Math.ceil("hello world".length/4))
    })
    it("generate uses empty string when response missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("prompt","llama3")
        expect(result.text).toBe("")
    })
    it("generate passes options through",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        await p.generate("p","m",{temperature:0.1,top_p:0.5,max_tokens:100})
        let call=vi.mocked(axios.post).mock.calls[0]
        let body=call[1] as any
        expect(body.options.temperature).toBe(0.1)
        expect(body.options.top_p).toBe(0.5)
        expect(body.options.num_predict).toBe(100)
    })
    it("generate uses default options when none provided",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        await p.generate("p","m")
        let call=vi.mocked(axios.post).mock.calls[0]
        let body=call[1] as any
        expect(body.options.temperature).toBe(0.7)
        expect(body.options.top_p).toBe(0.9)
        expect(body.options.num_predict).toBe(16384)
    })
    it("generate throws wrapped error on failure",async()=>{
        vi.mocked(axios.post).mockRejectedValue(new Error("network"))
        let p=new CliOllamaProvider()
        await expect(p.generate("p","m")).rejects.toThrow("Ollama generation failed: network")
    })
    it("generate throws wrapped error using response.data.error if available",async()=>{
        let err:any=new Error("base")
        err.response={data:{error:"internal ollama error"}}
        vi.mocked(axios.post).mockRejectedValue(err)
        let p=new CliOllamaProvider()
        await expect(p.generate("p","m")).rejects.toThrow("Ollama generation failed: internal ollama error")
    })
})

describe("CliOllamaProvider retry behavior",()=>{
    beforeEach(()=>{vi.mocked(axios.post).mockClear()})
    it("retries on 429 rate-limit errors",async()=>{
        let err429:any=new Error("429 rate limit exceeded")
        vi.mocked(axios.post).mockRejectedValueOnce(err429).mockResolvedValueOnce({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("p","m")
        expect(result.text).toBe("ok")
        expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(2)
    })
    it("does NOT retry on 401 unauthorized",async()=>{
        let err401:any=new Error("401 invalid api key")
        vi.mocked(axios.post).mockRejectedValue(err401)
        let p=new CliOllamaProvider()
        await expect(p.generate("p","m")).rejects.toThrow()
        expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1)
    })
    it("does NOT retry on 403 forbidden",async()=>{
        let err403:any=new Error("403 forbidden")
        vi.mocked(axios.post).mockRejectedValue(err403)
        let p=new CliOllamaProvider()
        await expect(p.generate("p","m")).rejects.toThrow()
        expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1)
    })
    it("retries on generic network errors up to maxRetries",async()=>{
        vi.mocked(axios.post).mockRejectedValue(new Error("ETIMEDOUT"))
        let p=new CliOllamaProvider()
        await expect(p.generate("p","m")).rejects.toThrow()
        // 1 initial + 3 retries = 4 attempts
        expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(4)
    })
})

describe("CliOpenAIProvider",()=>{
    it("constructs with apiKey and default baseUrl",()=>{
        let p=new CliOpenAIProvider("sk-test")
        expect(p.name).toBe("openai")
        expect(p.apiKey).toBe("sk-test")
        expect(p.baseUrl).toBe("https://api.openai.com")
    })
    it("constructs with custom baseUrl",()=>{
        let p=new CliOpenAIProvider("sk-test","https://custom.api.com")
        expect(p.baseUrl).toBe("https://custom.api.com")
    })
    it("generate returns text and tokens",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{choices:[{message:{content:"hello"}}],usage:{total_tokens:10}}} as any)
        let p=new CliOpenAIProvider("sk-test")
        let result=await p.generate("prompt","gpt-4")
        expect(result.text).toBe("hello")
        expect(result.tokens).toBe(10)
        expect(result.provider).toBe("openai")
    })
    it("generate uses token fallback when usage missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{choices:[{message:{content:"hello world"}}]}} as any)
        let p=new CliOpenAIProvider("sk-test")
        let result=await p.generate("prompt","gpt-4")
        expect(result.tokens).toBe(Math.ceil("hello world".length/4))
    })
    it("generate uses empty string when choices missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{}} as any)
        let p=new CliOpenAIProvider("sk-test")
        let result=await p.generate("prompt","gpt-4")
        expect(result.text).toBe("")
    })
    it("generate sends Authorization header",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{choices:[{message:{content:"ok"}}]}} as any)
        let p=new CliOpenAIProvider("sk-test")
        await p.generate("p","m")
        let call=vi.mocked(axios.post).mock.calls[0]
        let cfg=call[2] as any
        expect(cfg.headers.Authorization).toBe("Bearer sk-test")
        expect(cfg.headers["Content-Type"]).toBe("application/json")
    })
    it("generate passes options through",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{choices:[{message:{content:"ok"}}]}} as any)
        let p=new CliOpenAIProvider("sk-test")
        await p.generate("p","m",{temperature:0.2,top_p:0.8,max_tokens:500})
        let call=vi.mocked(axios.post).mock.calls[0]
        let body=call[1] as any
        expect(body.temperature).toBe(0.2)
        expect(body.top_p).toBe(0.8)
        expect(body.max_tokens).toBe(500)
    })
    it("generate throws wrapped error on failure",async()=>{
        vi.mocked(axios.post).mockRejectedValue(new Error("network"))
        let p=new CliOpenAIProvider("sk-test")
        await expect(p.generate("p","m")).rejects.toThrow("OpenAI generation failed: network")
    })
    it("generate throws wrapped error using response.data.error.message if available",async()=>{
        let err:any=new Error("base")
        err.response={data:{error:{message:"openai internal error"}}}
        vi.mocked(axios.post).mockRejectedValue(err)
        let p=new CliOpenAIProvider("sk-test")
        await expect(p.generate("p","m")).rejects.toThrow("OpenAI generation failed: openai internal error")
    })
})

describe("CliAnthropicProvider",()=>{
    it("constructs with apiKey and default baseUrl",()=>{
        let p=new CliAnthropicProvider("ak-test")
        expect(p.name).toBe("anthropic")
        expect(p.apiKey).toBe("ak-test")
        expect(p.baseUrl).toBe("https://api.anthropic.com")
    })
    it("constructs with custom baseUrl",()=>{
        let p=new CliAnthropicProvider("ak-test","https://custom.anthropic.com")
        expect(p.baseUrl).toBe("https://custom.anthropic.com")
    })
    it("generate returns text and tokens",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{content:[{text:"hello"}],usage:{output_tokens:7}}} as any)
        let p=new CliAnthropicProvider("ak-test")
        let result=await p.generate("prompt","claude-3")
        expect(result.text).toBe("hello")
        expect(result.tokens).toBe(7)
        expect(result.provider).toBe("anthropic")
    })
    it("generate uses token fallback when usage missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{content:[{text:"hello world"}]}} as any)
        let p=new CliAnthropicProvider("ak-test")
        let result=await p.generate("prompt","claude-3")
        expect(result.tokens).toBe(Math.ceil("hello world".length/4))
    })
    it("generate uses empty string when content missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{}} as any)
        let p=new CliAnthropicProvider("ak-test")
        let result=await p.generate("prompt","claude-3")
        expect(result.text).toBe("")
    })
    it("generate sends x-api-key header",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{content:[{text:"ok"}]}} as any)
        let p=new CliAnthropicProvider("ak-test")
        await p.generate("p","m")
        let call=vi.mocked(axios.post).mock.calls[0]
        let cfg=call[2] as any
        expect(cfg.headers["x-api-key"]).toBe("ak-test")
        expect(cfg.headers["anthropic-version"]).toBe("2023-06-01")
        expect(cfg.headers["Content-Type"]).toBe("application/json")
    })
    it("generate passes options through",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{content:[{text:"ok"}]}} as any)
        let p=new CliAnthropicProvider("ak-test")
        await p.generate("p","m",{max_tokens:2000,temperature:0.3,top_p:0.6})
        let call=vi.mocked(axios.post).mock.calls[0]
        let body=call[1] as any
        expect(body.max_tokens).toBe(2000)
        // Anthropic doesn't use temperature/top_p in this implementation
    })
    it("generate uses default max_tokens when not provided",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{content:[{text:"ok"}]}} as any)
        let p=new CliAnthropicProvider("ak-test")
        await p.generate("p","m")
        let call=vi.mocked(axios.post).mock.calls[0]
        let body=call[1] as any
        expect(body.max_tokens).toBe(4096)
    })
    it("generate throws wrapped error on failure",async()=>{
        vi.mocked(axios.post).mockRejectedValue(new Error("network"))
        let p=new CliAnthropicProvider("ak-test")
        await expect(p.generate("p","m")).rejects.toThrow("Anthropic generation failed: network")
    })
    it("generate throws wrapped error using response.data.error.message if available",async()=>{
        let err:any=new Error("base")
        err.response={data:{error:{message:"anthropic internal error"}}}
        vi.mocked(axios.post).mockRejectedValue(err)
        let p=new CliAnthropicProvider("ak-test")
        await expect(p.generate("p","m")).rejects.toThrow("Anthropic generation failed: anthropic internal error")
    })
})

describe("CliGeminiProvider",()=>{
    it("constructs with apiKey and default baseUrl",()=>{
        let p=new CliGeminiProvider("g-test")
        expect(p.name).toBe("gemini")
        expect(p.apiKey).toBe("g-test")
        expect(p.baseUrl).toBe("https://generativelanguage.googleapis.com")
    })
    it("constructs with custom baseUrl",()=>{
        let p=new CliGeminiProvider("g-test","https://custom.gemini.com")
        expect(p.baseUrl).toBe("https://custom.gemini.com")
    })
    it("generate returns text and tokens",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{candidates:[{content:{parts:[{text:"hello"}]}}],usageMetadata:{candidatesTokenCount:9}}} as any)
        let p=new CliGeminiProvider("g-test")
        let result=await p.generate("prompt","gemini-pro")
        expect(result.text).toBe("hello")
        expect(result.tokens).toBe(9)
        expect(result.provider).toBe("gemini")
    })
    it("generate uses token fallback when usageMetadata missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{candidates:[{content:{parts:[{text:"hello world"}]}}]}} as any)
        let p=new CliGeminiProvider("g-test")
        let result=await p.generate("prompt","gemini-pro")
        expect(result.tokens).toBe(Math.ceil("hello world".length/4))
    })
    it("generate uses empty string when candidates missing",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{}} as any)
        let p=new CliGeminiProvider("g-test")
        let result=await p.generate("prompt","gemini-pro")
        expect(result.text).toBe("")
    })
    it("generate sends api key in URL query string",async()=>{
        vi.mocked(axios.post).mockResolvedValue({data:{candidates:[{content:{parts:[{text:"ok"}]}}]}} as any)
        let p=new CliGeminiProvider("g-test")
        await p.generate("p","gemini-pro")
        let call=vi.mocked(axios.post).mock.calls[0]
        let url=call[0] as string
        expect(url).toContain("key=g-test")
    })
    it("generate throws wrapped error on failure",async()=>{
        vi.mocked(axios.post).mockRejectedValue(new Error("network"))
        let p=new CliGeminiProvider("g-test")
        await expect(p.generate("p","m")).rejects.toThrow("Gemini generation failed: network")
    })
    it("generate throws wrapped error using response.data.error.message if available",async()=>{
        let err:any=new Error("base")
        err.response={data:{error:{message:"gemini internal error"}}}
        vi.mocked(axios.post).mockRejectedValue(err)
        let p=new CliGeminiProvider("g-test")
        await expect(p.generate("p","m")).rejects.toThrow("Gemini generation failed: gemini internal error")
    })
})

describe("parseRetryAfter (indirect via rate-limit error)",()=>{
    beforeEach(()=>{vi.mocked(axios.post).mockClear()})
    it("parses retry-after seconds from error message",async()=>{
        let err:any=new Error("429 rate limit exceeded. retry-after: 60")
        vi.mocked(axios.post).mockRejectedValueOnce(err).mockResolvedValueOnce({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("p","m")
        expect(result.text).toBe("ok")
    })
    it("handles error message without retry-after header",async()=>{
        let err:any=new Error("429 rate limit exceeded")
        vi.mocked(axios.post).mockRejectedValueOnce(err).mockResolvedValueOnce({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("p","m")
        expect(result.text).toBe("ok")
    })
    it("retries on lowercase 'rate limit' in message",async()=>{
        let err:any=new Error("rate limit exceeded")
        vi.mocked(axios.post).mockRejectedValueOnce(err).mockResolvedValueOnce({data:{response:"ok",eval_count:1}} as any)
        let p=new CliOllamaProvider()
        let result=await p.generate("p","m")
        expect(result.text).toBe("ok")
    })
})
