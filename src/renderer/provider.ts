import{RateLimiter}from"./rateLimiter.js"
import type{ProviderConfig}from"../types/interfaces.js"

export interface ProviderOptions{
    temperature?:number
    top_p?:number
    max_tokens?:number
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
    let lastError:Error
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
    console.error("retryWithBackoff: all retries exhausted",lastError!.message)
    throw lastError!
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
        try{
            let result=await retryWithBackoff(async()=>{
                let r=await api.generateWithOllamaStream(model,prompt,{
                    temperature:options?.temperature??0.7,
                    top_p:options?.top_p??0.9
                })
                if(!r.success)throw new Error(r.error||"Ollama generation failed")
                return r
            },3,1000)
            let text=result.response!
            return{text,tokens:Math.ceil(text.length/4),provider:"ollama"}
        }
        catch(error){
            console.error("OllamaProvider.generate failed:",(error as Error).message)
            throw error
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
                let r=await api.generateWithOpenAI(
                    this.apiKey,this.baseUrl,model,prompt,{
                        temperature:options?.temperature??0.7,
                        top_p:options?.top_p??0.9,
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

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let health=this.providers[this.currentIndex]
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

export function createProvider(type:string,config?:{apiKey?:string;baseUrl?:string}):ProviderManager{
    let providers:Provider[]=[]
    if(type==="openai"||type==="anthropic"||type==="gemini"){
        let baseUrl=config?.baseUrl||
            (type==="anthropic"?"https://api.anthropic.com":
             type==="gemini"?"https://generativelanguage.googleapis.com":
             "https://api.openai.com")
        providers.push(new OpenAIProvider(config?.apiKey||"",baseUrl))
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
    constructor(configs:ProviderConfig[], providers:Map<string, Provider>){
        this.configs=configs.filter(c=>c.enabled).sort((a,b)=>a.priority-b.priority)
        this.providers=providers
        this.health=new Map()
        this.failoverLog=[]
        for(let config of this.configs){
            this.health.set(config.id, {consecutiveFailures:0, isHealthy:true, lastCheck:0, lastLatencyMs:0})
        }
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
        let lastError:Error
        for(let config of this.configs){
            let h=this.health.get(config.id)
            if(!h||!h.isHealthy)continue
            let provider=this.providers.get(config.id)
            if(!provider)continue
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