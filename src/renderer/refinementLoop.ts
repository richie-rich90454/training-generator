import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
export interface RefinementConfig{
    maxPasses:number
    qualityThreshold:number
    critiqueModel?:string
    reviseModel?:string
    options?:ProviderOptions
}
export const DEFAULT_REFINEMENT_CONFIG:RefinementConfig={
    maxPasses:3,
    qualityThreshold:0.8
}
export interface CritiqueResult{
    score:number
    issues:string[]
    suggestions:string[]
    rawResponse:string
}
export interface RefinementResult{
    originalItem:string
    finalItem:string
    finalScore:number
    passes:number
    reachedThreshold:boolean
    critiques:CritiqueResult[]
    revisions:string[]
    provider:string
    totalTokens:number
}
export const CRITIQUE_PROMPT=`You are a quality reviewer for AI training data. Evaluate the following training item and respond in JSON format:

{
  "score": 0.0-1.0,
  "issues": ["list of specific issues"],
  "suggestions": ["list of improvement suggestions"]
}

Rate based on: clarity, completeness, accuracy, format compliance, and usefulness.`
export const REVISE_PROMPT=`You are a training data editor. Revise the following training item to address the issues identified. Keep the same format but improve quality. Return only the revised item without explanation.`
export function parseCritiqueResponse(response:string):CritiqueResult{
    let parsed:{score?:number, issues?:string[], suggestions?:string[]}
    try{
        parsed=JSON.parse(response)
    }
    catch{
        let scoreMatch=response.match(/score[:\s]+([0-9.]+)/i)
        let score=scoreMatch?parseFloat(scoreMatch[1]):0.5
        return{score, issues:[], suggestions:[], rawResponse:response}
    }
    return{
        score:clampScore(parsed.score),
        issues:parsed.issues||[],
        suggestions:parsed.suggestions||[],
        rawResponse:response
    }
}
function clampScore(value: unknown): number {
    let raw = value ?? 0.5
    let numeric = typeof raw === "number" ? raw : Number(raw)
    if (isNaN(numeric)) return 0.5
    return Math.max(0, Math.min(1, numeric))
}
export async function critiqueItem(
    provider:Provider,
    item:string,
    model:string,
    options?:ProviderOptions
):Promise<CritiqueResult>{
    let prompt=`${CRITIQUE_PROMPT}\n\nTraining item to evaluate:\n${item}`
    let result=await provider.generate(prompt, model, options)
    return parseCritiqueResponse(result.text)
}
export async function reviseItem(
    provider:Provider,
    item:string,
    critique:CritiqueResult,
    model:string,
    options?:ProviderOptions
):Promise<string>{
    let prompt=`${REVISE_PROMPT}\n\nOriginal item:\n${item}\n\nIssues to fix:\n${critique.issues.join("\n")}\n\nSuggestions:\n${critique.suggestions.join("\n")}`
    let result=await provider.generate(prompt, model, options)
    return result.text.trim()
}
export async function refineItem(
    provider:Provider,
    item:string,
    model:string,
    config:RefinementConfig=DEFAULT_REFINEMENT_CONFIG
):Promise<RefinementResult>{
    let currentItem=item
    let critiques:CritiqueResult[]=[]
    let revisions:string[]=[]
    let totalTokens=0
    let finalScore=0
    let reachedThreshold=false
    let passes=0
    for(let pass=0;pass<config.maxPasses;pass++){
        passes++
        let critiquePrompt=`${CRITIQUE_PROMPT}\n\nTraining item to evaluate:\n${currentItem}`
        let critiqueResult=await provider.generate(critiquePrompt, config.critiqueModel||model, config.options)
        totalTokens+=critiqueResult.tokens
        let critique=parseCritiqueResponse(critiqueResult.text)
        critiques.push(critique)
        finalScore=critique.score
        if(critique.score>=config.qualityThreshold){
            reachedThreshold=true
            break
        }
        let revisePrompt=`${REVISE_PROMPT}\n\nOriginal item:\n${currentItem}\n\nIssues to fix:\n${critique.issues.join("\n")}\n\nSuggestions:\n${critique.suggestions.join("\n")}`
        let reviseResult=await provider.generate(revisePrompt, config.reviseModel||model, config.options)
        totalTokens+=reviseResult.tokens
        let revised=reviseResult.text.trim()
        revisions.push(revised)
        currentItem=revised
    }
    return{
        originalItem:item,
        finalItem:currentItem,
        finalScore,
        passes,
        reachedThreshold,
        critiques,
        revisions,
        provider:provider.name,
        totalTokens
    }
}
export async function refineBatch(
    provider:Provider,
    items:string[],
    model:string,
    config:RefinementConfig=DEFAULT_REFINEMENT_CONFIG
):Promise<RefinementResult[]>{
    let results:RefinementResult[]=[]
    for(let item of items){
        let result=await refineItem(provider, item, model, config)
        results.push(result)
    }
    return results
}
