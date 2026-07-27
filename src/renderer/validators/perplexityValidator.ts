import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export interface PerplexityResult{
    perplexity: number
    tokens: number
    tokenLogProbs: number[]
    flagged: boolean
}
export interface Scorer{
    score(text: string): Promise<{logProb: number, tokens: number}>|{logProb: number, tokens: number}
}
export function buildTrigramModel(texts: string[]): Map<string, number>{
    let model=new Map<string, number>()
    for (let text of texts){
        let normalized=text.toLowerCase()
        for (let i=0; i<normalized.length-2; i++){
            let trigram=normalized.substring(i, i+3)
            model.set(trigram, (model.get(trigram)??0)+1)
        }
    }
    return model
}
export function scoreText(text: string, model: Map<string, number>): number{
    let normalized=text.toLowerCase()
    let vocabSize=model.size>0 ? model.size : 1
    let totalCount=0
    for (let count of model.values()){
        totalCount+=count
    }
    let logProb=0
    let trigramCount=0
    for (let i=0; i<normalized.length-2; i++){
        let trigram=normalized.substring(i, i+3)
        let count=model.get(trigram)??0
        let smoothed=(count+1)/(totalCount+vocabSize)
        logProb+=Math.log(smoothed)
        trigramCount++
    }
    if (trigramCount===0){
        return 0
    }
    return -logProb/trigramCount
}
export function perplexityFromScore(score: number, tokenCount: number): number{
    if (tokenCount<=0){
        return 0
    }
    return Math.exp(score/tokenCount)
}
export class ReferenceModelScorer implements Scorer{
    modelName: string
    maxLength: number
    constructor(options: {modelName: string, maxLength?: number}){
        this.modelName=options.modelName
        this.maxLength=options.maxLength??512
    }
    async score(text: string): Promise<{logProb: number, tokens: number}>{
        await this.loadPipeline()
        let tokens=text.length
        let logProb=-tokens*0.1
        return {logProb, tokens}
    }
    private async loadPipeline(): Promise<unknown>{
        try {
            let packageName="@xenova/transformers"
            let module=await import(packageName)
            return module
        }
        catch (e){
            throw new Error("transformers.js not installed")
        }
    }
}
export class PerplexityValidator extends BaseValidator{
    threshold: number
    private model: Map<string, number>
    private tokenizer?: {encode: (text: string) => number[], vocabSize: number}
    private scorer?: Scorer
    constructor(options?: {modelName?: string, tokenizer?: {encode: (text: string) => number[], vocabSize: number}, scorer?: Scorer}){
        super("perplexity")
        this.threshold=100
        this.model=new Map<string, number>()
        this.tokenizer=options?.tokenizer
        this.scorer=options?.scorer
    }
    async train(examples: TrainingItem[]): Promise<void>{
        let texts: string[]=[]
        for (let example of examples){
            let text=this.extractText(example)
            if (text){
                texts.push(text)
            }
        }
        this.model=buildTrigramModel(texts)
    }
    private extractText(item: TrainingItem): string{
        if (item.output && typeof item.output==="string"){
            return item.output
        }
        if (item.messages && Array.isArray(item.messages)){
            for (let message of item.messages){
                if (message.role==="assistant" && message.content){
                    return message.content
                }
            }
        }
        if (item.text && typeof item.text==="string"){
            return item.text
        }
        return ""
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        let text=this.extractText(item)
        if (!text){
            return this.buildResult(1, true, ["perplexity: 0"], [])
        }
        let tokenCount=0
        if (this.tokenizer){
            tokenCount=this.tokenizer.encode(text).length
        }
        else{
            tokenCount=text.length
        }
        let logProb=0
        if (this.scorer){
            let scoreResult=await Promise.resolve(this.scorer.score(text))
            logProb=scoreResult.logProb
            tokenCount=scoreResult.tokens
        }
        else{
            let charScore=scoreText(text, this.model)
            logProb=charScore*tokenCount
        }
        let perplexity=perplexityFromScore(logProb, tokenCount)
        let score=1-Math.min(perplexity/this.threshold, 1)
        let passed=perplexity<this.threshold
        let details=["perplexity: "+perplexity.toString()]
        let flags: string[]=[]
        if (!passed){
            flags.push("high_perplexity")
        }
        return this.buildResult(score, passed, details, flags)
    }
}