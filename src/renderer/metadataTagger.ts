import type{Provider, ProviderOptions}from"./provider.js"
import type{TrainingItemMetadata}from"../types/interfaces.js"
export interface TaggingConfig{
    model:string
    options?:ProviderOptions
    enableDifficulty:boolean
    enableTopic:boolean
    enableBloom:boolean
}
export const DEFAULT_TAGGING_CONFIG:TaggingConfig={
    model:"gpt-3.5-turbo",
    enableDifficulty:true,
    enableTopic:true,
    enableBloom:true
}
export const TAGGING_PROMPT=`Analyze the following training data item and return metadata as JSON:
{
  "difficulty": "easy" | "medium" | "hard",
  "topic": "short topic name (1-3 words)",
  "bloom_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"
}

Base difficulty on: complexity of concepts, required reasoning depth, answer length.
Base topic on: the main subject matter.
Base bloom_level on: cognitive process required (remember=factual recall, understand=explain, apply=use knowledge, analyze=break down, evaluate=judge, create=new work).`
export interface ParsedTags{
    difficulty?:'easy'|'medium'|'hard'
    topic?:string
    bloomLevel?:'remember'|'understand'|'apply'|'analyze'|'evaluate'|'create'
}
export function parseTagResponse(response:string):ParsedTags{
    let parsed:{difficulty?:string, topic?:string, bloom_level?:string, bloomLevel?:string}
    try{
        parsed=JSON.parse(response)
    }
    catch{
        return{}
    }
    let result:ParsedTags={}
    if(parsed.difficulty){
        let d=parsed.difficulty.toLowerCase()
        if(d==='easy'||d==='medium'||d==='hard')result.difficulty=d
    }
    if(parsed.topic&&typeof parsed.topic==='string'){
        result.topic=parsed.topic.trim().slice(0, 100)
    }
    let bloom=parsed.bloom_level||parsed.bloomLevel
    if(bloom){
        let b=bloom.toLowerCase()
        let validLevels=['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
        if(validLevels.includes(b))result.bloomLevel=b as ParsedTags['bloomLevel']
    }
    return result
}
export function estimateDifficulty(text:string):'easy'|'medium'|'hard'{
    let length=text.length
    let sentences=(text.match(/[.!?]+/g)||[]).length
    let avgWordLength=length/Math.max(1, text.split(/\s+/).length)
    let hasCode=/```|function\s|class\s|def\s/.test(text)
    let hasMath=/\$[^$]+\$|\\frac|\\sum|\\int/.test(text)
    let score=0
    if(length>2000)score+=2
    else if(length>500)score+=1
    if(sentences>10)score+=1
    if(avgWordLength>6)score+=1
    if(hasCode)score+=1
    if(hasMath)score+=2
    if(score>=4)return'hard'
    if(score>=2)return'medium'
    return'easy'
}
export function estimateTopic(text:string):string{
    let words=text.toLowerCase().split(/[^a-z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/).filter(w=>{
        if(!w)return false
        if(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(w))return w.length>=2
        return w.length>4
    })
    let freq=new Map<string, number>()
    let stopWords=new Set(['which', 'there', 'their', 'about', 'would', 'could', 'should', 'between', 'through', 'during', 'before', 'after', 'above', 'below', 'other', 'where', 'while', 'these', 'those', 'being'])
    for(let word of words){
        if(stopWords.has(word))continue
        freq.set(word, (freq.get(word)||0)+1)
    }
    let sorted=[...freq.entries()].sort((a, b)=>b[1]-a[1])
    if(sorted.length===0)return'general'
    return sorted[0][0]
}
export function estimateBloomLevel(text:string):'remember'|'understand'|'apply'|'analyze'|'evaluate'|'create'{
    let lower=text.toLowerCase()
    if(/\b(create|design|build|develop|compose|generate|construct)\b/.test(lower))return'create'
    if(/\b(evaluate|judge|assess|critique|justify|defend|argue)\b/.test(lower))return'evaluate'
    if(/\b(analyze|compare|contrast|examine|investigate|differentiate)\b/.test(lower))return'analyze'
    if(/\b(apply|use|implement|demonstrate|solve|calculate)\b/.test(lower))return'apply'
    if(/\b(understand|explain|describe|summarize|interpret|classify)\b/.test(lower))return'understand'
    return'remember'
}
export async function tagWithModel(
    provider:Provider,
    itemText:string,
    config:TaggingConfig=DEFAULT_TAGGING_CONFIG
):Promise<ParsedTags>{
    let prompt=`${TAGGING_PROMPT}\n\nTraining item:\n${itemText}`
    let result=await provider.generate(prompt, config.model, config.options)
    return parseTagResponse(result.text)
}
export async function tagItem(
    provider:Provider|null,
    itemText:string,
    config:TaggingConfig=DEFAULT_TAGGING_CONFIG
):Promise<TrainingItemMetadata>{
    let tags:ParsedTags
    if(provider){
        try{
            tags=await tagWithModel(provider, itemText, config)
        }
        catch{
            tags={
                difficulty:estimateDifficulty(itemText),
                topic:estimateTopic(itemText),
                bloomLevel:estimateBloomLevel(itemText)
            }
        }
    }
    else{
        tags={
            difficulty:estimateDifficulty(itemText),
            topic:estimateTopic(itemText),
            bloomLevel:estimateBloomLevel(itemText)
        }
    }
    let metadata:TrainingItemMetadata={}
    if(config.enableDifficulty&&tags.difficulty)metadata.difficulty=tags.difficulty
    if(config.enableTopic&&tags.topic)metadata.topic=tags.topic
    if(config.enableBloom&&tags.bloomLevel)metadata.bloomLevel=tags.bloomLevel
    return metadata
}
export async function tagBatch(
    provider:Provider|null,
    items:string[],
    config:TaggingConfig=DEFAULT_TAGGING_CONFIG
):Promise<TrainingItemMetadata[]>{
    let results:TrainingItemMetadata[]=[]
    for(let item of items){
        let metadata=await tagItem(provider, item, config)
        results.push(metadata)
    }
    return results
}
let tagCache=new Map<string, ParsedTags>()
const TAG_CACHE_MAX=500
export function getCachedTags(itemHash:string):ParsedTags|undefined{
    return tagCache.get(itemHash)
}
export function setCachedTags(itemHash:string, tags:ParsedTags):void{
    if(tagCache.size>=TAG_CACHE_MAX){
        let firstKey=tagCache.keys().next().value
        if(firstKey!==undefined)tagCache.delete(firstKey)
    }
    tagCache.set(itemHash, tags)
}
export function clearTagCache():void{
    tagCache.clear()
}
