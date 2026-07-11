import type{TrainingItem}from"../types/index.js"
import type{Provider,ProviderResult}from"./provider.js"
import{StatsTracker}from"./statsTracker.js"
import{getCachedResult,setCachedResult}from"./cache.js"
import type{ProvenanceData}from"./provenance.js"
import{tagItem}from"./provenance.js"
import{t}from"./i18n.js"
class Processor{
    private abortController:AbortController|null=null
    private aborted:boolean=false
    concurrency:number=3
    demoMode:boolean=false
    provider:Provider|null=null
    stats:StatsTracker
    constructor(){
        this.stats=new StatsTracker()
    }
    get isAborted():boolean{
        return this.aborted||this.abortController?.signal.aborted||false
    }
    splitBatchedResponse(response:string,count:number):string[]{
        let parts=response.split(/--- CHUNK \d+ ---/)
        if(parts.length>0&&parts[0].trim()==="")parts.shift()
        while(parts.length<count)parts.push("")
        return parts.slice(0,count).map(p=>p.trim())
    }
    private async batchSmallChunks(
        smallChunks:{chunk:string;index:number}[],
        model:string,
        processingType:string,
        generatePrompt:(chunk:string,processingType:string)=>Promise<string>,
        createTrainingItem:(input:string,output:string,processingType:string)=>TrainingItem[],
        onChunkComplete:(index:number,total:number,items:TrainingItem[])=>void,
        onChunkError:(index:number,error:string)=>void,
        signal:AbortSignal,
        total:number,
        provider:Provider,
        provenanceBase?:Omit<ProvenanceData,'chunkIndex'>
    ):Promise<void>{
        let MAX_CHARS_PER_BATCH=32000
        let MAX_CHUNKS_PER_BATCH=8
        let stats=this.stats
        let filtered=smallChunks.filter(item=>item.chunk&&item.chunk.trim().length>0)
        let batches:{chunk:string;index:number}[][]=[]
        let currentBatch:{chunk:string;index:number}[]=[]
        let currentBatchSize=0
        let estimatedPromptMultiplier=3
        for(let item of filtered){
            let estimatedSize=item.chunk.length*estimatedPromptMultiplier+50
            if(currentBatch.length>0&&(currentBatch.length>=MAX_CHUNKS_PER_BATCH||currentBatchSize+estimatedSize>MAX_CHARS_PER_BATCH)){
                batches.push(currentBatch)
                currentBatch=[]
                currentBatchSize=0
            }
            currentBatch.push(item)
            currentBatchSize+=estimatedSize
        }
        if(currentBatch.length>0)batches.push(currentBatch)
        for(let batch of batches){
            if(signal.aborted)break
            try{
                let prompts:string[]=[]
                for(let item of batch){
                    if(signal.aborted)break
                    let prompt=await generatePrompt(item.chunk,processingType)
                    prompts.push(prompt)
                }
                if(signal.aborted||prompts.length===0)continue
                let combined=prompts.map((p,j)=>`--- CHUNK ${j+1} ---\n${p}`).join("\n\n")
                stats.recordPromptTokens(combined)
                let result=await provider.generate(combined,model,{
                    temperature:0.7,
                    top_p:0.9,
                    max_tokens:16384
                })
                if(signal.aborted)continue
                let responses=this.splitBatchedResponse(result.text,batch.length)
                for(let j=0;j<batch.length;j++){
                    let items=createTrainingItem(batch[j].chunk,responses[j]||"",processingType)
                    if(provenanceBase){
                        let prov:ProvenanceData={...provenanceBase,chunkIndex:batch[j].index}
                        items=items.map(item=>tagItem(item,prov))
                    }
                    let tokens=Math.ceil((responses[j]||"").length/4)
                    stats.recordChunkSuccess(tokens)
                    onChunkComplete(batch[j].index,total,items)
                }
            }
            catch(err){
                if(!signal.aborted){
                    console.error("Batch processing failed:",(err as Error).message)
                    for(let item of batch){
                        stats.recordChunkFailure()
                        onChunkError(item.index,t("log.batchProcessingFailed",undefined,{error:(err as Error).message}))
                    }
                }
            }
        }
    }
    abort():void{
        this.aborted=true
        if(this.abortController){
            this.abortController.abort()
            this.abortController=null
        }
    }
    reset():void{
        this.aborted=false
        this.abortController=new AbortController()
    }
    enableDemoMode():void{
        this.demoMode=true
    }
    disableDemoMode():void{
        this.demoMode=false
    }
    private getDemoResponse(chunk:string,processingType:string):string{
        let demoResponses:Record<string,string[]>={
            instruction:[
                t("demoResponse.instruction.1"),
                t("demoResponse.instruction.2"),
            ],
            conversation:[
                t("demoResponse.conversation.1"),
            ]
        }
        let responses=demoResponses[processingType]||demoResponses.instruction
        return responses[Math.floor(Math.random()*responses.length)]
    }
    async processChunks(
        chunks:string[],
        model:string,
        processingType:string,
        generatePrompt:(chunk:string,processingType:string)=>Promise<string>,
        createTrainingItem:(input:string,output:string,processingType:string)=>TrainingItem[],
        onChunkComplete:(index:number,total:number,items:TrainingItem[])=>void,
        onChunkError:(index:number,error:string)=>void,
        provenanceBase?:Omit<ProvenanceData,'chunkIndex'>
    ):Promise<TrainingItem[]>{
        this.reset()
        this.stats.start()
        let stats=this.stats
        let signal=this.abortController!.signal
        let allItems:TrainingItem[]=[]
        let total=chunks.length
        let effectiveConcurrency=Math.max(1,Math.min(20,Number(this.concurrency)||3))
        const completeChunk=(index:number,_total:number,items:TrainingItem[])=>{
            allItems.push(...items)
            onChunkComplete(index,total,items)
        }
        let selfProvider=this.provider
        let batchingEnabled=!this.demoMode&&selfProvider!==null&&selfProvider.name!=="ollama"
        let queue:{chunk:string;index:number}[]=[]
        if(batchingEnabled){
            let smallChunks:{chunk:string;index:number}[]=[]
            for(let i=0;i<chunks.length;i++){
                if(chunks[i]&&chunks[i].length<500){
                    smallChunks.push({chunk:chunks[i],index:i})
                }
                else{
                    queue.push({chunk:chunks[i],index:i})
                }
            }
            if(smallChunks.length>0&&!signal.aborted){
                try{
                    await this.batchSmallChunks(
                        smallChunks,model,processingType,
                        generatePrompt,createTrainingItem,
                        completeChunk,onChunkError,
                        signal,total,selfProvider!,
                        provenanceBase
                    )
                    smallChunks.length=0
                }
                catch(err){
                    if(!signal.aborted){
                        console.error("Batch processing failed, falling back to individual:",(err as Error).message)
                        for(let sc of smallChunks){
                            queue.push(sc)
                        }
                    }
                }
            }
        }
        else{
            queue=chunks.map((chunk,i)=>({chunk,index:i}))
        }
        let running=0
        let pending=0
        async function processOne(
            chunk:string,
            idx:number,
            model:string,
            processingType:string,
            genPrompt:(chunk:string,processingType:string)=>Promise<string>,
            createItem:(input:string,output:string,processingType:string)=>TrainingItem[],
            onComplete:(index:number,total:number,items:TrainingItem[])=>void,
            onError:(index:number,error:string)=>void,
            sig:AbortSignal,
            demoMode:boolean,
            getDemoResponse:(chunk:string,processingType:string)=>string,
            onSlotFree:()=>void,
            onDone:()=>void,
            provider:Provider|null,
            chunksArr:string[],
            provenanceBase?:Omit<ProvenanceData,'chunkIndex'>
        ):Promise<void>{
            let slotFreed=false
            let freeSlot=()=>{
                if(!slotFreed){
                    slotFreed=true
                    onSlotFree()
                }
            }
            try{
                if(sig.aborted){freeSlot();return}
                if(!chunk||chunk.trim().length===0){freeSlot();return}
                let prompt=await genPrompt(chunk,processingType)
                if(!prompt||prompt.trim().length===0||sig.aborted){freeSlot();return}
                stats.recordPromptTokens(prompt)
                let cached=await getCachedResult(chunk,model,prompt)
                if(cached){
                    freeSlot() // Free slot immediately — result is already available
                    let items=createItem(chunk,cached.response,processingType)
                    if(provenanceBase){
                        let prov:ProvenanceData={...provenanceBase,chunkIndex:idx}
                        items=items.map(item=>tagItem(item,prov))
                    }
                    onComplete(idx,total,items)
                    stats.recordChunkSuccess(cached.tokens)
                    chunksArr[idx]=(null as any) // Release chunk for GC
                    return
                }
                let response:string
                if(demoMode){
                    freeSlot() // Free slot immediately — next chunk can start
                    const delay=500+Math.floor(Math.random()*1000)
                    await new Promise<void>(resolve=>{
                        const timer=setTimeout(resolve,delay)
                        sig.addEventListener("abort",()=>{
                            clearTimeout(timer)
                            resolve()
                        },{once:true})
                    })
                    if(sig.aborted)return
                    response=getDemoResponse(chunk,processingType)
                }
                else{
                    if(!provider)throw new Error(t("error.noProvider"))
                    console.log(`[processor] starting chunk ${idx}/${total} (${chunk.length} chars) with ${provider.name}`)
                    let chunkStart = Date.now()
                    let responsePromise=provider.generate(prompt,model,{
                        temperature:0.7,
                        top_p:0.9,
                        max_tokens:16384
                    })
                    setTimeout(()=>freeSlot(),0) // Defer slot freeing — next chunk starts after current tick
                    let result=await responsePromise
                    response=result.text
                    let latencyMs = Date.now() - chunkStart
                    stats.recordLatency(latencyMs)
                    console.log(`[processor] chunk ${idx}/${total} completed (${response.length} chars response, ${latencyMs}ms)`)
                }
                if(sig.aborted)return
                let tokens=Math.ceil(response.length/4)
                stats.recordChunkSuccess(tokens)
                await setCachedResult(chunk,model,prompt,response,tokens)
                let items=createItem(chunk,response,processingType)
                if(provenanceBase){
                    let prov:ProvenanceData={...provenanceBase,chunkIndex:idx}
                    items=items.map(item=>tagItem(item,prov))
                }
                onComplete(idx,total,items)
                chunksArr[idx]=(null as any) // Release chunk for GC
            }
            catch(err){
                stats.recordChunkFailure()
                if(!sig.aborted){
                    console.error(`Processor: chunk ${idx} failed for model ${model}`,(err as Error).message)
                    onError(idx,(err as Error).message)
                }
            }
            finally{
                freeSlot()
                onDone()
            }
        }
        return new Promise((resolve)=>{
            let onSlotFree=()=>{
                running--
                if(queue.length>0&&!signal.aborted){
                    let{chunk,index}=queue.shift()!
                    running++
                    pending++
                    processOne(
                        chunk,index,model,processingType,
                        generatePrompt,createTrainingItem,
                        completeChunk,onChunkError,signal,
                        this.demoMode,this.getDemoResponse.bind(this),
                        onSlotFree,onDone,selfProvider,chunks,
                        provenanceBase
                    )
                }
                else if(pending===0&&running===0){
                    chunks.length=0
                    stats.finish()
                    resolve(allItems)
                }
            }
            let onDone=()=>{
                pending--
                if(pending===0&&running===0){
                    chunks.length=0
                    stats.finish()
                    resolve(allItems)
                }
            }
            let initial=Math.min(effectiveConcurrency,queue.length)
        for(let i=0;i<initial;i++){
                let{chunk,index}=queue.shift()!
                running++
                pending++
                processOne(
                    chunk,index,model,processingType,
                    generatePrompt,createTrainingItem,
                    completeChunk,onChunkError,signal,
                    this.demoMode,this.getDemoResponse.bind(this),
                    onSlotFree,onDone,selfProvider,chunks,
                    provenanceBase
                )
            }
            if(initial===0){
                chunks.length=0
                stats.finish()
                resolve(allItems)
            }
        })
    }
}
export default Processor
