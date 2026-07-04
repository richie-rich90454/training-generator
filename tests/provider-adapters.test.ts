// @vitest-environment node
import{describe,it,expect,vi,beforeEach,afterEach}from"vitest"
import{OpenAICompatibleProvider,MistralProvider,GroqProvider,TogetherProvider,PerplexityProvider,DeepSeekProvider,LocalAIProvider,LMStudioProvider,VllmProvider,AzureOpenAIProvider,CohereProvider,HuggingFaceProvider,ReplicateProvider}from"../src/renderer/provider.js"
beforeEach(()=>{
    vi.stubGlobal("window",{
        electronAPI:{
            generateWithOpenAI:vi.fn()
        }
    })
    vi.stubGlobal("fetch",vi.fn())
})
afterEach(()=>{
    vi.restoreAllMocks()
    vi.useRealTimers()
})
describe("OpenAICompatibleProvider",()=>{
    it("constructor sets name, apiKey, baseUrl",()=>{
        let p=new OpenAICompatibleProvider("test","key123","https://example.com")
        expect(p.name).toBe("test")
        expect(p.apiKey).toBe("key123")
        expect(p.baseUrl).toBe("https://example.com")
        expect(p.rateLimiter).toBeDefined()
    })
    it("healthCheck returns true when fetch ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200})))
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns false when fetch not ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:401})))
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        expect(await p.healthCheck()).toBe(false)
    })
    it("healthCheck returns false on network error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("network error")}))
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        expect(await p.healthCheck()).toBe(false)
    })
    it("generate returns ProviderResult with text, tokens, provider",async()=>{
        let mockGen=vi.fn(async()=>({success:true,response:"hello world",usage:{total_tokens:5}}))
        vi.stubGlobal("window",{electronAPI:{generateWithOpenAI:mockGen}})
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        let result=await p.generate("prompt","model")
        expect(result.text).toBe("hello world")
        expect(result.tokens).toBe(5)
        expect(result.provider).toBe("test")
    })
    it("generate estimates tokens when usage missing",async()=>{
        let mockGen=vi.fn(async()=>({success:true,response:"hello world"}))
        vi.stubGlobal("window",{electronAPI:{generateWithOpenAI:mockGen}})
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        let result=await p.generate("prompt","model")
        expect(result.tokens).toBe(Math.ceil("hello world".length/4))
    })
    it("generate throws on API failure",async()=>{
        let mockGen=vi.fn(async()=>({success:false,error:"invalid api key"}))
        vi.stubGlobal("window",{electronAPI:{generateWithOpenAI:mockGen}})
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        await expect(p.generate("prompt","model")).rejects.toThrow("invalid api key")
    })
    it("generate passes options through",async()=>{
        let mockGen=vi.fn(async()=>({success:true,response:"ok",usage:{total_tokens:1}}))
        vi.stubGlobal("window",{electronAPI:{generateWithOpenAI:mockGen}})
        let p=new OpenAICompatibleProvider("test","key","https://example.com")
        await p.generate("prompt","model",{temperature:0.5,top_p:0.8,max_tokens:100})
        expect(mockGen).toHaveBeenCalledWith("key","https://example.com","model","prompt",{temperature:0.5,top_p:0.8,max_tokens:100})
    })
})
describe("OpenAI-compatible subclasses",()=>{
    it("MistralProvider sets name and baseUrl",()=>{
        let p=new MistralProvider("key")
        expect(p.name).toBe("mistral")
        expect(p.baseUrl).toBe("https://api.mistral.ai")
        expect(p.apiKey).toBe("key")
    })
    it("TogetherProvider sets name and baseUrl",()=>{
        let p=new TogetherProvider("key")
        expect(p.name).toBe("together")
        expect(p.baseUrl).toBe("https://api.together.xyz")
    })
    it("GroqProvider sets name and baseUrl",()=>{
        let p=new GroqProvider("key")
        expect(p.name).toBe("groq")
        expect(p.baseUrl).toBe("https://api.groq.com/openai")
    })
    it("PerplexityProvider sets name and baseUrl",()=>{
        let p=new PerplexityProvider("key")
        expect(p.name).toBe("perplexity")
        expect(p.baseUrl).toBe("https://api.perplexity.ai")
    })
    it("DeepSeekProvider sets name and baseUrl",()=>{
        let p=new DeepSeekProvider("key")
        expect(p.name).toBe("deepseek")
        expect(p.baseUrl).toBe("https://api.deepseek.com")
    })
    it("LocalAIProvider sets name and default baseUrl",()=>{
        let p=new LocalAIProvider()
        expect(p.name).toBe("localai")
        expect(p.baseUrl).toBe("http://localhost:8080")
    })
    it("LMStudioProvider sets name and default baseUrl with empty apiKey",()=>{
        let p=new LMStudioProvider()
        expect(p.name).toBe("lmstudio")
        expect(p.baseUrl).toBe("http://localhost:1234")
        expect(p.apiKey).toBe("")
    })
    it("VllmProvider sets name and default baseUrl",()=>{
        let p=new VllmProvider()
        expect(p.name).toBe("vllm")
        expect(p.baseUrl).toBe("http://localhost:8000")
    })
    it("GroqProvider generate uses electronAPI",async()=>{
        let mockGen=vi.fn(async()=>({success:true,response:"groq response",usage:{total_tokens:3}}))
        vi.stubGlobal("window",{electronAPI:{generateWithOpenAI:mockGen}})
        let p=new GroqProvider("gsk-key")
        let result=await p.generate("prompt","llama-3")
        expect(result.text).toBe("groq response")
        expect(result.provider).toBe("groq")
        expect(mockGen).toHaveBeenCalledWith("gsk-key","https://api.groq.com/openai","llama-3","prompt",expect.objectContaining({temperature:0.7}))
    })
})
describe("AzureOpenAIProvider",()=>{
    it("constructor sets name, deployment, apiVersion",()=>{
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy")
        expect(p.name).toBe("azure-openai")
        expect(p.baseUrl).toBe("https://myresource.openai.azure.com")
        expect(p.deployment).toBe("my-deploy")
        expect(p.apiVersion).toBe("2024-02-15-preview")
    })
    it("constructor accepts custom apiVersion",()=>{
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy","2024-06-01")
        expect(p.apiVersion).toBe("2024-06-01")
    })
    it("healthCheck returns true when ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200})))
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns true on 400 (bad request still authed)",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:400})))
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns false on network error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("network")}))
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy")
        expect(await p.healthCheck()).toBe(false)
    })
    it("generate returns ProviderResult",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({
            ok:true,
            status:200,
            json:async()=>({choices:[{message:{content:"azure response"}}],usage:{total_tokens:7}})
        })))
        let p=new AzureOpenAIProvider("key","https://myresource.openai.azure.com","my-deploy")
        let result=await p.generate("prompt","ignored-model")
        expect(result.text).toBe("azure response")
        expect(result.tokens).toBe(7)
        expect(result.provider).toBe("azure-openai")
    })
    it("generate uses api-key header not Bearer",async()=>{
        let mockFetch=vi.fn(async(_url:any,_init:any)=>({ok:true,status:200,json:async()=>({choices:[{message:{content:"ok"}}]})}))
        vi.stubGlobal("fetch",mockFetch)
        let p=new AzureOpenAIProvider("azkey","https://myresource.openai.azure.com","my-deploy")
        await p.generate("prompt","model")
        let callArgs=mockFetch.mock.calls[0]
        let init=callArgs[1]as any
        expect(init.headers["api-key"]).toBe("azkey")
        expect(init.headers["Authorization"]).toBeUndefined()
    })
    it("generate throws on API error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:401,text:async()=>"unauthorized"})))
        let p=new AzureOpenAIProvider("badkey","https://myresource.openai.azure.com","my-deploy")
        await expect(p.generate("prompt","model")).rejects.toThrow("Azure OpenAI error 401")
    })
})
describe("CohereProvider",()=>{
    it("constructor sets name and default baseUrl",()=>{
        let p=new CohereProvider("key")
        expect(p.name).toBe("cohere")
        expect(p.baseUrl).toBe("https://api.cohere.ai")
    })
    it("healthCheck returns true when ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200})))
        let p=new CohereProvider("key")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns false on error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("network")}))
        let p=new CohereProvider("key")
        expect(await p.healthCheck()).toBe(false)
    })
    it("generate returns ProviderResult from text field",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,json:async()=>({text:"cohere response"})})))
        let p=new CohereProvider("key")
        let result=await p.generate("prompt","command-r")
        expect(result.text).toBe("cohere response")
        expect(result.provider).toBe("cohere")
        expect(result.tokens).toBeGreaterThan(0)
    })
    it("generate throws on API error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:400,text:async()=>"bad request"})))
        let p=new CohereProvider("key")
        await expect(p.generate("prompt","model")).rejects.toThrow("Cohere error 400")
    })
})
describe("HuggingFaceProvider",()=>{
    it("constructor sets name and default baseUrl",()=>{
        let p=new HuggingFaceProvider("key")
        expect(p.name).toBe("huggingface")
        expect(p.baseUrl).toBe("https://api-inference.huggingface.co")
    })
    it("healthCheck returns true when ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200})))
        let p=new HuggingFaceProvider("key")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns true on 503 (model loading)",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:503})))
        let p=new HuggingFaceProvider("key")
        expect(await p.healthCheck()).toBe(true)
    })
    it("generate returns ProviderResult from array response",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,json:async()=>([{generated_text:"hf response"}])})))
        let p=new HuggingFaceProvider("key")
        let result=await p.generate("prompt","gpt2")
        expect(result.text).toBe("hf response")
        expect(result.provider).toBe("huggingface")
        expect(result.tokens).toBeGreaterThan(0)
    })
    it("generate handles non-array response",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,json:async()=>({generated_text:"single response"})})))
        let p=new HuggingFaceProvider("key")
        let result=await p.generate("prompt","gpt2")
        expect(result.text).toBe("single response")
    })
    it("generate throws on API error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:401,text:async()=>"unauthorized"})))
        let p=new HuggingFaceProvider("badkey")
        await expect(p.generate("prompt","gpt2")).rejects.toThrow("HuggingFace error 401")
    })
})
describe("ReplicateProvider",()=>{
    it("constructor sets name and default baseUrl",()=>{
        let p=new ReplicateProvider("token")
        expect(p.name).toBe("replicate")
        expect(p.baseUrl).toBe("https://api.replicate.com")
    })
    it("healthCheck returns true when ok",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200})))
        let p=new ReplicateProvider("token")
        expect(await p.healthCheck()).toBe(true)
    })
    it("healthCheck returns false on error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("network")}))
        let p=new ReplicateProvider("token")
        expect(await p.healthCheck()).toBe(false)
    })
    it("generate throws on invalid model format",async()=>{
        let p=new ReplicateProvider("token")
        await expect(p.generate("prompt","invalidmodel")).rejects.toThrow("owner/model")
    })
    it("generate throws on create error",async()=>{
        vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:400,text:async()=>"bad request"})))
        let p=new ReplicateProvider("token")
        await expect(p.generate("prompt","owner/abc123")).rejects.toThrow("Replicate create error 400")
    })
    it("generate polls and returns string output",async()=>{
        vi.useFakeTimers()
        vi.stubGlobal("fetch",vi.fn(async(url:any,init:any)=>{
            let u=String(url)
            if(u.includes("/v1/predictions")&&init&&init.method==="POST"){
                return{ok:true,status:200,json:async()=>({urls:{get:"https://api.replicate.com/v1/predictions/123"}})}
            }
            return{ok:true,status:200,json:async()=>({status:"succeeded",output:"replicate result"})}
        }))
        let p=new ReplicateProvider("token")
        let promise=p.generate("prompt","owner/abc123")
        await vi.advanceTimersByTimeAsync(1000)
        let result=await promise
        expect(result.text).toBe("replicate result")
        expect(result.provider).toBe("replicate")
        expect(result.tokens).toBeGreaterThan(0)
    })
    it("generate joins array output",async()=>{
        vi.useFakeTimers()
        vi.stubGlobal("fetch",vi.fn(async(url:any,init:any)=>{
            let u=String(url)
            if(u.includes("/v1/predictions")&&init&&init.method==="POST"){
                return{ok:true,status:200,json:async()=>({urls:{get:"https://api.replicate.com/v1/predictions/123"}})}
            }
            return{ok:true,status:200,json:async()=>({status:"succeeded",output:["hello ","world"]})}
        }))
        let p=new ReplicateProvider("token")
        let promise=p.generate("prompt","owner/abc123")
        await vi.advanceTimersByTimeAsync(1000)
        let result=await promise
        expect(result.text).toBe("hello world")
    })
    it("generate throws on prediction failed status",async()=>{
        vi.useFakeTimers()
        vi.stubGlobal("fetch",vi.fn(async(url:any,init:any)=>{
            let u=String(url)
            if(u.includes("/v1/predictions")&&init&&init.method==="POST"){
                return{ok:true,status:200,json:async()=>({urls:{get:"https://api.replicate.com/v1/predictions/123"}})}
            }
            return{ok:true,status:200,json:async()=>({status:"failed",error:"model crashed"})}
        }))
        let p=new ReplicateProvider("token")
        let promise=p.generate("prompt","owner/abc123")
        promise.catch(()=>{})
        await vi.advanceTimersByTimeAsync(1000)
        await expect(promise).rejects.toThrow("Replicate prediction failed: model crashed")
    })
    it("generate uses Token auth header",async()=>{
        vi.useFakeTimers()
        let mockFetch=vi.fn(async(url:any,init:any)=>{
            let u=String(url)
            if(u.includes("/v1/predictions")&&init&&init.method==="POST"){
                return{ok:true,status:200,json:async()=>({urls:{get:"https://api.replicate.com/v1/predictions/123"}})}
            }
            return{ok:true,status:200,json:async()=>({status:"succeeded",output:"ok"})}
        })
        vi.stubGlobal("fetch",mockFetch)
        let p=new ReplicateProvider("r8_token")
        let promise=p.generate("prompt","owner/abc123")
        await vi.advanceTimersByTimeAsync(1000)
        await promise
        let createCall=mockFetch.mock.calls[0]
        let createInit=createCall[1]as any
        expect(createInit.headers["Authorization"]).toBe("Token r8_token")
    })
})
