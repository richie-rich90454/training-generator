import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export type ToxicityLabel="identity_attack"|"insult"|"obscene"|"severe_toxicity"|"sexual_explicit"|"threat"|"toxicity"
export interface ToxicityPrediction{
    label: ToxicityLabel
    match: boolean
    probability: number
}
export interface ToxicityScorer{
    classify(texts: string[]): Promise<ToxicityPrediction[][]>
}
export const DEFAULT_TOXICITY_WORDS: Record<ToxicityLabel, string[]>={
    identity_attack: ["racist", "sexist", "homophobic"],
    insult: ["idiot", "stupid", "moron"],
    obscene: ["f***", "s***", "a**", "damn", "hell"],
    severe_toxicity: ["kill yourself", "die", "worthless"],
    sexual_explicit: ["sex", "porn", "nude"],
    threat: ["kill", "hurt", "attack"],
    toxicity: ["hate", " garbage", "trash"]
}
export class RuleBasedToxicityScorer implements ToxicityScorer{
    private wordLists: Record<ToxicityLabel, string[]>
    constructor(options?: {wordLists?: Record<ToxicityLabel, string[]>}){
        this.wordLists=options?.wordLists??DEFAULT_TOXICITY_WORDS
    }
    classify(texts: string[]): Promise<ToxicityPrediction[][]>{
        let results: ToxicityPrediction[][]=[]
        for (let text of texts){
            let predictions: ToxicityPrediction[]=[]
            for (let label in this.wordLists){
                let words=this.wordLists[label as ToxicityLabel]
                let match=false
                for (let word of words){
                    let pattern=this.buildPattern(word)
                    let regex=new RegExp(pattern, "i")
                    if (regex.test(text)){
                        match=true
                        break
                    }
                }
                predictions.push({label: label as ToxicityLabel, match, probability: match?1:0})
            }
            results.push(predictions)
        }
        return Promise.resolve(results)
    }
    private buildPattern(word: string): string{
        let trimmed=word.trim()
        let escaped=this.escapeRegExp(trimmed)
        let prefix=/^\w/.test(trimmed)?"\\b":""
        let suffix=/\w$/.test(trimmed)?"\\b":""
        return prefix+escaped+suffix
    }
    private escapeRegExp(text: string): string{
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
}
export class TensorFlowToxicityScorer implements ToxicityScorer{
    private threshold: number
    constructor(options?: {threshold?: number}){
        this.threshold=options?.threshold??0.5
    }
    async classify(texts: string[]): Promise<ToxicityPrediction[][]>{
        let toxicityModule: unknown
        let moduleName="@tensorflow-models/toxicity"
        try{
            toxicityModule=await import(moduleName)
        }
        catch{
            throw new Error("@tensorflow-models/toxicity not installed")
        }
        let module=toxicityModule as {load: (threshold: number) => Promise<{classify: (texts: string[]) => Promise<Array<{label: string; match: boolean; prob: number}[]>>}>}
        let model=await module.load(this.threshold)
        let predictions=await model.classify(texts)
        return predictions.map((textPredictions) => textPredictions.map((p) => ({label: p.label as ToxicityLabel, match: p.match, probability: p.prob})))
    }
}
export class ToxicityValidator extends BaseValidator{
    private scorer: ToxicityScorer
    private labels: ToxicityLabel[]
    constructor(options?: {scorer?: ToxicityScorer; labels?: ToxicityLabel[]; threshold?: number}){
        super("toxicity", { threshold: options?.threshold })
        this.scorer=options?.scorer??new RuleBasedToxicityScorer()
        this.labels=options?.labels??(Object.keys(DEFAULT_TOXICITY_WORDS) as ToxicityLabel[])
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
        let predictions=(await this.scorer.classify([text]))[0]
        let labelProbs: Partial<Record<ToxicityLabel, number>>={}
        let overallToxicity=0
        let flags: string[]=[]
        for (let prediction of predictions){
            if (!this.labels.includes(prediction.label)){
                continue
            }
            labelProbs[prediction.label]=prediction.probability
            if (prediction.probability>overallToxicity){
                overallToxicity=prediction.probability
            }
            if (prediction.match){
                flags.push(prediction.label)
            }
        }
        let score=1-overallToxicity
        let passed=overallToxicity<this.threshold
        let details: string[]=[]
        for (let label in labelProbs){
            let prob=labelProbs[label as ToxicityLabel]
            if (prob!==undefined){
                details.push(label+": "+prob.toFixed(2))
            }
        }
        return this.buildResult(score, passed, details, flags)
    }
}
