// @vitest-environment node
import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../src/types/index.js"
import { Exporter } from "../src/renderer/exportFormats.js"
import { StreamProcessor, streamToJsonl, JsonlStreamExporter, BackpressureController, StreamEvent } from "../src/core/streamProcessor.js"
describe("StreamProcessor", ()=>{
    test("yields items from single chunk", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["hello"]
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source)){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items).toHaveLength(1)
        expect(items[0].instruction).toBe("hello")
    })
    test("yields items from multiple chunks", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["a", "b", "c"]
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source)){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items).toHaveLength(3)
        expect(items.map(i=>i.instruction)).toEqual(["a", "b", "c"])
    })
    test("handles errors from processChunk", async ()=>{
        let processChunk=async (chunk: string)=>{
            if(chunk==="bad"){
                throw new Error("bad chunk")
            }
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["good", "bad", "good"]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        let errors=events.filter(e=>e.type==="error")
        expect(errors).toHaveLength(1)
        expect(errors[0].error).toContain("bad chunk")
        let items=events.filter(e=>e.type==="item")
        expect(items).toHaveLength(2)
    })
    test("handles empty source", async ()=>{
        let processChunk=async (_chunk: string)=>[]
        let processor=new StreamProcessor({processChunk})
        let source: string[]=[]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        expect(events).toHaveLength(0)
    })
    test("processes chunks concurrently", async ()=>{
        let delays: Record<string, number>={a: 30, b: 10, c: 20}
        let processChunk=async (chunk: string)=>{
            await new Promise(resolve=>setTimeout(resolve, delays[chunk]))
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["a", "b", "c"]
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source)){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items.map(i=>i.instruction)).toEqual(["b", "c", "a"])
    })
    test("emits backpressure when output queue exceeds highWaterMark", async ()=>{
        let processChunk=async (chunk: string)=>{
            return Array.from({length: 5}, (_, i)=>({format: "instruction" as const, instruction: `${chunk}-${i}`, output: "out"}))
        }
        let processor=new StreamProcessor({processChunk, highWaterMark: 3})
        let source=["a", "b", "c", "d", "e"]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        let pauses=events.filter(e=>e.type==="backpressure"&&e.paused)
        expect(pauses.length).toBeGreaterThan(0)
    })
    test("resumes when output queue drains", async ()=>{
        let processChunk=async (chunk: string)=>{
            return Array.from({length: 5}, (_, i)=>({format: "instruction" as const, instruction: `${chunk}-${i}`, output: "out"}))
        }
        let processor=new StreamProcessor({processChunk, highWaterMark: 3})
        let source=["a", "b"]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        let pauses=events.filter(e=>e.type==="backpressure"&&e.paused)
        let resumes=events.filter(e=>e.type==="backpressure"&&!e.paused)
        expect(pauses.length).toBeGreaterThan(0)
        expect(resumes.length).toBeGreaterThan(0)
        expect(resumes.length).toBe(pauses.length)
    })
    test("respects custom highWaterMark", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk, highWaterMark: 1})
        let source=["a", "b", "c"]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        expect(events.some(e=>e.type==="backpressure"&&e.paused)).toBe(true)
    })
    test("respects concurrency limit", async ()=>{
        let active=0
        let maxActive=0
        let processChunk=async (chunk: string)=>{
            active++
            maxActive=Math.max(maxActive, active)
            await new Promise(resolve=>setTimeout(resolve, 10))
            active--
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["a", "b", "c", "d", "e"]
        let events: StreamEvent[]=[]
        for await(let event of processor.process(source)){
            events.push(event)
        }
        expect(maxActive).toBeLessThanOrEqual(3)
        expect(events.filter(e=>e.type==="item").length).toBe(5)
    })
    test("works with async iterable source", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        async function *source(){
            yield "a"
            yield "b"
        }
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source())){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items).toHaveLength(2)
    })
    test("works with sync iterable source", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [{format: "instruction" as const, instruction: chunk, output: "out"}]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["x", "y"]
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source)){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items).toHaveLength(2)
    })
    test("yields multiple items per chunk in order", async ()=>{
        let processChunk=async (chunk: string)=>{
            return [
                {format: "instruction" as const, instruction: `${chunk}-1`, output: "out"},
                {format: "instruction" as const, instruction: `${chunk}-2`, output: "out"}
            ]
        }
        let processor=new StreamProcessor({processChunk})
        let source=["a"]
        let items: TrainingItem[]=[]
        for await(let event of processor.process(source)){
            if(event.type==="item"){
                items.push(event.item)
            }
        }
        expect(items.map(i=>i.instruction)).toEqual(["a-1", "a-2"])
    })
})
describe("streamToJsonl", ()=>{
    test("yields JSONL lines", async ()=>{
        async function *source(){
            yield {format: "instruction" as const, instruction: "q1", output: "a1"}
            yield {format: "instruction" as const, instruction: "q2", output: "a2"}
        }
        let lines: string[]=[]
        for await(let line of streamToJsonl(source())){
            lines.push(line)
        }
        expect(lines).toHaveLength(2)
        expect(JSON.parse(lines[0]).instruction).toBe("q1")
        expect(JSON.parse(lines[1]).instruction).toBe("q2")
    })
    test("handles empty async iterable", async ()=>{
        async function *source(){}
        let lines: string[]=[]
        for await(let line of streamToJsonl(source())){
            lines.push(line)
        }
        expect(lines).toHaveLength(0)
    })
    test("each line ends with newline", async ()=>{
        async function *source(){
            yield {format: "instruction" as const, instruction: "q", output: "a"}
        }
        for await(let line of streamToJsonl(source())){
            expect(line.endsWith("\n")).toBe(true)
        }
    })
    test("produces valid JSON lines", async ()=>{
        async function *source(){
            yield {format: "text" as const, text: "hello world"}
        }
        for await(let line of streamToJsonl(source())){
            expect(JSON.parse(line)).toEqual({format: "text", text: "hello world"})
        }
    })
})
describe("JsonlStreamExporter", ()=>{
    test("name mimeType extension correct", ()=>{
        let exporter: Exporter=new JsonlStreamExporter()
        expect(exporter.name).toBe("jsonl-stream")
        expect(exporter.mimeType).toBe("application/jsonl")
        expect(exporter.extension).toBe(".jsonl")
        expect(typeof exporter.export).toBe("function")
        expect(typeof (exporter as {streamExport?: unknown}).streamExport).toBe("function")
    })
    test("export string fallback", ()=>{
        let exporter=new JsonlStreamExporter()
        let items: TrainingItem[]=[
            {format: "instruction", instruction: "q1", output: "a1"},
            {format: "instruction", instruction: "q2", output: "a2"}
        ]
        let result=exporter.export(items)
        expect(result).toBe('{"format":"instruction","instruction":"q1","output":"a1"}\n{"format":"instruction","instruction":"q2","output":"a2"}\n')
    })
    test("streamExport yields JSONL lines", async ()=>{
        let exporter=new JsonlStreamExporter()
        async function *source(){
            yield {format: "instruction" as const, instruction: "q", output: "a"}
        }
        let lines: string[]=[]
        for await(let line of exporter.streamExport(source())){
            lines.push(line)
        }
        expect(lines).toHaveLength(1)
        expect(JSON.parse(lines[0]).instruction).toBe("q")
    })
})
describe("BackpressureController", ()=>{
    test("shouldPause when pending exceeds highWaterMark", ()=>{
        let controller=new BackpressureController(10)
        expect(controller.shouldPause(10)).toBe(false)
        expect(controller.shouldPause(11)).toBe(true)
    })
    test("shouldResume when pending at or below half highWaterMark", ()=>{
        let controller=new BackpressureController(10)
        expect(controller.shouldResume(5)).toBe(true)
        expect(controller.shouldResume(6)).toBe(false)
    })
    test("default highWaterMark is 10", ()=>{
        let controller=new BackpressureController()
        expect(controller.shouldPause(11)).toBe(true)
        expect(controller.shouldResume(5)).toBe(true)
    })
    test("custom highWaterMark", ()=>{
        let controller=new BackpressureController(4)
        expect(controller.shouldPause(5)).toBe(true)
        expect(controller.shouldResume(2)).toBe(true)
        expect(controller.shouldResume(3)).toBe(false)
    })
})