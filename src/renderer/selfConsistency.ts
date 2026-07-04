import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
export interface SelfConsistencyConfig{
    samples:number
    temperature:number
    options?:Omit<ProviderOptions, 'temperature'>
}
export const DEFAULT_SC_CONFIG:SelfConsistencyConfig={
    samples:5,
    temperature:0.7
}
export interface VoteResult{
    winner:ProviderResult
    voteCount:number
    totalSamples:number
    uniqueAnswers:number
    confidence:number
    allResults:ProviderResult[]
    distribution:{answer:string, count:number, normalized:string}[]
}
export function normalizeAnswer(text:string):string{
    let normalized=text.trim().toLowerCase()
    normalized=normalized.replace(/[.\,!?\n\r]+$/g, "")
    normalized=normalized.replace(/\s+/g, " ")
    try{
        let parsed=JSON.parse(normalized)
        if(typeof parsed==="object"&&parsed!==null){
            return JSON.stringify(sortKeysDeep(parsed))
        }
        return String(parsed)
    }
    catch{
        return normalized
    }
}
function sortKeysDeep(obj:unknown):unknown{
    if(obj===null||typeof obj!=="object")return obj
    if(Array.isArray(obj))return obj.map(sortKeysDeep)
    let sorted:Record<string, unknown>={}
    let keys=Object.keys(obj as Record<string, unknown>).sort()
    for(let key of keys){
        sorted[key]=sortKeysDeep((obj as Record<string, unknown>)[key])
    }
    return sorted
}
export function vote(results:ProviderResult[]):VoteResult{
    if(results.length===0)throw new Error("No results to vote on")
    let buckets=new Map<string, {count:number, representative:ProviderResult, normalized:string}>()
    for(let result of results){
        let normalized=normalizeAnswer(result.text)
        let existing=buckets.get(normalized)
        if(existing){
            existing.count++
        }
        else{
            buckets.set(normalized, {count:1, representative:result, normalized})
        }
    }
    let sorted=[...buckets.entries()].sort((a,b)=>b[1].count-a[1].count)
    let winner=sorted[0]
    let voteCount=winner[1].count
    let confidence=voteCount/results.length
    let distribution=sorted.map(([_, v])=>({answer:v.representative.text, count:v.count, normalized:v.normalized}))
    return{
        winner:winner[1].representative,
        voteCount,
        totalSamples:results.length,
        uniqueAnswers:buckets.size,
        confidence,
        allResults:results,
        distribution
    }
}
export async function selfConsistencyGenerate(
    provider:Provider,
    prompt:string,
    model:string,
    config:SelfConsistencyConfig=DEFAULT_SC_CONFIG
):Promise<VoteResult>{
    let options:ProviderOptions={
        ...config.options,
        temperature:config.temperature
    }
    let promises:Promise<ProviderResult>[]=[]
    for(let i=0;i<config.samples;i++){
        promises.push(
            provider.generate(prompt, model, options).catch(error=>{
                return{text:`__ERROR__: ${(error as Error).message}`, tokens:0, provider:provider.name}as ProviderResult
            })
        )
    }
    let results=await Promise.all(promises)
    let validResults=results.filter(r=>!r.text.startsWith("__ERROR__"))
    if(validResults.length===0){
        throw new Error(`All ${config.samples} samples failed: ${results.map(r=>r.text).join("; ")}`)
    }
    return vote(validResults)
}
