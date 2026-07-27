export interface TokenBudgetConfig{
    maxSessionTokens:number
    reservePromptTokens:number
    maxOutputTokens:number
    minOutputTokens:number
}
export const DEFAULT_TOKEN_BUDGET:TokenBudgetConfig={
    maxSessionTokens:1000000,
    reservePromptTokens:8192,
    maxOutputTokens:16384,
    minOutputTokens:256
}
export function estimateTokens(text:string):number{
    if(!text)return 0
    let cjkCount=0
    let otherCount=0
    for(let i=0;i<text.length;i++){
        let code=text.charCodeAt(i)
        if(isCJK(code))cjkCount++
        else otherCount++
    }
    return Math.ceil(cjkCount+(otherCount/4))
}
function isCJK(code:number):boolean{
    if(code>=0x4E00&&code<=0x9FFF)return true
    if(code>=0x3400&&code<=0x4DBF)return true
    if(code>=0x3000&&code<=0x303F)return true
    if(code>=0x3040&&code<=0x309F)return true
    if(code>=0x30A0&&code<=0x30FF)return true
    if(code>=0xAC00&&code<=0xD7AF)return true
    if(code>=0xFF00&&code<=0xFFEF)return true
    return false
}
export function tokenizeApprox(text:string):string[]{
    if(!text)return []
    return text.split(/\s+/).filter(t=>t.length>0)
}
export class TokenBudgeter{
    private maxSessionTokens:number
    private reservePromptTokens:number
    private maxOutputTokens:number
    private minOutputTokens:number
    private used:number
    constructor(config:TokenBudgetConfig){
        this.maxSessionTokens=config.maxSessionTokens
        this.reservePromptTokens=config.reservePromptTokens
        this.maxOutputTokens=config.maxOutputTokens
        this.minOutputTokens=config.minOutputTokens
        this.used=0
    }
    allocate(promptTokens:number):number{
        let remaining=this.maxSessionTokens-this.used-this.reservePromptTokens-promptTokens
        if(remaining<=0)return 0
        return Math.min(this.maxOutputTokens, Math.max(this.minOutputTokens, remaining))
    }
    consume(used:number):void{
        if(!Number.isFinite(used)||used<0)return
        this.used+=used
        if(this.used>this.maxSessionTokens)this.used=this.maxSessionTokens
    }
    remaining():number{
        return this.maxSessionTokens-this.used
    }
    isExhausted():boolean{
        return this.remaining()<=0
    }
    reset():void{
        this.used=0
    }
    getStats():{used:number, remaining:number, total:number, percentUsed:number}{
        let rem=this.remaining()
        let percentUsed=this.maxSessionTokens>0?(this.used/this.maxSessionTokens)*100:0
        return{
            used:this.used,
            remaining:rem,
            total:this.maxSessionTokens,
            percentUsed:percentUsed
        }
    }
    allocateBatch(items:{promptTokens:number}[]):number[]{
        let result:number[]=[]
        for(let item of items){
            if(this.isExhausted()){
                result.push(0)
                continue
            }
            let alloc=this.allocate(item.promptTokens)
            if(alloc<=0){
                result.push(0)
                continue
            }
            this.consume(item.promptTokens+alloc)
            result.push(alloc)
        }
        return result
    }
    allocateSmart(items:{promptTokens:number, priority?:number}[]):number[]{
        let result:number[]=new Array(items.length).fill(0)
        if(items.length===0)return result
        let totalPriority=0
        for(let item of items){
            totalPriority+=item.priority??1
        }
        if(totalPriority<=0)return result
        let totalPromptTokens=0
        for(let item of items){
            totalPromptTokens+=item.promptTokens
        }
        let availableForOutput=this.maxSessionTokens-this.used-this.reservePromptTokens-totalPromptTokens
        if(availableForOutput<=0)return result
        for(let i=0;i<items.length;i++){
            if(this.isExhausted()){
                result[i]=0
                continue
            }
            let priority=items[i].priority??1
            let share=Math.floor((priority/totalPriority)*availableForOutput)
            let alloc=Math.min(this.maxOutputTokens, Math.max(this.minOutputTokens, share))
            if(alloc<=0){
                result[i]=0
                continue
            }
            result[i]=alloc
            this.consume(items[i].promptTokens+alloc)
        }
        return result
    }
}
export interface ChunkPlan{
    chunkIndex:number
    promptTokens:number
    outputTokens:number
    skipped:boolean
}
export function planChunkBudget(chunks:{text:string}[], config:TokenBudgetConfig):ChunkPlan[]{
    let result:ChunkPlan[]=[]
    let budgeter=new TokenBudgeter(config)
    for(let i=0;i<chunks.length;i++){
        let promptTokens=estimateTokens(chunks[i].text)
        let outputTokens=budgeter.allocate(promptTokens)
        if(outputTokens<=0){
            result.push({chunkIndex:i, promptTokens:promptTokens, outputTokens:0, skipped:true})
            continue
        }
        budgeter.consume(promptTokens+outputTokens)
        result.push({chunkIndex:i, promptTokens:promptTokens, outputTokens:outputTokens, skipped:false})
    }
    return result
}
