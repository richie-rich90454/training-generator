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
    generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>
}

export async function retryWithBackoff<T>(
    fn:()=>Promise<T>,
    maxRetries:number=3,
    baseDelay:number=1000,
    onRetry?:(attempt:number,error:string)=>void
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
            if(attempt<maxRetries){
                let delay=baseDelay*Math.pow(2,attempt)
                if(onRetry)onRetry(attempt+1,msg)
                await new Promise(resolve=>setTimeout(resolve,delay))
            }
        }
    }
    throw lastError!
}

export class OllamaProvider implements Provider{
    name="ollama"

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let result=await retryWithBackoff(async()=>{
            let r=await window.electronAPI.generateWithOllamaStream(model,prompt,{
                temperature:options?.temperature??0.7,
                top_p:options?.top_p??0.9
            })
            if(!r.success)throw new Error(r.error||"Ollama generation failed")
            return r
        },3,1000)
        let text=result.response!
        return{text,tokens:Math.ceil(text.length/4),provider:"ollama"}
    }
}

export class OpenAIProvider implements Provider{
    name="openai"
    apiKey:string
    baseUrl:string

    constructor(apiKey:string,baseUrl:string="https://api.openai.com"){
        this.apiKey=apiKey
        this.baseUrl=baseUrl
    }

    async generate(prompt:string,model:string,options?:ProviderOptions):Promise<ProviderResult>{
        let result=await retryWithBackoff(async()=>{
            let r=await window.electronAPI.generateWithOpenAI(
                this.apiKey,this.baseUrl,model,prompt,{
                    temperature:options?.temperature??0.7,
                    top_p:options?.top_p??0.9,
                    max_tokens:options?.max_tokens??4096
                }
            )
            if(!r.success)throw new Error(r.error||"OpenAI generation failed")
            return r
        },3,1000)
        return{
            text:result.response!,
            tokens:result.usage?.total_tokens??Math.ceil((result.response||"").length/4),
            provider:"openai"
        }
    }
}

export function createProvider(type:string,config?:{apiKey?:string;baseUrl?:string}):Provider{
    if(type==="openai"||type==="anthropic"||type==="gemini"){
        let baseUrl=config?.baseUrl||
            (type==="anthropic"?"https://api.anthropic.com":
             type==="gemini"?"https://generativelanguage.googleapis.com":
             "https://api.openai.com")
        return new OpenAIProvider(config?.apiKey||"",baseUrl)
    }
    return new OllamaProvider()
}