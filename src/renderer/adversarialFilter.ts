import type{Provider, ProviderOptions}from"./provider.js"
export interface AdversarialConfig{
    model:string
    threshold:number
    options?:ProviderOptions
    dropBelowThreshold:boolean
    minItems?:number
    keepTopN?:number
}
export const DEFAULT_ADVERSARIAL_CONFIG:AdversarialConfig={
    model:"gpt-3.5-turbo",
    threshold:0.5,
    dropBelowThreshold:true
}
export interface GradeResult{
    score:number
    reason:string
    issues:string[]
    rawResponse:string
}
export interface FilterResult{
    accepted:boolean
    grade:GradeResult
    item:string
    filteredOut:boolean
}
export interface BatchFilterResult{
    accepted:FilterResult[]
    rejected:FilterResult[]
    acceptanceRate:number
    averageScore:number
    filterRate:number
}
export const GRADING_PROMPT=`You are a strict quality grader for AI training data. Grade the following training item on a scale of 0.0 to 1.0. Respond in JSON format:

{
  "score": 0.0-1.0,
  "reason": "brief explanation",
  "issues": ["list of specific problems"]
}

Grade based on:
- 0.9-1.0: Excellent quality, clear, accurate, well-formatted
- 0.7-0.8: Good quality, minor issues
- 0.5-0.6: Acceptable but has notable problems
- 0.3-0.4: Poor quality, significant issues
- 0.0-0.2: Unusable, contains errors or harmful content`
export function parseGradeResponse(response:string):GradeResult{
    let parsed:{score?:number, reason?:string, issues?:string[]}
    try{
        parsed=JSON.parse(response)
    }
    catch{
        let scoreMatch=response.match(/score[:\s]+([0-9.]+)/i)
        let score=scoreMatch?parseFloat(scoreMatch[1]):0.5
        return{score, reason:"parsed from text", issues:[], rawResponse:response}
    }
    let score=Number(parsed.score)
    if(isNaN(score))score=0.5
    score=Math.max(0, Math.min(1, score))
    let reason=typeof parsed.reason==="string"?parsed.reason:""
    let issues=Array.isArray(parsed.issues)?parsed.issues.filter((i:unknown)=>typeof i==="string"):[]
    return{
        score,
        reason,
        issues,
        rawResponse:response
    }
}
export async function gradeItem(
    provider:Provider,
    item:string,
    config:AdversarialConfig=DEFAULT_ADVERSARIAL_CONFIG
):Promise<GradeResult>{
    let prompt=`${GRADING_PROMPT}\n\nTraining item to grade:\n${item}`
    let result=await provider.generate(prompt, config.model, config.options)
    return parseGradeResponse(result.text)
}
export async function filterItem(
    provider:Provider,
    item:string,
    config:AdversarialConfig=DEFAULT_ADVERSARIAL_CONFIG
):Promise<FilterResult>{
    let grade=await gradeItem(provider, item, config)
    let accepted=grade.score>=config.threshold
    return{
        accepted,
        grade,
        item,
        filteredOut:!accepted&&config.dropBelowThreshold
    }
}
export async function filterBatch(
    provider:Provider,
    items:string[],
    config:AdversarialConfig=DEFAULT_ADVERSARIAL_CONFIG
):Promise<BatchFilterResult>{
    let results:FilterResult[]=[]
    for(let item of items){
        let result=await filterItem(provider, item, config)
        results.push(result)
    }
    let accepted=results.filter(r=>r.accepted)
    let rejected=results.filter(r=>!r.accepted)
    let minTarget=Math.max(config.minItems??0, config.keepTopN??0)
    if(minTarget>0&&accepted.length<minTarget&&rejected.length>0){
        let sortedRejected=[...rejected].sort((a, b)=>b.grade.score-a.grade.score)
        while(accepted.length<minTarget&&sortedRejected.length>0){
            let promoted=sortedRejected.shift()!
            promoted.accepted=true
            promoted.filteredOut=false
            accepted.push(promoted)
        }
        rejected=results.filter(r=>!r.accepted)
    }
    let totalScore=results.reduce((sum, r)=>sum+r.grade.score, 0)
    let acceptanceRate=results.length>0?accepted.length/results.length:0
    let averageScore=results.length>0?totalScore/results.length:0
    let filterRate=results.length>0?rejected.length/results.length:0
    return{
        accepted,
        rejected,
        acceptanceRate,
        averageScore,
        filterRate
    }
}
export function summarizeGrades(results:FilterResult[]):{
    count:number
    mean:number
    median:number
    min:number
    max:number
    stdDev:number
}{
    if(results.length===0){
        return{count:0, mean:0, median:0, min:0, max:0, stdDev:0}
    }
    let scores=results.map(r=>r.grade.score).sort((a, b)=>a-b)
    let sum=scores.reduce((a, b)=>a+b, 0)
    let mean=sum/scores.length
    let median=scores.length%2===0?(scores[scores.length/2-1]+scores[scores.length/2])/2:scores[Math.floor(scores.length/2)]
    let min=scores[0]
    let max=scores[scores.length-1]
    let variance=scores.reduce((sum, s)=>sum+(s-mean)**2, 0)/scores.length
    let stdDev=Math.sqrt(variance)
    return{count:scores.length, mean, median, min, max, stdDev}
}
