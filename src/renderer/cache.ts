import { logger } from "./logger.js"

interface CacheEntry{
    response:string
    tokens:number
    timestamp:number
}

const CACHE_TTL_MS=7*24*60*60*1000
const MAX_CACHE_SIZE=10000

export interface CacheStats{
    hits:number
    misses:number
    totalRequests:number
    estimatedTokensSaved:number
    estimatedCostSaved:number  // Rough estimate: $0.002 per 1K tokens
}

let cacheMap:Map<string,CacheEntry>=new Map()
let cacheLoaded=false
let loadPromise:Promise<void>|null=null
let saveTimeout:ReturnType<typeof setTimeout>|null=null

let cacheStats:CacheStats={hits:0,misses:0,totalRequests:0,estimatedTokensSaved:0,estimatedCostSaved:0}

export function getCacheStats():CacheStats{
    return{
        ...cacheStats,
        estimatedCostSaved:Math.round(cacheStats.estimatedCostSaved*10000)/10000
    }
}
export function resetCacheStats():void{cacheStats={hits:0,misses:0,totalRequests:0,estimatedTokensSaved:0,estimatedCostSaved:0}}

async function loadCache():Promise<void>{
    if(cacheLoaded)return
    if(loadPromise)return loadPromise
    loadPromise=(async ()=>{
        try{
            if(window.electronAPI?.loadCache){
                let result=await window.electronAPI.loadCache()
                if(result.success&&result.data){
                    for(let[key,value]of Object.entries(result.data)){
                        if(value&&typeof (value as CacheEntry).response==="string"&&typeof (value as CacheEntry).tokens==="number"){
                            cacheMap.set(key,value as CacheEntry)
                        }
                    }
                }
            }
        }
        catch(error){
            logger.error("Cache: failed to load cache",(error as Error).message)
        }
        cacheLoaded=true
    })()
    loadPromise.finally(()=>{loadPromise=null})
    return loadPromise
}

async function hashKey(chunk:string,model:string,prompt:string):Promise<string>{
    let chunkLen=String(chunk.length)
    let modelLen=String(model.length)
    let promptLen=String(prompt.length)
    let str=`${chunkLen}|${chunk}|${modelLen}|${model}|${promptLen}|${prompt}`
    let data=new TextEncoder().encode(str)
    let digest=await crypto.subtle.digest("SHA-256",data)
    let bytes=new Uint8Array(digest)
    let hex=""
    for(let i=0;i<bytes.length;i++){
        hex+=bytes[i].toString(16).padStart(2,"0")
    }
    return hex
}

export async function getCachedResult(chunk:string,model:string,prompt:string):Promise<CacheEntry|null>{
    await loadCache()
    let key=await hashKey(chunk,model,prompt)
    cacheStats.totalRequests++
    let entry=cacheMap.get(key)
    if(entry){
        if(Date.now()-entry.timestamp>CACHE_TTL_MS){
            cacheMap.delete(key)
            cacheStats.misses++
            return null
        }
        cacheStats.hits++
        cacheStats.estimatedTokensSaved+=entry.tokens
        cacheStats.estimatedCostSaved+=(entry.tokens/1000)*0.002
    }
    else{
        cacheStats.misses++
    }
    return entry||null
}

async function persistCache():Promise<void>{
    if(window.electronAPI?.saveCache){
        let data:Record<string,CacheEntry>={}
        cacheMap.forEach((v,k)=>{data[k]=v})
        await window.electronAPI.saveCache(data as Record<string, unknown>)
    }
}

function evictOldestIfNeeded():void{
    if(cacheMap.size<=MAX_CACHE_SIZE)return
    let entries=[...cacheMap.entries()]
    entries.sort((a,b)=>a[1].timestamp-b[1].timestamp)
    while(cacheMap.size>MAX_CACHE_SIZE){
        let oldest=entries.shift()
        if(oldest)cacheMap.delete(oldest[0])
        else break
    }
}

export async function setCachedResult(chunk:string,model:string,prompt:string,response:string,tokens:number):Promise<void>{
    await loadCache()
    let key=await hashKey(chunk,model,prompt)
    cacheMap.set(key,{response,tokens,timestamp:Date.now()})
    evictOldestIfNeeded()
    if(saveTimeout){
        clearTimeout(saveTimeout)
        saveTimeout=null
    }
    saveTimeout=setTimeout(()=>{
        saveTimeout=null
        persistCache().catch((error:unknown)=>{
            logger.error("Cache: failed to save cache entry",(error as Error).message)
        })
    },500)
}

export async function clearCache():Promise<void>{
    cacheMap.clear()
    cacheLoaded=false
    loadPromise=null
    if(saveTimeout){
        clearTimeout(saveTimeout)
        saveTimeout=null
    }
    try{
        if(window.electronAPI?.clearCache){
            await window.electronAPI.clearCache()
        }
    }
    catch(error){
        console.error("Cache: failed to clear cache",(error as Error).message)
    }
}

export async function warmCache(outputItems:Array<{instruction?:string;input?:string;output?:string;text?:string;messages?:Array<{role:string;content:string}>}>,model:string,prompt:string):Promise<number>{
    await loadCache()
    let warmed=0
    for(let item of outputItems){
        let chunk=""
        let response=""
        if(item.instruction){
            chunk=item.instruction
            response=item.output||""
        }
        else if(item.text){
            chunk=item.text.slice(0,500)
            response=item.text
        }
        else if(item.messages&&item.messages.length>0){
            let firstMsg=item.messages[0]
            let lastMsg=item.messages[item.messages.length-1]
            chunk=firstMsg.content.slice(0,500)
            response=lastMsg.content
        }
        if(!chunk||!response)continue
        let key=await hashKey(chunk,model,prompt)
        let tokens=Math.ceil(response.length/4)
        cacheMap.set(key,{response,tokens,timestamp:Date.now()})
        evictOldestIfNeeded()
        warmed++
    }
    try{
        if(window.electronAPI?.saveCache){
            let data:Record<string,CacheEntry>={}
            cacheMap.forEach((v,k)=>{data[k]=v})
            await window.electronAPI.saveCache(data as Record<string, unknown>)
        }
    }
    catch(error){
        logger.error("Cache: failed to save warmed cache entries",(error as Error).message)
    }
    return warmed
}
