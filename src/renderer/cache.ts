interface CacheEntry{
    response:string
    tokens:number
    timestamp:number
}

let cacheMap:Map<string,CacheEntry>=new Map()
let cacheLoaded=false

async function loadCache():Promise<void>{
    if(cacheLoaded)return
    try{
        if(window.electronAPI?.loadCache){
            let result=await window.electronAPI.loadCache()
            if(result.success&&result.data){
                for(let[key,value]of Object.entries(result.data)){
                    cacheMap.set(key,value as CacheEntry)
                }
            }
        }
    }
    catch{}
    cacheLoaded=true
}

function hashKey(chunk:string,model:string,prompt:string):string{
    let str=`${chunk}|${model}|${prompt}`
    let hash=0
    for(let i=0;i<str.length;i++){
        let char=str.charCodeAt(i)
        hash=((hash<<5)-hash)+char
        hash=hash&hash
    }
    return Math.abs(hash).toString(16)
}

export async function getCachedResult(chunk:string,model:string,prompt:string):Promise<CacheEntry|null>{
    await loadCache()
    let key=hashKey(chunk,model,prompt)
    return cacheMap.get(key)||null
}

export async function setCachedResult(chunk:string,model:string,prompt:string,response:string,tokens:number):Promise<void>{
    await loadCache()
    let key=hashKey(chunk,model,prompt)
    cacheMap.set(key,{response,tokens,timestamp:Date.now()})
    try{
        if(window.electronAPI?.saveCache){
            let data:Record<string,CacheEntry>={}
            cacheMap.forEach((v,k)=>{data[k]=v})
            await window.electronAPI.saveCache(data as any)
        }
    }
    catch{}
}

export async function clearCache():Promise<void>{
    cacheMap.clear()
    try{
        if(window.electronAPI?.clearCache){
            await window.electronAPI.clearCache()
        }
    }
    catch{}
}