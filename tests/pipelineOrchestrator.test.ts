// @vitest-environment node
import { describe, it, expect } from "vitest"
import { PipelineOrchestrator, PipelineStep, PipelineContext, createDefaultPipelineOrchestrator } from "../src/core/pipelineOrchestrator.js"
import { TrainingItem } from "../src/types/interfaces.js"
function makeItem(id: number): TrainingItem{
    return {format: "text", text: "item " + id}
}
describe("PipelineOrchestrator", ()=>{
    it("initializes idle", ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        expect(orchestrator.status).toBe("idle")
        expect(orchestrator.steps).toEqual([])
        expect(orchestrator.events).toEqual([])
        expect(orchestrator.listeners.size).toBe(0)
    })
    it("initializes with name and steps", ()=>{
        let step: PipelineStep={name: "step1", run: async (ctx: PipelineContext)=>ctx}
        let orchestrator=new PipelineOrchestrator({name: "custom", steps: [step]})
        expect(orchestrator.name).toBe("custom")
        expect(orchestrator.steps).toEqual([step])
        expect(orchestrator.progress.totalSteps).toBe(1)
    })
    it("run executes steps in order", async ()=>{
        let order: number[]=[]
        let steps: PipelineStep[]=[
            {name: "a", run: async ()=>{order.push(1); return {items: [], metadata: {}, logs: [], variables: {}}}},
            {name: "b", run: async ()=>{order.push(2); return {items: [], metadata: {}, logs: [], variables: {}}}},
            {name: "c", run: async ()=>{order.push(3); return {items: [], metadata: {}, logs: [], variables: {}}}}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        await orchestrator.run()
        expect(order).toEqual([1, 2, 3])
    })
    it("run updates context items", async ()=>{
        let item=makeItem(1)
        let steps: PipelineStep[]=[
            {name: "add", run: async (ctx: PipelineContext)=>{
                return {...ctx, items: [...ctx.items, item]}
            }}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        let result=await orchestrator.run()
        expect(result.items).toEqual([item])
        expect(orchestrator.context.items).toEqual([item])
    })
    it("progress currentStep increments", async ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx},
            {name: "b", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        await orchestrator.run()
        expect(orchestrator.progress.currentStep).toBe(2)
    })
    it("events emitted for status", async ()=>{
        let orchestrator=new PipelineOrchestrator({steps: []})
        await orchestrator.run()
        let statusEvents=orchestrator.events.filter(e=>e.type==="status")
        expect(statusEvents.length).toBeGreaterThanOrEqual(2)
        expect(statusEvents[0].payload).toMatchObject({status: "running"})
        expect(statusEvents[statusEvents.length-1].payload).toMatchObject({status: "completed"})
    })
    it("events emitted for progress", async ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        await orchestrator.run()
        let progressEvents=orchestrator.events.filter(e=>e.type==="progress")
        expect(progressEvents.length).toBeGreaterThanOrEqual(2)
    })
    it("events emitted for step-start", async ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        await orchestrator.run()
        let startEvents=orchestrator.events.filter(e=>e.type==="step-start")
        expect(startEvents.length).toBe(1)
        expect(startEvents[0].payload).toMatchObject({name: "a", index: 0})
    })
    it("events emitted for step-end", async ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        await orchestrator.run()
        let endEvents=orchestrator.events.filter(e=>e.type==="step-end")
        expect(endEvents.length).toBe(1)
        expect(endEvents[0].payload).toMatchObject({name: "a", index: 0})
    })
    it("onEvent listener receives events", async ()=>{
        let received: string[]=[]
        let orchestrator=new PipelineOrchestrator({steps: []})
        orchestrator.onEvent(event=>{
            received.push(event.type)
        })
        await orchestrator.run()
        expect(received).toContain("status")
        expect(received).toContain("progress")
    })
    it("cancel sets cancelled", ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        orchestrator.cancel()
        expect(orchestrator.status).toBe("cancelled")
        expect(orchestrator.isCancelled()).toBe(true)
        let events=orchestrator.events.filter(e=>e.type==="status")
        expect(events[events.length-1].payload).toMatchObject({status: "cancelled"})
    })
    it("step can check isCancelled and throw", async ()=>{
        let orchestrator=new PipelineOrchestrator({steps: [
            {name: "check", run: async ()=>{
                if (orchestrator.isCancelled()){
                    throw new Error("cancelled")
                }
                return {items: [], metadata: {}, logs: [], variables: {}}
            }}
        ]})
        orchestrator.cancel()
        await expect(orchestrator.run()).rejects.toThrow("cancelled")
        expect(orchestrator.status).toBe("failed")
    })
    it("pause toggles status", ()=>{
        let orchestrator=new PipelineOrchestrator({steps: []})
        orchestrator.setStatus("running")
        orchestrator.pause()
        expect(orchestrator.status).toBe("paused")
    })
    it("resume toggles status", ()=>{
        let orchestrator=new PipelineOrchestrator({steps: []})
        orchestrator.setStatus("running")
        orchestrator.pause()
        orchestrator.resume()
        expect(orchestrator.status).toBe("running")
    })
    it("error in step sets status failed and emits error", async ()=>{
        let orchestrator=new PipelineOrchestrator({steps: [
            {name: "fail", run: async ()=>{
                throw new Error("step failed")
            }}
        ]})
        await expect(orchestrator.run()).rejects.toThrow("step failed")
        expect(orchestrator.status).toBe("failed")
        let errorEvents=orchestrator.events.filter(e=>e.type==="error")
        expect(errorEvents.length).toBe(1)
        expect(errorEvents[0].payload).toBeInstanceOf(Error)
    })
    it("logs accumulate in context", async ()=>{
        let orchestrator=new PipelineOrchestrator({steps: [
            {name: "log", run: async (ctx: PipelineContext)=>{
                orchestrator.log("first")
                orchestrator.log("second")
                return ctx
            }}
        ]})
        await orchestrator.run()
        expect(orchestrator.context.logs).toEqual(["first", "second"])
    })
    it("initialContext merged", async ()=>{
        let item=makeItem(1)
        let orchestrator=new PipelineOrchestrator({steps: []})
        await orchestrator.run({items: [item], metadata: {key: "value"}, variables: {x: 1}})
        expect(orchestrator.context.items).toEqual([item])
        expect(orchestrator.context.metadata.key).toBe("value")
        expect(orchestrator.context.variables.x).toBe(1)
    })
    it("totalSteps equals steps length", ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx},
            {name: "b", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        expect(orchestrator.progress.totalSteps).toBe(2)
    })
    it("progress percent is correct", async ()=>{
        let steps: PipelineStep[]=[
            {name: "a", run: async (ctx: PipelineContext)=>ctx},
            {name: "b", run: async (ctx: PipelineContext)=>ctx}
        ]
        let orchestrator=new PipelineOrchestrator({steps: steps})
        let percents: number[]=[]
        orchestrator.onEvent(event=>{
            if (event.type==="progress"){
                percents.push((event.payload as {percent: number}).percent)
            }
        })
        await orchestrator.run()
        expect(percents).toContain(50)
        expect(percents).toContain(100)
    })
    it("context has default structure", ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        expect(orchestrator.context.items).toEqual([])
        expect(orchestrator.context.metadata).toEqual({})
        expect(orchestrator.context.logs).toEqual([])
        expect(orchestrator.context.variables).toEqual({})
    })
    it("unsubscribe listener stops receiving events", async ()=>{
        let count=0
        let orchestrator=new PipelineOrchestrator({steps: []})
        let unsubscribe=orchestrator.onEvent(()=>{
            count++
        })
        unsubscribe()
        await orchestrator.run()
        expect(count).toBe(0)
    })
    it("cancel during run is visible to step", async ()=>{
        let sawCancelled=false
        let orchestrator=new PipelineOrchestrator({steps: [
            {name: "long", run: async ()=>{
                await new Promise(resolve=>setTimeout(resolve, 10))
                sawCancelled=orchestrator.isCancelled()
                return {items: [], metadata: {}, logs: [], variables: {}}
            }}
        ]})
        let runPromise=orchestrator.run()
        orchestrator.cancel()
        await runPromise
        expect(sawCancelled).toBe(true)
        expect(orchestrator.status).toBe("cancelled")
    })
    it("empty pipeline completes immediately", async ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        await orchestrator.run()
        expect(orchestrator.status).toBe("completed")
        expect(orchestrator.progress.percent).toBe(100)
    })
    it("timestamp increases across events", async ()=>{
        let orchestrator=new PipelineOrchestrator({steps: [
            {name: "a", run: async (ctx: PipelineContext)=>ctx}
        ]})
        await orchestrator.run()
        for (let i=1; i<orchestrator.events.length; i++){
            expect(orchestrator.events[i].timestamp).toBeGreaterThanOrEqual(orchestrator.events[i-1].timestamp)
        }
    })
    it("setProgress updates progress property", ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        orchestrator.setProgress({currentStep: 2, totalSteps: 5, stepName: "s", percent: 40})
        expect(orchestrator.progress.currentStep).toBe(2)
        expect(orchestrator.progress.totalSteps).toBe(5)
        expect(orchestrator.progress.stepName).toBe("s")
        expect(orchestrator.progress.percent).toBe(40)
    })
    it("log emits log event", ()=>{
        let orchestrator=createDefaultPipelineOrchestrator()
        let received: unknown[]=[]
        orchestrator.onEvent(event=>{
            if (event.type==="log"){
                received.push(event.payload)
            }
        })
        orchestrator.log("hello")
        expect(received).toEqual(["hello"])
    })
})
