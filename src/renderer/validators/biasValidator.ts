import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export type BiasCategory="gender"|"racial"|"political"|"religious"|"age"|"socioeconomic"
export interface BiasTerm{
    term: string
    category: BiasCategory
    severity: "low"|"medium"|"high"
    suggestion?: string
}
export interface BiasResult{
    categories: Partial<Record<BiasCategory, {count: number, terms: string[], score: number}>>
    totalFlags: number
    score: number
}
export const DEFAULT_BIAS_TERMS: BiasTerm[]=[
    {term: "fireman", category: "gender", severity: "medium", suggestion: "firefighter"},
    {term: "policeman", category: "gender", severity: "medium", suggestion: "police officer"},
    {term: "chairman", category: "gender", severity: "low", suggestion: "chairperson"},
    {term: "mankind", category: "gender", severity: "low", suggestion: "humankind"},
    {term: "blacklist", category: "racial", severity: "medium", suggestion: "blocklist"},
    {term: "whitelist", category: "racial", severity: "medium", suggestion: "allowlist"},
    {term: "master/slave", category: "racial", severity: "high", suggestion: "primary/replica"},
    {term: "libtard", category: "political", severity: "high", suggestion: "avoid political slurs"},
    {term: "trumpanzee", category: "political", severity: "high", suggestion: "avoid political slurs"},
    {term: "snowflake", category: "political", severity: "low", suggestion: "avoid political insults"},
    {term: "infidel", category: "religious", severity: "high", suggestion: "avoid religious labels"},
    {term: "heathen", category: "religious", severity: "medium", suggestion: "avoid religious labels"},
    {term: "heretic", category: "religious", severity: "medium", suggestion: "avoid religious labels"},
    {term: "old fart", category: "age", severity: "low", suggestion: "older person"},
    {term: "millennial", category: "age", severity: "low", suggestion: "avoid age stereotypes"},
    {term: "boomer", category: "age", severity: "low", suggestion: "avoid age stereotypes"},
    {term: "ghetto", category: "socioeconomic", severity: "medium", suggestion: "low-income neighborhood"},
    {term: "trailer trash", category: "socioeconomic", severity: "high", suggestion: "avoid classist slurs"},
    {term: "redneck", category: "socioeconomic", severity: "medium", suggestion: "avoid classist slurs"}
]
function escapeRegExp(text: string): string{
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
export class BiasValidator extends BaseValidator{
    private terms: BiasTerm[]
    private caseSensitive: boolean
    private wholeWord: boolean
    private matchers: Map<BiasCategory, RegExp[]>
    constructor(options?: {terms?: BiasTerm[], caseSensitive?: boolean, wholeWord?: boolean}){
        super("bias")
        this.terms=options?.terms??DEFAULT_BIAS_TERMS
        this.caseSensitive=options?.caseSensitive??false
        this.wholeWord=options?.wholeWord??false
        this.threshold=0.5
        this.matchers=this.buildMatcher(this.terms)
    }
    buildMatcher(terms: BiasTerm[]): Map<BiasCategory, RegExp[]>{
        let matchers=new Map<BiasCategory, RegExp[]>()
        for (let term of terms){
            let escaped=escapeRegExp(term.term)
            let pattern=this.wholeWord?"\\b"+escaped+"\\b":escaped
            let flags=this.caseSensitive?"g":"gi"
            let regex=new RegExp(pattern, flags)
            let list=matchers.get(term.category)
            if (!list){
                list=[]
                matchers.set(term.category, list)
            }
            list.push(regex)
        }
        return matchers
    }
    extractText(item: TrainingItem): string{
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
    analyze(text: string): BiasResult{
        let categories: BiasResult["categories"]={}
        let totalFlags=0
        for (let [category, regexes] of this.matchers){
            let foundTerms: string[]=[]
            for (let i=0; i<regexes.length; i++){
                let regex=regexes[i]
                let matches=text.matchAll(regex)
                for (let match of matches){
                    foundTerms.push(match[0].toLowerCase())
                }
            }
            if (foundTerms.length>0){
                let count=foundTerms.length
                totalFlags+=count
                categories[category]={
                    count,
                    terms: foundTerms,
                    score: Math.max(0, 1-count*0.1)
                }
            }
        }
        let score=Math.max(0, 1-totalFlags*0.1)
        return {categories, totalFlags, score}
    }
    validate(item: TrainingItem): ValidationResult{
        let text=this.extractText(item)
        let biasResult=this.analyze(text)
        let passed=biasResult.score>=this.threshold
        let details: string[]=[]
        for (let category in biasResult.categories){
            let entry=biasResult.categories[category as BiasCategory]
            if (entry){
                details.push(category+": "+entry.count)
            }
        }
        let flags: string[]=[]
        for (let category in biasResult.categories){
            let entry=biasResult.categories[category as BiasCategory]
            if (entry){
                for (let term of entry.terms){
                    flags.push(category+"|"+term)
                }
            }
        }
        return this.buildResult(biasResult.score, passed, details, flags)
    }
}
export function suggestAlternative(term: BiasTerm): string{
    return term.suggestion??""
}
export function exportBiasReport(items: TrainingItem[], validator: BiasValidator): BiasResult{
    let categories: BiasResult["categories"]={}
    let totalFlags=0
    let totalScore=0
    for (let item of items){
        let text=validator.extractText(item)
        let result=validator.analyze(text)
        totalScore+=result.score
        totalFlags+=result.totalFlags
        for (let category in result.categories){
            let key=category as BiasCategory
            let entry=result.categories[key]
            if (!entry){
                continue
            }
            let existing=categories[key]
            if (!existing){
                categories[key]={
                    count: entry.count,
                    terms: [...entry.terms],
                    score: entry.score
                }
            }
            else{
                existing.count+=entry.count
                for (let term of entry.terms){
                    existing.terms.push(term)
                }
                existing.score=Math.max(0, 1-existing.count*0.1)
            }
        }
    }
    let score=items.length>0?totalScore/items.length:1
    return {categories, totalFlags, score}
}
