import type{TrainingItem}from"../types/index.js"
import type{Provider,ProviderResult}from"./provider.js"
import{StatsTracker}from"./statsTracker.js"
import{getCachedResult,setCachedResult}from"./cache.js"

class Processor{
    private abortController:AbortController|null=null
    concurrency:number=3
    demoMode:boolean=false
    provider:Provider|null=null
    stats:StatsTracker

    constructor(){
        this.stats=new StatsTracker()
    }

    get isAborted():boolean{
        return this.abortController?.signal.aborted??false
    }

    abort():void{
        if(this.abortController){
            this.abortController.abort()
            this.abortController=null
        }
    }

    reset():void{
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
                "Question: What is the main topic of this document?\nAnswer: This document covers the key concepts and principles of modern software development.",
                "Question: What are the key takeaways?\nAnswer: The document emphasizes modular design, testing, and continuous integration.",
            ],
            conversation:[
                "User: Can you explain the main concept?\nAssistant: The main concept revolves around systematic approaches to problem-solving.",
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
        onChunkError:(index:number,error:string)=>void
    ):Promise<TrainingItem[]>{
        this.reset()
        this.stats.start()
        let stats=this.stats
        let signal=this.abortController!.signal
        let allItems:TrainingItem[]=[]
        let total=chunks.length
        let queue=chunks.map((chunk,i)=>({chunk,index:i}))
        let running=0
        let selfProvider=this.provider

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
            allItems:TrainingItem[],
            onDone:()=>void,
            provider:Provider|null
        ):Promise<void>{
            try{
                if(sig.aborted)return
                if(!chunk||chunk.trim().length===0)return
                let prompt=await genPrompt(chunk,processingType)
                if(!prompt||prompt.trim().length===0||sig.aborted)return
                let cached=await getCachedResult(chunk,model,prompt)
                if(cached){
                    let items=createItem(chunk,cached.response,processingType)
                    allItems.push(...items)
                    onComplete(idx,total,items)
                    stats.recordChunkSuccess(cached.tokens)
                    return
                }
                let response:string
                if(demoMode){
                    await new Promise(resolve=>setTimeout(resolve,500+Math.random()*1000))
                    response=getDemoResponse(chunk,processingType)
                }
                else{
                    if(!provider)throw new Error("No provider configured")
                    let result=await provider.generate(prompt,model,{
                        temperature:0.7,
                        top_p:0.9
                    })
                    response=result.text
                }
                if(sig.aborted)return
                let tokens=Math.ceil(response.length/4)
                stats.recordChunkSuccess(tokens)
                await setCachedResult(chunk,model,prompt,response,tokens)
                let items=createItem(chunk,response,processingType)
                allItems.push(...items)
                onComplete(idx,total,items)
            }
            catch(err){
                stats.recordChunkFailure()
                if(!sig.aborted){
                    onError(idx,(err as Error).message)
                }
            }
            finally{
                onDone()
            }
        }

        return new Promise((resolve)=>{
            let onDone=()=>{
                running--
                if(queue.length>0&&!signal.aborted){
                    let{chunk,index}=queue.shift()!
                    running++
                    processOne(
                        chunk,index,model,processingType,
                        generatePrompt,createTrainingItem,
                        onChunkComplete,onChunkError,signal,
                        this.demoMode,this.getDemoResponse.bind(this),
                        allItems,onDone,selfProvider
                    )
                }
                else if(running===0){
                    stats.finish()
                    resolve(allItems)
                }
            }

            let initial=Math.min(this.concurrency,queue.length)
            for(let i=0;i<initial;i++){
                let{chunk,index}=queue.shift()!
                running++
                processOne(
                    chunk,index,model,processingType,
                    generatePrompt,createTrainingItem,
                    onChunkComplete,onChunkError,signal,
                    this.demoMode,this.getDemoResponse.bind(this),
                    allItems,onDone,selfProvider
                )
            }
            if(initial===0){
                stats.finish()
                resolve(allItems)
            }
        })
    }
}

export default Processor