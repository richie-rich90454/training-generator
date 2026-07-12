export interface ChunkCharacteristics{
    length:number
    hasCode:boolean
    hasMath:boolean
    hasTable:boolean
    language:string
    isMultilingual:boolean
    estimatedComplexity:'easy'|'medium'|'hard'
}
export interface ModelCandidate{
    providerId:string
    model:string
    contextWindow:number
    strengths:('code'|'math'|'multilingual'|'reasoning'|'speed'|'general')[]
    costPer1kTokens?:number
}
export interface SelectionResult{
    providerId:string
    model:string
    reason:string
    alternatives:{providerId:string, model:string}[]
}
export type ProcessingType='instruction'|'conversation'|'chunking'|'custom'|'cot'|'tot'
export function analyzeChunk(text:string):ChunkCharacteristics{
    let length=text.length
    let hasCode=/```|`[^`]+`|function\s|class\s|def\s|import\s|require\(/.test(text)
    let hasMath=/\$[^$]+\$/gi.test(text)||/\\frac|\\sum|\\int|\\sqrt/.test(text)
    let hasTable=/\|.*\|.*\|/.test(text)&&/\|[-:\s]+\|/.test(text)
    let cjkCount=(text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g)||[]).length
    let isMultilingual=cjkCount>0&&/[a-zA-Z]/.test(text)
    let language='en'
    if(/[\u4e00-\u9fff]/.test(text))language='zh'
    else if(/[\u3040-\u309f\u30a0-\u30ff]/.test(text))language='ja'
    else if(/[\uac00-\ud7af]/.test(text))language='ko'
    let estimatedComplexity:'easy'|'medium'|'hard'='easy'
    if(length>5000||hasMath||hasCode)estimatedComplexity='hard'
    else if(length>2000||hasTable)estimatedComplexity='medium'
    return{length, hasCode, hasMath, hasTable, language, isMultilingual, estimatedComplexity}
}
export function selectModel(
    candidates:ModelCandidate[],
    processingType:ProcessingType,
    chunk:ChunkCharacteristics
):SelectionResult{
    if(candidates.length===0){
        return{
            providerId:"fallback",
            model:"fallback-model",
            reason:"No model candidates provided, using fallback",
            alternatives:[]
        }
    }
    let scored=candidates.map(c=>{
        let score=0
        let reasons:string[]=[]
        if(chunk.length>c.contextWindow*0.8){
            score-=100
            reasons.push("context window too small")
        }
        else{
            score+=10
            reasons.push("fits context window")
        }
        if(chunk.hasCode&&c.strengths.includes('code')){
            score+=30
            reasons.push("strong at code")
        }
        if(chunk.hasMath&&c.strengths.includes('math')){
            score+=30
            reasons.push("strong at math")
        }
        if(chunk.isMultilingual&&c.strengths.includes('multilingual')){
            score+=25
            reasons.push("multilingual capable")
        }
        if(processingType==='cot'||processingType==='tot'){
            if(c.strengths.includes('reasoning')){
                score+=40
                reasons.push("strong reasoning")
            }
        }
        if(processingType==='chunking'){
            if(c.strengths.includes('speed')){
                score+=20
                reasons.push("fast for chunking")
            }
        }
        if(chunk.estimatedComplexity==='hard'&&c.strengths.includes('reasoning')){
            score+=15
            reasons.push("reasoning for hard chunk")
        }
        if(c.costPer1kTokens!==undefined){
            score-=Math.min(c.costPer1kTokens*5, 20)
            reasons.push(`cost $${c.costPer1kTokens}/1k`)
        }
        if(c.strengths.includes('general')){
            score+=5
            reasons.push("general purpose")
        }
        return{candidate:c, score, reason:reasons.join(", ")}
    })
    scored.sort((a,b)=>b.score-a.score)
    let best=scored[0]
    let alternatives=scored.slice(1, 3).map(s=>({providerId:s.candidate.providerId, model:s.candidate.model}))
    return{
        providerId:best.candidate.providerId,
        model:best.candidate.model,
        reason:`${best.candidate.model}: ${best.reason} (score ${best.score})`,
        alternatives
    }
}
