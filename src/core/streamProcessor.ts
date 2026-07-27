import type { TrainingItem } from "../types/index.js"
import { Exporter, ExportOptions } from "../renderer/exportFormats.js"
export type StreamEvent=
    | { type: "item"; item: TrainingItem }
    | { type: "error"; error: string }
    | { type: "backpressure"; paused: boolean }
export interface StreamProcessorOptions{
    processChunk: (chunk: string)=>Promise<TrainingItem[]>
    highWaterMark?: number
}
export class StreamProcessor{
    private processChunk: (chunk: string)=>Promise<TrainingItem[]>
    private controller: BackpressureController
    constructor(options: StreamProcessorOptions){
        this.processChunk=options.processChunk
        this.controller=new BackpressureController(options.highWaterMark)
    }
    async *process(source: AsyncIterable<string>|Iterable<string>): AsyncGenerator<StreamEvent>{
        let limit=3
        let active=new Map<number, Promise<void>>()
        let outputQueue: StreamEvent[]=[]
        let nextId=0
        let paused=false
        let sourceDone=false
        let iterator: AsyncIterator<string>|Iterator<string>
        if(Symbol.asyncIterator in source){
            iterator=(source as AsyncIterable<string>)[Symbol.asyncIterator]()
        }
        else{
            iterator=(source as Iterable<string>)[Symbol.iterator]()
        }
        let startChunk=(chunk: string)=>{
            let id=nextId++
            let promise=this.processChunk(chunk)
                .then(items=>{
                    for(let item of items){
                        outputQueue.push({type: "item", item})
                    }
                })
                .catch(err=>{
                    outputQueue.push({type: "error", error: String(err.message??err)})
                })
                .finally(()=>{
                    active.delete(id)
                })
            active.set(id, promise)
        }
        let waitForOne=async ()=>{
            if(active.size===0){
                return
            }
            await Promise.race(active.values())
        }
        while(true){
            while(!paused&&!sourceDone&&active.size<limit){
                let next=await iterator.next()
                if(next.done){
                    sourceDone=true
                    break
                }
                startChunk(next.value as string)
            }
            if(!paused&&this.controller.shouldPause(outputQueue.length)){
                yield {type: "backpressure", paused: true}
                paused=true
            }
            if(paused){
                while(!this.controller.shouldResume(outputQueue.length)){
                    yield outputQueue.shift()!
                    if(!this.controller.shouldResume(outputQueue.length)){
                        await waitForOne()
                    }
                }
                yield {type: "backpressure", paused: false}
                paused=false
                continue
            }
            if(outputQueue.length>0){
                yield outputQueue.shift()!
                continue
            }
            if(sourceDone&&active.size===0){
                break
            }
            await waitForOne()
        }
    }
}
export async function* streamToJsonl(items: AsyncIterable<TrainingItem>): AsyncGenerator<string>{
    for await(let item of items){
        yield JSON.stringify(item)+"\n"
    }
}
export class JsonlStreamExporter implements Exporter{
    name="jsonl-stream"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        return items.map(item=>JSON.stringify(item)).join("\n")+"\n"
    }
    async *streamExport(items: AsyncIterable<TrainingItem>): AsyncGenerator<string>{
        yield* streamToJsonl(items)
    }
}
export class BackpressureController{
    private highWaterMark: number
    constructor(highWaterMark?: number){
        this.highWaterMark=highWaterMark??10
    }
    shouldPause(pending: number): boolean{
        return pending>this.highWaterMark
    }
    shouldResume(pending: number): boolean{
        return pending<=Math.floor(this.highWaterMark/2)
    }
}