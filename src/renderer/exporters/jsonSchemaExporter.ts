import type { TrainingItem } from "../../types/index.js"
import { Exporter, ExportOptions } from "../exportFormats.js"
export interface SplitConfig{
    trainRatio: number
    valRatio: number
    testRatio: number
    seed?: number
}
export function mulberry32(seed: number): ()=>number{
    let state=seed>>>0
    return ()=>{
        state=(state+0x6D2B79F5)>>>0
        let t=state
        t=Math.imul(t^(t>>>15), t|1)>>>0
        t^=t+Math.imul(t^(t>>>7), t|61)>>>0
        return ((t^(t>>>14))>>>0)/4294967296
    }
}
export function shuffleArray<T>(array: T[], rng: ()=>number): T[]{
    let result=[...array]
    for(let i=result.length-1; i>0; i--){
        let j=Math.floor(rng()*(i+1))
        let temp=result[i]
        result[i]=result[j]
        result[j]=temp
    }
    return result
}
export function splitItems(items: TrainingItem[], config: SplitConfig): {train: TrainingItem[], validation: TrainingItem[], test: TrainingItem[]}{
    let totalRatio=config.trainRatio+config.valRatio+config.testRatio
    if(Math.abs(totalRatio-1)>1e-9){
        throw new Error("Split ratios must sum to 1")
    }
    let seed=config.seed??42
    let rng=mulberry32(seed)
    let shuffled=shuffleArray(items, rng)
    let total=shuffled.length
    let trainCount=Math.floor(total*config.trainRatio)
    let valCount=Math.floor(total*config.valRatio)
    let testCount=Math.floor(total*config.testRatio)
    let remainder=total-(trainCount+valCount+testCount)
    trainCount+=remainder
    let train=shuffled.slice(0, trainCount)
    let validation=shuffled.slice(trainCount, trainCount+valCount)
    let test=shuffled.slice(trainCount+valCount)
    return {train, validation, test}
}
export function generateJsonSchema(items: TrainingItem[]): object{
    if(items.length===0){
        return { type: "object", properties: {} }
    }
    let item=items[0]
    if(item.format==="chatml"||(item.messages!=null&&item.messages.length>0)){
        return {
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            role: { type: "string" },
                            content: { type: "string" }
                        }
                    }
                }
            }
        }
    }
    if(item.format==="text"||(item.text!=null&&item.text!=="")){
        return {
            type: "object",
            properties: {
                text: { type: "string" }
            }
        }
    }
    return {
        type: "object",
        properties: {
            instruction: { type: "string" },
            input: { type: "string" },
            output: { type: "string" }
        }
    }
}
export class JsonSchemaExporter implements Exporter{
    name="json-schema"
    mimeType="application/json"
    extension=".json"
    export(items: TrainingItem[], options?: ExportOptions): string{
        let schema=options?.schema!=null?(options.schema as object):generateJsonSchema(items)
        let createdAt=Date.now()
        let metadata={
            createdAt: createdAt,
            totalCount: items.length,
            splitCounts: {train: 0, validation: 0, test: 0}
        }
        let result: Record<string, unknown>={
            schema: schema,
            metadata: metadata
        }
        if(options?.splitConfig){
            let splits=splitItems(items, options.splitConfig as SplitConfig)
            result.splits=splits
            metadata.splitCounts={
                train: splits.train.length,
                validation: splits.validation.length,
                test: splits.test.length
            }
        }
        else{
            result.data=items
        }
        let space=options?.pretty===true?2:undefined
        return JSON.stringify(result, null, space)
    }
}
