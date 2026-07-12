import{RateLimiter}from"./rateLimiter.js"
import type{ProviderConfig}from"../types/interfaces.js"
import{ProviderScopeEnforcer, ScopeError}from"../core/providerScopes.js"
import type{ProviderScopesConfig}from"../core/providerScopes.js"

export interface ProviderOptions{
    temperature?:number
    top_p?:number
    max_tokens?:number
    onToken?:(token:string)=>void
    think?:boolean
    ollamaHost?:string
    ollamaPort?:number
    signal?:AbortSignal
    processingType?:string
}

export interface StrictGenerationOptions{
    temperature:number
    top_p:number
    repeat_penalty?:number
}

export function getStrictGenerationOptions(processingType:string):StrictGenerationOptions{
    // Lower temperature for more deterministic, format-compliant output
    // instruction/conversation need slightly more creativity for diverse questions
    // chunking/custom are more extractive and benefit from even lower temperature
    const temp=(processingType==="instruction"||processingType==="conversation")?0.3:0.4
    // Higher repeat_penalty for instruction/conversation to break repetition loops
    const repeatPenalty=(processingType==="instruction"||processingType==="conversation")?1.2:1.15
    return{
        temperature:temp,
        top_p:0.85,
        repeat_penalty:repeatPenalty
    }
}

export interface ProviderResult{
    text:string
    tokens:number
    provider:string
}

export interface Provider{
    name:string
    rateLimiter?:RateLimiter
    generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>
    healthCheck?():Promise<boolean>
}

export interface ProviderHealth{
    provider:Provider
    consecutiveFailures:number
    isHealthy:boolean
    lastCheck:number
}

export async function retryWithBackoff<T>(
    fn:()=>Promise<T>,
    maxRetries:number=3,
    baseDelay:number=1000,
    onRetry?:(attempt:number,error:string)=>void,
    rateLimiter?:RateLimiter
):Promise<T>{
    let lastError:Error|null=null
    for(let attempt=0;attempt<=maxRetries;attempt++){
        try{
            return await fn()
        }
        catch(error){
            lastError=error as Error
            let msg=lastError.message||""
            // Don't retry on auth errors (4xx except 429)
            if(msg.includes("401")||msg.includes("403")||msg.includes("invalid api key")){
                throw lastError
            }
            // Handle rate limit (429) errors
            if(msg.includes("429")||msg.toLowerCase().includes("rate limit")){
                if(rateLimiter){
                    let retryAfter=parseRetryAfter(msg)
                    rateLimiter.handleRateLimitResponse(retryAfter)
                }
                if(attempt<maxRetries){
                    let delay=baseDelay*Math.pow(2,attempt)
                    if(onRetry)onRetry(attempt+1,msg)
                    await new Promise(resolve=>setTimeout(resolve,delay))
                }
            }
            else if(attempt<maxRetries){
                let delay=baseDelay*Math.pow(2,attempt)
                if(onRetry)onRetry(attempt+1,msg)
                await new Promise(resolve=>setTimeout(resolve,delay))
            }
        }
    }
    console.error("retryWithBackoff: all retries exhausted",lastError?.message||"unknown error")
    throw lastError||new Error("retryWithBackoff: all retries exhausted")
}

function parseRetryAfter(msg:string):number|undefined{
    let match=msg.match(/retry[_-]?after[:\s]*(\d+)/i)
    if(match)return parseInt(match[1],10)
    return undefined
}

export class OllamaProvider implements Provider{
    name="ollama"
    rateLimiter?:RateLimiter=undefined

    async healthCheck():Promise<boolean>{
        if(!window.electronAPI?.checkOllama)return false
        try{
            let status=await window.electronAPI.checkOllama()
            return status.running
        }
        catch{
            return false
        }
    }

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let api=window.electronAPI
        if(!api)throw new Error("Electron API not available")
        console.log(`[ollama-provider] request start: model=${model}, prompt=${prompt.length} chars`)
        const onToken=options?.onToken
        const signal=options?.signal
        if(signal?.aborted)throw new Error("Aborted")
        const requestId=onToken?`ollama-${Date.now()}-${Math.random().toString(36).slice(2,9)}`:""
        let unsub:(()=>void)|null=null
        if(onToken&&requestId&&api.onOllamaStreamToken){
            unsub=api.onOllamaStreamToken(requestId,onToken)
        }
        try{
            let result=await retryWithBackoff(async()=>{
                if(signal?.aborted)throw new Error("Aborted")
                const requestedTokens=options?.max_tokens!=null?Math.min(8192,Math.max(256,options.max_tokens)):4096
                // Cap num_predict at 4096 for instruction/conversation to truncate runaway repetition loops early
                const maxTokens=(options?.processingType==="instruction"||options?.processingType==="conversation")
                    ?Math.min(4096,requestedTokens)
                    :requestedTokens
                const strictOpts=options?.processingType?getStrictGenerationOptions(options.processingType):null
                const payload:Record<string,unknown>={
                    temperature:strictOpts?.temperature??options?.temperature??0.7,
                    top_p:strictOpts?.top_p??options?.top_p??0.9,
                    repeat_penalty:strictOpts?.repeat_penalty??1.15,
                    num_predict:maxTokens
                }
                if(options?.think===false){
                    payload.think=false
                }
                if(requestId){
                    payload._requestId=requestId
                }
                let ipcPromise=api.generateWithOllamaStream(model,prompt,payload,options?.ollamaHost,options?.ollamaPort)
                if(signal){
                    let abortPromise=new Promise<never>((_,reject)=>{
                        signal.addEventListener("abort",()=>reject(new Error("Aborted")),{once:true})
                    })
                    let r=await Promise.race([ipcPromise,abortPromise])
                    if(!r.success)throw new Error(r.error||"Ollama generation failed")
                    return r
                }
                let r=await ipcPromise
                if(!r.success)throw new Error(r.error||"Ollama generation failed")
                return r
            },3,1000)
            let text=result.response!
            console.log(`[ollama-provider] request complete: ${text.length} chars response`)
            return{text,tokens:Math.ceil(text.length/4),provider:"ollama"}
        }
        catch(error){
            console.error("OllamaProvider.generate failed:",(error as Error).message)
            throw error
        }
        finally{
            if(unsub)unsub()
        }
    }
}

export class OpenAIProvider implements Provider{
    name="openai"
    apiKey:string
    baseUrl:string
    rateLimiter:RateLimiter

    constructor(apiKey:string,baseUrl:string="https://api.openai.com"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.rateLimiter=new RateLimiter(60,10)
        this.rateLimiter.enable()
    }

    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`${this.baseUrl}/v1/models`,{
                headers:{
                    "Authorization":`Bearer ${this.apiKey}`,
                    "Content-Type":"application/json"
                }
            })
            return response.ok
        }
        catch{
            return false
        }
    }

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let api=window.electronAPI
        if(!api)throw new Error("Electron API not available")
        try{
            await this.rateLimiter.acquire()
            let result=await retryWithBackoff(async()=>{
                const strictOpts=options?.processingType?getStrictGenerationOptions(options.processingType):null
                let r=await api.generateWithOpenAI(
                    this.apiKey,this.baseUrl,model,prompt,{
                        temperature:strictOpts?.temperature??options?.temperature??0.7,
                        top_p:strictOpts?.top_p??options?.top_p??0.9,
                        max_tokens:options?.max_tokens??4096
                    }
                )
                if(!r.success)throw new Error(r.error||"OpenAI generation failed")
                return r
            },3,1000,undefined,this.rateLimiter)
            return{
                text:result.response!,
                tokens:result.usage?.total_tokens??Math.ceil((result.response||"").length/4),
                provider:"openai"
            }
        }
        catch(error){
            console.error("OpenAIProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}

export class ProviderManager implements Provider{
    name="provider-manager"
    rateLimiter?:RateLimiter=undefined
    private providers:ProviderHealth[]
    private currentIndex:number
    private healthCheckInterval:ReturnType<typeof setInterval>|null=null

    constructor(providers:Provider[]){
        this.providers=providers.map(p=>({
            provider:p,
            consecutiveFailures:0,
            isHealthy:true,
            lastCheck:0
        }))
        this.currentIndex=0
    }

    getCurrentProvider():Provider{
        return this.providers[this.currentIndex].provider
    }

    failover():Provider|null{
        let health=this.providers[this.currentIndex]
        health.isHealthy=false
        health.consecutiveFailures=0
        // Try to find next healthy provider
        for(let i=0;i<this.providers.length;i++){
            this.currentIndex=(this.currentIndex+1)%this.providers.length
            if(this.providers[this.currentIndex].isHealthy){
                console.log(`ProviderManager: failed over to ${this.providers[this.currentIndex].provider.name}`)
                return this.providers[this.currentIndex].provider
            }
        }
        console.error("ProviderManager: no healthy providers available")
        return null
    }

    async checkHealth():Promise<void>{
        let results=await Promise.allSettled(
            this.providers.map(async(ph)=>{
                if(!ph.provider.healthCheck)return
                let start=Date.now()
                try{
                    let healthy=await ph.provider.healthCheck()
                    ph.isHealthy=healthy
                    ph.lastCheck=start
                    if(healthy)ph.consecutiveFailures=0
                }
                catch{
                    ph.isHealthy=false
                    ph.lastCheck=start
                }
            })
        )
    }

    startHealthChecks(intervalMs:number):void{
        this.stopHealthChecks()
        this.healthCheckInterval=setInterval(()=>{
            this.checkHealth()
        },intervalMs)
    }

    stopHealthChecks():void{
        if(this.healthCheckInterval!==null){
            clearInterval(this.healthCheckInterval)
            this.healthCheckInterval=null
        }
    }

    dispose():void{
        this.stopHealthChecks()
    }

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        if(this.providers.length===0)throw new Error("No providers configured")
        let health=this.providers[this.currentIndex]
        if(!health)throw new Error("No healthy provider available")
        try{
            let result=await health.provider.generate(prompt,model,options)
            health.consecutiveFailures=0
            return result
        }
        catch(error){
            health.consecutiveFailures++
            console.warn(`ProviderManager: ${health.provider.name} failed (${health.consecutiveFailures}/3 consecutive)`,(error as Error).message)
            if(health.consecutiveFailures>=3){
                console.warn(`ProviderManager: ${health.provider.name} marked unhealthy after 3 consecutive failures`)
                let next=this.failover()
                if(next){
                    // Retry with the new provider
                    return next.generate(prompt,model,options)
                }
            }
            throw error
        }
    }
}

export class AnthropicProvider implements Provider{
    name="anthropic"
    apiKey:string
    rateLimiter:RateLimiter
    constructor(apiKey:string){
        this.apiKey=apiKey
        this.rateLimiter=new RateLimiter(30,5)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch("https://api.anthropic.com/v1/messages",{
                method:"POST",
                headers:{
                    "x-api-key":this.apiKey,
                    "anthropic-version":"2023-06-01",
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({model:"claude-3-haiku-20240307",max_tokens:1,messages:[{role:"user",content:"ping"}]})
            })
            return response.ok||response.status===429
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let api=window.electronAPI
        if(!api)throw new Error("Electron API not available")
        try{
            await this.rateLimiter.acquire()
            let result=await retryWithBackoff(async()=>{
                const strictOpts=options?.processingType?getStrictGenerationOptions(options.processingType):null
                let r=await api.generateWithAnthropic(
                    this.apiKey,model,prompt,{
                        temperature:strictOpts?.temperature??options?.temperature??0.7,
                        top_p:strictOpts?.top_p??options?.top_p??0.9,
                        max_tokens:options?.max_tokens??4096
                    }
                )
                if(!r.success)throw new Error(r.error||"Anthropic generation failed")
                return r
            },3,1000,undefined,this.rateLimiter)
            return{
                text:result.response!,
                tokens:result.usage?.total_tokens??Math.ceil((result.response||"").length/4),
                provider:"anthropic"
            }
        }
        catch(error){
            console.error("AnthropicProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}
export class GeminiProvider implements Provider{
    name="gemini"
    apiKey:string
    rateLimiter:RateLimiter
    constructor(apiKey:string){
        this.apiKey=apiKey
        this.rateLimiter=new RateLimiter(30,5)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`)
            return response.ok
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let api=window.electronAPI
        if(!api)throw new Error("Electron API not available")
        try{
            await this.rateLimiter.acquire()
            let result=await retryWithBackoff(async()=>{
                const strictOpts=options?.processingType?getStrictGenerationOptions(options.processingType):null
                let r=await api.generateWithGemini(
                    this.apiKey,model,prompt,{
                        temperature:strictOpts?.temperature??options?.temperature??0.7,
                        top_p:strictOpts?.top_p??options?.top_p??0.9,
                        max_tokens:options?.max_tokens??4096
                    }
                )
                if(!r.success)throw new Error(r.error||"Gemini generation failed")
                return r
            },3,1000,undefined,this.rateLimiter)
            return{
                text:result.response!,
                tokens:result.usage?.total_tokens??Math.ceil((result.response||"").length/4),
                provider:"gemini"
            }
        }
        catch(error){
            console.error("GeminiProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}
export function createProvider(type:string,config?:{apiKey?:string;baseUrl?:string}):ProviderManager{
    let providers:Provider[]=[]
    if(type==="openai"){
        let baseUrl=config?.baseUrl||"https://api.openai.com"
        providers.push(new OpenAIProvider(config?.apiKey||"",baseUrl))
    }
    else if(type==="anthropic"){
        providers.push(new AnthropicProvider(config?.apiKey||""))
    }
    else if(type==="gemini"){
        providers.push(new GeminiProvider(config?.apiKey||""))
    }
    // Always add Ollama as fallback
    if(type!=="ollama"){
        providers.push(new OllamaProvider())
    }
    else{
        providers.push(new OllamaProvider())
    }
    return new ProviderManager(providers)
}
export interface HealthCheckResult{
    ok:boolean
    latencyMs:number
    error?:string
}
export class ProviderRegistry{
    name="provider-registry"
    private configs:ProviderConfig[]
    private providers:Map<string, Provider>
    private health:Map<string, {consecutiveFailures:number, isHealthy:boolean, lastCheck:number, lastLatencyMs:number}>
    private failoverLog:{provider:string, reason:string, timestamp:number}[]
    private scopeEnforcer:ProviderScopeEnforcer
    constructor(configs:ProviderConfig[], providers:Map<string, Provider>){
        this.configs=configs.filter(c=>c.enabled).sort((a,b)=>a.priority-b.priority)
        this.providers=providers
        this.health=new Map()
        this.failoverLog=[]
        this.scopeEnforcer=new ProviderScopeEnforcer({scopes:{}})
        for(let config of this.configs){
            this.health.set(config.id, {consecutiveFailures:0, isHealthy:true, lastCheck:0, lastLatencyMs:0})
        }
    }
    setProviderScopes(scopes:ProviderScopesConfig):void{
        this.scopeEnforcer=new ProviderScopeEnforcer({scopes})
    }
    getConfigs():ProviderConfig[]{
        return this.configs
    }
    getFailoverLog():{provider:string, reason:string, timestamp:number}[]{
        return this.failoverLog
    }
    getCurrentProvider():Provider|null{
        for(let config of this.configs){
            let h=this.health.get(config.id)
            if(h&&h.isHealthy){
                let provider=this.providers.get(config.id)
                if(provider)return provider
            }
        }
        return null
    }
    async healthCheck(configId:string):Promise<HealthCheckResult>{
        let config=this.configs.find(c=>c.id===configId)
        if(!config)return{ok:false, latencyMs:0, error:"Provider config not found"}
        let provider=this.providers.get(configId)
        if(!provider)return{ok:false, latencyMs:0, error:"Provider not registered"}
        if(!provider.healthCheck)return{ok:true, latencyMs:0}
        let start=Date.now()
        try{
            let ok=await provider.healthCheck()
            let latencyMs=Date.now()-start
            let h=this.health.get(configId)
            if(h){
                h.lastCheck=start
                h.lastLatencyMs=latencyMs
                h.isHealthy=ok
                if(ok)h.consecutiveFailures=0
            }
            return{ok, latencyMs}
        }
        catch(error){
            let latencyMs=Date.now()-start
            let h=this.health.get(configId)
            if(h){
                h.lastCheck=start
                h.lastLatencyMs=latencyMs
                h.isHealthy=false
            }
            return{ok:false, latencyMs, error:(error as Error).message}
        }
    }
    async healthCheckAll():Promise<Map<string, HealthCheckResult>>{
        let results=new Map<string, HealthCheckResult>()
        let promises=this.configs.map(async(config)=>{
            let result=await this.healthCheck(config.id)
            results.set(config.id, result)
        })
        await Promise.allSettled(promises)
        return results
    }
    async generateWithFailover(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
        let lastError:Error=new Error("No provider available")
        let scopeMissing=false
        for(let config of this.configs){
            let h=this.health.get(config.id)
            if(!h||!h.isHealthy)continue
            let provider=this.providers.get(config.id)
            if(!provider)continue
            if(!this.scopeEnforcer.hasScope(config.id,"generate")){
                scopeMissing=true
                continue
            }
            try{
                let result=await provider.generate(prompt, model, options)
                h.consecutiveFailures=0
                return result
            }
            catch(error){
                lastError=error as Error
                h.consecutiveFailures++
                let reason=(error as Error).message||"unknown error"
                if(h.consecutiveFailures>=3){
                    h.isHealthy=false
                    this.failoverLog.push({provider:config.id, reason, timestamp:Date.now()})
                    console.warn(`ProviderRegistry: ${config.id} marked unhealthy after 3 consecutive failures: ${reason}`)
                }
                else{
                    console.warn(`ProviderRegistry: ${config.id} failed (${h.consecutiveFailures}/3): ${reason}`)
                }
            }
        }
        if(scopeMissing)throw new ScopeError("No provider with generate scope available")
        throw lastError!
    }
    resetProvider(configId:string):void{
        let h=this.health.get(configId)
        if(h){
            h.consecutiveFailures=0
            h.isHealthy=true
        }
    }
    getHealthStatus(configId:string):{consecutiveFailures:number, isHealthy:boolean, lastCheck:number, lastLatencyMs:number}|undefined{
        return this.health.get(configId)
    }
}
export class OpenAICompatibleProvider implements Provider{
    name:string
    apiKey:string
    baseUrl:string
    rateLimiter:RateLimiter
    constructor(name:string,apiKey:string,baseUrl:string){
        this.name=name
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.rateLimiter=new RateLimiter(60,10)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`${this.baseUrl}/v1/models`,{
                headers:{
                    "Authorization":`Bearer ${this.apiKey}`,
                    "Content-Type":"application/json"
                }
            })
            return response.ok
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let api=window.electronAPI
        if(!api)throw new Error("Electron API not available")
        try{
            await this.rateLimiter.acquire()
            let result=await retryWithBackoff(async()=>{
                let r=await api.generateWithOpenAI(
                    this.apiKey,this.baseUrl,model,prompt,{
                        temperature:options?.temperature??0.7,
                        top_p:options?.top_p??0.9,
                        max_tokens:options?.max_tokens??4096
                    }
                )
                if(!r.success)throw new Error(r.error||`${this.name} generation failed`)
                return r
            },3,1000,undefined,this.rateLimiter)
            return{
                text:result.response!,
                tokens:result.usage?.total_tokens??Math.ceil((result.response||"").length/4),
                provider:this.name
            }
        }
        catch(error){
            console.error(`${this.name}.generate failed:`,(error as Error).message)
            throw error
        }
    }
}
export class MistralProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string){
        super("mistral",apiKey,"https://api.mistral.ai")
    }
}
export class TogetherProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string){
        super("together",apiKey,"https://api.together.xyz")
    }
}
export class GroqProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string){
        super("groq",apiKey,"https://api.groq.com/openai")
    }
}
export class PerplexityProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string){
        super("perplexity",apiKey,"https://api.perplexity.ai")
    }
}
export class DeepSeekProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string){
        super("deepseek",apiKey,"https://api.deepseek.com")
    }
}
export class LocalAIProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string="",baseUrl:string="http://localhost:8080"){
        super("localai",apiKey,baseUrl)
    }
}
export class LMStudioProvider extends OpenAICompatibleProvider{
    constructor(baseUrl:string="http://localhost:1234"){
        super("lmstudio","",baseUrl)
    }
}
export class VllmProvider extends OpenAICompatibleProvider{
    constructor(apiKey:string="",baseUrl:string="http://localhost:8000"){
        super("vllm",apiKey,baseUrl)
    }
}
export class AzureOpenAIProvider implements Provider{
    name="azure-openai"
    apiKey:string
    baseUrl:string
    deployment:string
    apiVersion:string
    rateLimiter:RateLimiter
    constructor(apiKey:string,baseUrl:string,deployment:string,apiVersion:string="2024-02-15-preview"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.deployment=deployment
        this.apiVersion=apiVersion
        this.rateLimiter=new RateLimiter(60,10)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let url=`${this.baseUrl}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`
            let response=await fetch(url,{
                method:"POST",
                headers:{
                    "api-key":this.apiKey,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({messages:[{role:"user",content:"ping"}],max_tokens:1})
            })
            return response.ok||response.status===400
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        try{
            await this.rateLimiter.acquire()
            let url=`${this.baseUrl}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`
            let response=await fetch(url,{
                method:"POST",
                headers:{
                    "api-key":this.apiKey,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    messages:[{role:"user",content:prompt}],
                    temperature:options?.temperature??0.7,
                    top_p:options?.top_p??0.9,
                    max_tokens:options?.max_tokens??4096
                })
            })
            if(!response.ok){
                let errorText=await response.text()
                throw new Error(`Azure OpenAI error ${response.status}: ${errorText}`)
            }
            let data=await response.json()
            let text=data.choices?.[0]?.message?.content||""
            return{text,tokens:data.usage?.total_tokens??Math.ceil(text.length/4),provider:"azure-openai"}
        }
        catch(error){
            console.error("AzureOpenAIProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}
export class CohereProvider implements Provider{
    name="cohere"
    apiKey:string
    baseUrl:string
    rateLimiter:RateLimiter
    constructor(apiKey:string,baseUrl:string="https://api.cohere.ai"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.rateLimiter=new RateLimiter(60,10)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`${this.baseUrl}/v1/models`,{
                headers:{"Authorization":`Bearer ${this.apiKey}`}
            })
            return response.ok
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        try{
            await this.rateLimiter.acquire()
            let response=await fetch(`${this.baseUrl}/v1/chat`,{
                method:"POST",
                headers:{
                    "Authorization":`Bearer ${this.apiKey}`,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    message:prompt,
                    model:model,
                    temperature:options?.temperature??0.7
                })
            })
            if(!response.ok){
                let errorText=await response.text()
                throw new Error(`Cohere error ${response.status}: ${errorText}`)
            }
            let data=await response.json()
            let text=data.text||""
            return{text,tokens:Math.ceil(text.length/4),provider:"cohere"}
        }
        catch(error){
            console.error("CohereProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}
export class HuggingFaceProvider implements Provider{
    name="huggingface"
    apiKey:string
    baseUrl:string
    rateLimiter:RateLimiter
    constructor(apiKey:string,baseUrl:string="https://api-inference.huggingface.co"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.rateLimiter=new RateLimiter(30,5)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`${this.baseUrl}/models/gpt2`,{
                headers:{"Authorization":`Bearer ${this.apiKey}`}
            })
            return response.ok||response.status===503
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        try{
            await this.rateLimiter.acquire()
            let response=await fetch(`${this.baseUrl}/models/${model}`,{
                method:"POST",
                headers:{
                    "Authorization":`Bearer ${this.apiKey}`,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    inputs:prompt,
                    parameters:{
                        temperature:options?.temperature??0.7,
                        top_p:options?.top_p??0.9,
                        max_new_tokens:options?.max_tokens??4096
                    }
                })
            })
            if(!response.ok){
                let errorText=await response.text()
                throw new Error(`HuggingFace error ${response.status}: ${errorText}`)
            }
            let data=await response.json()
            let text=Array.isArray(data)?(data[0]?.generated_text||""):(data.generated_text||"")
            return{text,tokens:Math.ceil(text.length/4),provider:"huggingface"}
        }
        catch(error){
            console.error("HuggingFaceProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}
export class ReplicateProvider implements Provider{
    name="replicate"
    apiKey:string
    baseUrl:string
    rateLimiter:RateLimiter
    constructor(apiKey:string,baseUrl:string="https://api.replicate.com"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
        this.rateLimiter=new RateLimiter(20,5)
        this.rateLimiter.enable()
    }
    async healthCheck():Promise<boolean>{
        try{
            let response=await fetch(`${this.baseUrl}/v1/account`,{
                headers:{"Authorization":`Token ${this.apiKey}`}
            })
            return response.ok
        }
        catch{
            return false
        }
    }
    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        try{
            await this.rateLimiter.acquire()
            let [owner,modelName]=model.split("/")
            if(!owner||!modelName)throw new Error("Replicate model must be in format owner/model:version")
            let createResponse=await fetch(`${this.baseUrl}/v1/predictions`,{
                method:"POST",
                headers:{
                    "Authorization":`Token ${this.apiKey}`,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    version:modelName,
                    input:{prompt,temperature:options?.temperature??0.7}
                })
            })
            if(!createResponse.ok){
                let errorText=await createResponse.text()
                throw new Error(`Replicate create error ${createResponse.status}: ${errorText}`)
            }
            let prediction=await createResponse.json()
            let predictionUrl=prediction.urls?.get
            if(!predictionUrl)throw new Error("Replicate: no prediction URL returned")
            // Poll until complete
            for(let i=0;i<120;i++){
                await new Promise(resolve=>setTimeout(resolve,1000))
                let pollResponse=await fetch(predictionUrl,{
                    headers:{"Authorization":`Token ${this.apiKey}`}
                })
                if(!pollResponse.ok){
                    let errorText=await pollResponse.text()
                    throw new Error(`Replicate poll error ${pollResponse.status}: ${errorText}`)
                }
                let pollData=await pollResponse.json()
                if(pollData.status==="succeeded"){
                    let text=Array.isArray(pollData.output)?pollData.output.join(""):(pollData.output||"")
                    return{text,tokens:Math.ceil(text.length/4),provider:"replicate"}
                }
                else if(pollData.status==="failed")throw new Error(`Replicate prediction failed: ${pollData.error||"unknown"}`)
            }
            throw new Error("Replicate prediction timed out after 120s")
        }
        catch(error){
            console.error("ReplicateProvider.generate failed:",(error as Error).message)
            throw error
        }
    }
}