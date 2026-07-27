import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export interface DistributionStats{
    mean: number
    stdDev: number
    min: number
    max: number
    median: number
    p95: number
    count: number
}
export function computeStats(values: number[]): DistributionStats{
    let count=values.length
    if (count===0){
        return {mean: 0, stdDev: 0, min: 0, max: 0, median: 0, p95: 0, count: 0}
    }
    let sum=0
    for (let value of values){
        sum+=value
    }
    let mean=sum/count
    let varianceSum=0
    for (let value of values){
        let diff=value-mean
        varianceSum+=diff*diff
    }
    let stdDev=Math.sqrt(varianceSum/count)
    let sorted=[...values].sort((a, b) => a-b)
    let min=sorted[0]
    let max=sorted[count-1]
    let median
    if (count%2===0){
        median=(sorted[count/2-1]+sorted[count/2])/2
    }
    else{
        median=sorted[Math.floor(count/2)]
    }
    let p95Index=Math.ceil(0.95*count)-1
    if (p95Index<0){
        p95Index=0
    }
    if (p95Index>=count){
        p95Index=count-1
    }
    let p95=sorted[p95Index]
    return {mean, stdDev, min, max, median, p95, count}
}
export class LengthDistributionValidator extends BaseValidator{
    private lengthHistory: number[]
    private tokenHistory: number[]
    constructor(){
        super("length-distribution")
        this.threshold=0.5
        this.lengthHistory=[]
        this.tokenHistory=[]
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
    updateHistory(items: TrainingItem[]): void{
        for (let item of items){
            let text=this.extractText(item)
            let length=text.length
            let tokens=Math.ceil(length/4)
            this.lengthHistory.push(length)
            this.tokenHistory.push(tokens)
        }
    }
    getHistogram(bins?: number): {binStart: number, binEnd: number, count: number}[]{
        let binCount=bins??10
        let result: {binStart: number, binEnd: number, count: number}[]=[]
        if (this.lengthHistory.length===0){
            return result
        }
        let stats=computeStats(this.lengthHistory)
        let min=stats.min
        let max=stats.max
        if (min===max){
            for (let i=0; i<binCount; i++){
                result.push({binStart: min, binEnd: max, count: i===0 ? this.lengthHistory.length : 0})
            }
            return result
        }
        let binWidth=(max-min)/binCount
        for (let i=0; i<binCount; i++){
            let binStart=min+i*binWidth
            let binEnd=min+(i+1)*binWidth
            let count=0
            for (let length of this.lengthHistory){
                if (i===binCount-1){
                    if (length>=binStart && length<=binEnd){
                        count++
                    }
                }
                else{
                    if (length>=binStart && length<binEnd){
                        count++
                    }
                }
            }
            result.push({binStart, binEnd, count})
        }
        return result
    }
    validate(item: TrainingItem): ValidationResult{
        if (this.lengthHistory.length<5){
            return this.buildResult(1, true, ["insufficient data"], [])
        }
        let text=this.extractText(item)
        let length=text.length
        let tokens=Math.ceil(length/4)
        let lengthStats=computeStats(this.lengthHistory)
        let tokenStats=computeStats(this.tokenHistory)
        let isLengthOutlier=length<lengthStats.mean-2*lengthStats.stdDev || length>lengthStats.mean+2*lengthStats.stdDev
        let isTokenOutlier=tokens<tokenStats.mean-2*tokenStats.stdDev || tokens>tokenStats.mean+2*tokenStats.stdDev
        let score=1
        if (isLengthOutlier && isTokenOutlier){
            score=0
        }
        else if (isLengthOutlier || isTokenOutlier){
            score=0.5
        }
        let passed=score>=this.threshold
        let flags: string[]=[]
        if (isLengthOutlier){
            flags.push("length_outlier")
        }
        if (isTokenOutlier){
            flags.push("token_outlier")
        }
        let lengthZScore=lengthStats.stdDev>0 ? (length-lengthStats.mean)/lengthStats.stdDev : 0
        let tokenZScore=tokenStats.stdDev>0 ? (tokens-tokenStats.mean)/tokenStats.stdDev : 0
        let details=[
            "length: "+length,
            "tokens: "+tokens,
            "lengthZScore: "+lengthZScore.toFixed(2),
            "tokenZScore: "+tokenZScore.toFixed(2),
            "lengthMean: "+lengthStats.mean.toFixed(2),
            "tokenMean: "+tokenStats.mean.toFixed(2)
        ]
        return this.buildResult(score, passed, details, flags)
    }
}
export class TokenDistributionAnalyzer{
    analyze(items: TrainingItem[]): {lengthStats: DistributionStats, tokenStats: DistributionStats, histogram: {binStart: number, binEnd: number, count: number}[], outliers: {index: number, reason: string}[]}{
        let validator=new LengthDistributionValidator()
        validator.updateHistory(items)
        let lengths: number[]=[]
        let tokens: number[]=[]
        for (let item of items){
            let text=validator.extractText(item)
            let length=text.length
            let tokenCount=Math.ceil(length/4)
            lengths.push(length)
            tokens.push(tokenCount)
        }
        let lengthStats=computeStats(lengths)
        let tokenStats=computeStats(tokens)
        let histogram=validator.getHistogram()
        let outliers: {index: number, reason: string}[]=[]
        for (let i=0; i<items.length; i++){
            let result=validator.validate(items[i])
            if (!result.passed){
                let reasons: string[]=[]
                if (result.flags.includes("length_outlier")){
                    reasons.push("length_outlier")
                }
                if (result.flags.includes("token_outlier")){
                    reasons.push("token_outlier")
                }
                if (reasons.length>0){
                    outliers.push({index: i, reason: reasons.join(", ")})
                }
            }
        }
        return {lengthStats, tokenStats, histogram, outliers}
    }
}