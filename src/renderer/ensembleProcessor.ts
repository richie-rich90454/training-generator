import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
export interface EnsembleConfig{
    models:{providerId:string, model:string}[]
    options?:ProviderOptions
    scoringFn?:(result:ProviderResult, prompt:string)=>number
}
export interface EnsembleResult{
    best:ProviderResult
    bestProviderId:string
    bestModel:string
    bestScore:number
    allResults:{providerId:string, model:string, result:ProviderResult, score:number, error?:string}[]
    perModelContribution:Record<string, number>
}
export function defaultScoreFn(result:ProviderResult, prompt:string):number{
    let score=0
    let text=result.text||""
    if(text.length>0)score+=10
    if(text.length>50)score+=10
    if(text.length>200)score+=5
    try{
        let parsed=JSON.parse(text)
        if(Array.isArray(parsed))score+=20
        else if(typeof parsed==="object")score+=15
    }
    catch{
        if(text.includes('"instruction"')||text.includes('"input"')||text.includes('"output"'))score+=10
    }
    if(result.tokens>0&&result.tokens<text.length)score+=5
    if(/error|sorry|cannot|unable/i.test(text))score-=20
    if(text.trim().length===0)score-=50
    return score
}
export async function runEnsemble(
    providers:Map<string, Provider>,
    prompt:string,
    config:EnsembleConfig
):Promise<EnsembleResult>{
    let scoringFn=config.scoringFn||defaultScoreFn
    let promises=config.models.map(async(m)=>{
        let provider=providers.get(m.providerId)
        if(!provider)return{providerId:m.providerId, model:m.model, result:null, score:-Infinity, error:`Provider ${m.providerId} not found`}
        try{
            let result=await provider.generate(prompt, m.model, config.options)
            let score=scoringFn(result, prompt)
            return{providerId:m.providerId, model:m.model, result, score}
        }
        catch(error){
            return{providerId:m.providerId, model:m.model, result:null, score:-Infinity, error:(error as Error).message}
        }
    })
    let allResults=await Promise.all(promises)
    let best=allResults[0]
    for(let r of allResults){
        if(r.score>best.score)best=r
    }
    let perModelContribution:Record<string, number>={}
    for(let r of allResults){
        let key=`${r.providerId}/${r.model}`
        perModelContribution[key]=r.score
    }
    if(!best.result){
        throw new Error(`All ensemble models failed: ${allResults.map(r=>r.error).join("; ")}`)
    }
    return{
        best:best.result,
        bestProviderId:best.providerId,
        bestModel:best.model,
        bestScore:best.score,
        allResults:allResults as EnsembleResult["allResults"],
        perModelContribution
    }
}
export async function runEnsembleBatch(
    providers:Map<string, Provider>,
    prompts:string[],
    config:EnsembleConfig
):Promise<EnsembleResult[]>{
    let results:EnsembleResult[]=[]
    for(let prompt of prompts){
        let result=await runEnsemble(providers, prompt, config)
        results.push(result)
    }
    return results
}
