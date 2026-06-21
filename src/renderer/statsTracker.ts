export class StatsTracker{
    totalChunks:number=0
    successfulChunks:number=0
    failedChunks:number=0
    totalTokens:number=0
    promptTokens:number=0
    startTime:number=0
    endTime:number=0
    deduplicatedCount:number=0

    start():void{
        this.startTime=Date.now()
        this.totalChunks=0
        this.successfulChunks=0
        this.failedChunks=0
        this.totalTokens=0
        this.promptTokens=0
        this.endTime=0
        this.deduplicatedCount=0
    }

    finish():void{
        this.endTime=Date.now()
    }

    recordChunkSuccess(tokens:number):void{
        this.totalChunks++
        this.successfulChunks++
        this.totalTokens+=tokens
    }

    recordChunkFailure():void{
        this.totalChunks++
        this.failedChunks++
    }

    recordPromptTokens(promptText:string):void{
        this.promptTokens+=Math.ceil(promptText.length/4)
    }

    checkWarnings(outputCount:number):string[]{
        let warnings:string[]=[]
        if(outputCount>100000){
            warnings.push(`Large output: ${outputCount.toLocaleString()} items`)
        }
        if(this.totalChunks>500){
            warnings.push(`High chunk count: ${this.totalChunks} chunks`)
        }
        if(this.promptTokens>500000){
            warnings.push(`High token usage: ${this.promptTokens.toLocaleString()} prompt tokens`)
        }
        return warnings
    }

    get elapsed():number{
        return this.endTime?this.endTime-this.startTime:Date.now()-this.startTime
    }

    get successRate():number{
        if(this.totalChunks===0)return 100
        return Math.round((this.successfulChunks/this.totalChunks)*100)
    }

    get report():StatsReport{
        return{
            totalChunks:this.totalChunks,
            successfulChunks:this.successfulChunks,
            failedChunks:this.failedChunks,
            successRate:this.successRate,
            totalTokens:this.totalTokens,
            promptTokens:this.promptTokens,
            elapsedMs:this.elapsed,
            elapsedFormatted:this.formatDuration(this.elapsed),
            deduplicatedCount:this.deduplicatedCount,
            tokensPerSecond:this.elapsed>0?Math.round(this.totalTokens/(this.elapsed/1000)):0
        }
    }

    private formatDuration(ms:number):string{
        if(ms<1000)return`${ms}ms`
        if(ms<60000)return`${(ms/1000).toFixed(1)}s`
        let min=Math.floor(ms/60000)
        let sec=Math.round((ms%60000)/1000)
        return`${min}m ${sec}s`
    }
}

export interface StatsReport{
    totalChunks:number
    successfulChunks:number
    failedChunks:number
    successRate:number
    totalTokens:number
    promptTokens:number
    elapsedMs:number
    elapsedFormatted:string
    deduplicatedCount:number
    tokensPerSecond:number
}