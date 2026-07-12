import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
import type{GradeResult}from"./adversarialFilter.js"
import{parseGradeResponse, GRADING_PROMPT}from"./adversarialFilter.js"
export interface RegenerationConfig{
    maxAttempts:number
    qualityThreshold:number
    temperatureAdjustment:number
    fallbackModel?:string
    options?:ProviderOptions
}
export const DEFAULT_REGENERATION_CONFIG:RegenerationConfig={
    maxAttempts:2,
    qualityThreshold:0.7,
    temperatureAdjustment:0.1
}
export interface RegenerationResult{
    originalItem:string
    originalGrade:GradeResult
    finalItem:string
    finalGrade:GradeResult
    attempts:number
    regenerated:boolean
    allAttempts:{item:string, grade:GradeResult, attempt:number}[]
}
export interface BatchRegenerationResult{
    regenerated:RegenerationResult[]
    kept:RegenerationResult[]
    totalItems:number
    regeneratedCount:number
    keptCount:number
    averageOriginalScore:number
    averageFinalScore:number
    scoreImprovement:number
}
export async function gradeItemLocal(
    provider:Provider,
    item:string,
    model:string,
    options?:ProviderOptions
):Promise<GradeResult>{
    let prompt=`${GRADING_PROMPT}\n\nTraining item to grade:\n${item}`
    let result=await provider.generate(prompt, model, options)
    return parseGradeResponse(result.text)
}
export async function regenerateItem(
    provider:Provider,
    originalPrompt:string,
    model:string,
    config:RegenerationConfig,
    currentGrade:GradeResult,
    attempt:number
):Promise<ProviderResult>{
    let adjustedTemp=(config.options?.temperature??0.7)+config.temperatureAdjustment*attempt
    adjustedTemp=Math.min(1.0, Math.max(0.0, adjustedTemp))
    let options:ProviderOptions={
        ...config.options,
        temperature:adjustedTemp
    }
    let regeneratePrompt=`The following output was graded ${currentGrade.score.toFixed(2)}/1.0 and needs improvement.\nIssues: ${currentGrade.issues.join(", ")}\n\nOriginal prompt:\n${originalPrompt}\n\nGenerate an improved response that addresses the issues. Return only the improved training item.`
    let useModel=config.fallbackModel||model
    return provider.generate(regeneratePrompt, useModel, options)
}
export async function autoRegenerate(
    provider:Provider,
    item:string,
    originalPrompt:string,
    model:string,
    config:RegenerationConfig=DEFAULT_REGENERATION_CONFIG
):Promise<RegenerationResult>{
    let originalGrade=await gradeItemLocal(provider, item, model, config.options)
    if(originalGrade.score>=config.qualityThreshold){
        return{
            originalItem:item,
            originalGrade,
            finalItem:item,
            finalGrade:originalGrade,
            attempts:0,
            regenerated:false,
            allAttempts:[{item, grade:originalGrade, attempt:0}]
        }
    }
    let allAttempts:{item:string, grade:GradeResult, attempt:number}[]=[{item, grade:originalGrade, attempt:0}]
    let currentItem=item
    let currentGrade=originalGrade
    let seenItems=new Set<string>([item])
    for(let attempt=1;attempt<=config.maxAttempts;attempt++){
        try{
            let result=await regenerateItem(provider, originalPrompt, model, config, currentGrade, attempt)
            let newItem=result.text.trim()
            if(seenItems.has(newItem)){
                continue
            }
            seenItems.add(newItem)
            let newGrade=await gradeItemLocal(provider, newItem, model, config.options)
            allAttempts.push({item:newItem, grade:newGrade, attempt})
            if(newGrade.score>currentGrade.score){
                currentItem=newItem
                currentGrade=newGrade
            }
            if(currentGrade.score>=config.qualityThreshold){
                break
            }
        }
        catch(error){
            console.warn(`autoRegenerate: attempt ${attempt} failed:`, (error as Error).message)
        }
    }
    return{
        originalItem:item,
        originalGrade,
        finalItem:currentItem,
        finalGrade:currentGrade,
        attempts:allAttempts.length-1,
        regenerated:currentGrade.score>originalGrade.score,
        allAttempts
    }
}
export async function autoRegenerateBatch(
    provider:Provider,
    items:string[],
    originalPrompt:string,
    model:string,
    config:RegenerationConfig=DEFAULT_REGENERATION_CONFIG
):Promise<BatchRegenerationResult>{
    let results:RegenerationResult[]=[]
    for(let item of items){
        let result=await autoRegenerate(provider, item, originalPrompt, model, config)
        results.push(result)
    }
    let regenerated=results.filter(r=>r.regenerated)
    let kept=results.filter(r=>!r.regenerated)
    let totalOriginalScore=results.reduce((sum, r)=>sum+r.originalGrade.score, 0)
    let totalFinalScore=results.reduce((sum, r)=>sum+r.finalGrade.score, 0)
    let count=results.length
    return{
        regenerated,
        kept,
        totalItems:count,
        regeneratedCount:regenerated.length,
        keptCount:kept.length,
        averageOriginalScore:count>0?totalOriginalScore/count:0,
        averageFinalScore:count>0?totalFinalScore/count:0,
        scoreImprovement:count>0?(totalFinalScore-totalOriginalScore)/count:0
    }
}
