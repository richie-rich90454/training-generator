import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
export interface BenchmarkResult{
    providerName:string
    samples:number
    latencies:number[]
    p50:number
    p95:number
    p99:number
    mean:number
    min:number
    max:number
    successCount:number
    errorCount:number
    errors:string[]
}
export interface BenchmarkConfig{
    prompt:string
    model:string
    runs:number
    options?:ProviderOptions
}
export const DEFAULT_BENCHMARK_CONFIG:BenchmarkConfig={
    prompt:"What is 2+2? Reply with just the number.",
    model:"gpt-3.5-turbo",
    runs:5,
    options:{temperature:0, max_tokens:10}
}
export function computePercentile(sortedValues:number[], percentile:number):number{
    if(sortedValues.length===0)return 0
    let index=Math.ceil((percentile/100)*sortedValues.length)-1
    index=Math.max(0, Math.min(index, sortedValues.length-1))
    return sortedValues[index]
}
export async function benchmarkProvider(provider:Provider, config:BenchmarkConfig=DEFAULT_BENCHMARK_CONFIG):Promise<BenchmarkResult>{
    let latencies:number[]=[]
    let errors:string[]=[]
    let successCount=0
    for(let i=0;i<config.runs;i++){
        let start=Date.now()
        try{
            await provider.generate(config.prompt, config.model, config.options)
            latencies.push(Date.now()-start)
            successCount++
        }
        catch(error){
            errors.push((error as Error).message)
        }
    }
    let sorted=[...latencies].sort((a,b)=>a-b)
    let sum=latencies.reduce((a,b)=>a+b, 0)
    return{
        providerName:provider.name,
        samples:config.runs,
        latencies:latencies,
        p50:computePercentile(sorted, 50),
        p95:computePercentile(sorted, 95),
        p99:computePercentile(sorted, 99),
        mean:latencies.length>0?Math.round(sum/latencies.length):0,
        min:latencies.length>0?sorted[0]:0,
        max:latencies.length>0?sorted[sorted.length-1]:0,
        successCount,
        errorCount:errors.length,
        errors
    }
}
export async function benchmarkProviders(providers:Provider[], config:BenchmarkConfig=DEFAULT_BENCHMARK_CONFIG):Promise<BenchmarkResult[]>{
    let results=await Promise.allSettled(providers.map(p=>benchmarkProvider(p, config)))
    return results.map((r, i)=>{
        if(r.status==="fulfilled")return r.value
        return{
            providerName:providers[i].name,
            samples:config.runs,
            latencies:[],
            p50:0, p95:0, p99:0, mean:0, min:0, max:0,
            successCount:0,
            errorCount:1,
            errors:[r.reason?.message||"benchmark failed"]
        }
    })
}
export function formatBenchmarkTable(results:BenchmarkResult[]):string{
    let header="Provider".padEnd(20)+"Runs".padStart(6)+"P50".padStart(8)+"P95".padStart(8)+"P99".padStart(8)+"Mean".padStart(8)+"Errors".padStart(8)
    let separator="-".repeat(header.length)
    let rows=results.map(r=>r.providerName.padEnd(20)+String(r.successCount).padStart(6)+String(r.p50+"ms").padStart(8)+String(r.p95+"ms").padStart(8)+String(r.p99+"ms").padStart(8)+String(r.mean+"ms").padStart(8)+String(r.errorCount).padStart(8))
    return[header, separator, ...rows].join("\n")
}
