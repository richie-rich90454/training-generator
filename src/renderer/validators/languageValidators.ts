import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export const COMMON_STOPWORDS: string[]=[
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to",
    "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why", "how",
    "all", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just", "and",
    "but", "or", "yet", "because", "although", "though", "while", "whereas", "if",
    "unless", "until", "what", "which", "who", "whom", "whose", "this", "that",
    "these", "those", "i", "me", "my", "myself", "we", "us", "our", "ours",
    "you", "your", "yours", "he", "him", "his", "she", "her", "hers", "it",
    "its", "they", "them", "their", "theirs"
]
function extractText(item: TrainingItem): string{
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
function extractQuestion(item: TrainingItem): string{
    let parts: string[]=[]
    if (item.instruction && typeof item.instruction==="string"){
        parts.push(item.instruction)
    }
    if (item.input && typeof item.input==="string"){
        parts.push(item.input)
    }
    if (parts.length>0){
        return parts.join(" ")
    }
    if (item.messages && Array.isArray(item.messages)){
        for (let i=item.messages.length-1; i>=0; i--){
            let message=item.messages[i]
            if (message.role==="user" && message.content){
                return message.content
            }
        }
    }
    return ""
}
function tokenizeWords(text: string): string[]{
    return text.toLowerCase().match(/\b[a-z]+\b/g)??[]
}
function extractKeywords(text: string): string[]{
    let words=tokenizeWords(text)
    return words.filter(word => !COMMON_STOPWORDS.includes(word))
}
function countSyllables(word: string): number{
    let groups=word.toLowerCase().match(/[aeiouy]+/g)
    if (!groups || groups.length===0){
        return 1
    }
    return groups.length
}
export class GrammarValidator extends BaseValidator{
    constructor(options?: {enabled?: boolean; threshold?: number}){
        super("grammar", options)
        this.threshold=options?.threshold??0.8
    }
    validate(item: TrainingItem): ValidationResult{
        let text=extractText(item)
        let issueCount=0
        let flags: string[]=[]
        let doubleSpaceMatches=text.match(/ {2,}/g)
        if (doubleSpaceMatches && doubleSpaceMatches.length>0){
            issueCount+=doubleSpaceMatches.length
            if (!flags.includes("double_spaces")){
                flags.push("double_spaces")
            }
        }
        let repeatedMatches=text.match(/\b(\w+)\s+\1\b/gi)
        if (repeatedMatches && repeatedMatches.length>0){
            issueCount+=repeatedMatches.length
            if (!flags.includes("repeated_words")){
                flags.push("repeated_words")
            }
        }
        let missingCapitalMatches=text.match(/\.\s+[a-z]/g)
        if (missingCapitalMatches && missingCapitalMatches.length>0){
            issueCount+=missingCapitalMatches.length
            if (!flags.includes("missing_capitalization")){
                flags.push("missing_capitalization")
            }
        }
        let confusableMatches=text.match(/\b(their|there|they're|your|you're|its|it's)\b/gi)
        if (confusableMatches && confusableMatches.length>0){
            issueCount+=confusableMatches.length
            if (!flags.includes("confusables")){
                flags.push("confusables")
            }
        }
        let score=Math.max(0, 1-issueCount*0.05)
        let passed=score>=this.threshold
        return this.buildResult(score, passed, [], flags)
    }
}
export class ReadingLevelValidator extends BaseValidator{
    constructor(options?: {enabled?: boolean; threshold?: number}){
        super("reading-level", options)
        this.threshold=options?.threshold??0.5
    }
    validate(item: TrainingItem): ValidationResult{
        let text=extractText(item)
        let sentenceMatches=text.match(/[.!?]/g)
        let sentences=sentenceMatches?sentenceMatches.length:0
        let words=text.split(/\s+/).filter(w => w.length>0)
        let wordCount=words.length
        if (sentences===0){
            sentences=1
        }
        if (wordCount===0){
            let score=0
            return this.buildResult(score, score>=this.threshold, ["flesch: 0"], [])
        }
        let syllables=0
        for (let word of words){
            syllables+=countSyllables(word)
        }
        let flesch=206.835-1.015*(wordCount/sentences)-84.6*(syllables/wordCount)
        let score=Math.min(Math.max((flesch-0)/100, 0), 1)
        let passed=score>=this.threshold
        return this.buildResult(score, passed, ["flesch: "+Math.round(flesch*100)/100], [])
    }
}
export class CoverageValidator extends BaseValidator{
    private sourceText: string
    constructor(options: {sourceText: string; enabled?: boolean; threshold?: number}){
        super("coverage", options)
        this.sourceText=options.sourceText
        this.threshold=options.threshold??0.5
    }
    validate(item: TrainingItem): ValidationResult{
        let answerText=extractText(item)
        let sourceKeywords=extractKeywords(this.sourceText)
        let answerKeywords=extractKeywords(answerText)
        let sourceSet=new Set<string>(sourceKeywords)
        let answerSet=new Set<string>(answerKeywords)
        if (sourceSet.size===0){
            let score=answerSet.size>0?1:0
            let passed=score>=this.threshold
            return this.buildResult(score, passed, ["coverage: "+Math.round(score*100)/100], [])
        }
        let matched=0
        for (let keyword of sourceSet){
            if (answerSet.has(keyword)){
                matched++
            }
        }
        let coverageRatio=matched/sourceSet.size
        let score=Math.min(coverageRatio*1.5, 1)
        let passed=score>=this.threshold
        return this.buildResult(score, passed, ["coverage: "+Math.round(score*100)/100], [])
    }
}
export class CompletenessValidator extends BaseValidator{
    constructor(options?: {enabled?: boolean; threshold?: number}){
        super("completeness", options)
        this.threshold=options?.threshold??0.5
    }
    validate(item: TrainingItem): ValidationResult{
        let question=extractQuestion(item)
        let answerText=extractText(item)
        let questionKeywords=extractKeywords(question)
        let answerKeywords=extractKeywords(answerText)
        let answerLower=answerText.toLowerCase()
        if (questionKeywords.length===0){
            let score=answerText.length>0?1:0
            let passed=score>=this.threshold
            return this.buildResult(score, passed, ["completeness: "+Math.round(score*100)/100], [])
        }
        let matched=0
        for (let term of questionKeywords){
            if (answerLower.includes(term)){
                matched++
            }
            else{
                for (let answerWord of answerKeywords){
                    if (answerWord.includes(term) || term.includes(answerWord)){
                        matched++
                        break
                    }
                }
            }
        }
        let score=matched/questionKeywords.length
        let passed=score>=this.threshold
        return this.buildResult(score, passed, ["completeness: "+Math.round(score*100)/100], [])
    }
}
export class AmbiguityValidator extends BaseValidator{
    constructor(options?: {enabled?: boolean; threshold?: number}){
        super("ambiguity", options)
        this.threshold=options?.threshold??0.7
    }
    validate(item: TrainingItem): ValidationResult{
        let text=extractText(item)
        let flags: string[]=[]
        let words=text.split(/\s+/).filter(w => w.length>0)
        let wordCount=words.length
        let vagueMatches=text.match(/\b(it|this|that|they)\b/gi)
        let vagueCount=vagueMatches?vagueMatches.length:0
        let vagueDensity=wordCount>0?(vagueCount/wordCount)*100:0
        if (vagueDensity>2){
            flags.push("vague_pronouns")
        }
        let passiveMatches=text.match(/\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi)
        let passiveCount=passiveMatches?passiveMatches.length:0
        if (passiveCount>0){
            flags.push("passive_voice")
        }
        let score=Math.max(0, 1-(vagueDensity*0.05+passiveCount*0.02))
        let passed=score>=this.threshold
        return this.buildResult(score, passed, [], flags)
    }
}
