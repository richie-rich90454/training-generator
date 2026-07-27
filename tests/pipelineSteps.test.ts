// @vitest-environment node
import { describe, it, expect } from "vitest"
import { PipelineContext } from "../src/core/pipelineOrchestrator.js"
import { PipelineStepBase, PipelineMiddleware, MiddlewareStep, FilterStep, MapStep, BatchStep, ValidationStep, ExportStep, withMiddleware } from "../src/core/pipelineSteps.js"
import { TrainingItem } from "../src/types/interfaces.js"
import { Validator } from "../src/renderer/validatorFramework.js"
import { Exporter, ExportOptions } from "../src/renderer/exportFormats.js"
function makeItem(id: number): TrainingItem{
    return {format: "text", text: "item " + id}
}
function makeContext(items: TrainingItem[]=[]): PipelineContext{
    return {items, metadata: {}, logs: [], variables: {}}
}
class TestStep extends PipelineStepBase{
    calls: string[]
    constructor(name: string){
        super(name)
        this.calls=[]
    }
    before(context: PipelineContext): PipelineContext{
        this.calls.push("before")
        return {...context, metadata: {...context.metadata, before: true}}
    }
    execute(context: PipelineContext): PipelineContext{
        this.calls.push("execute")
        return {...context, metadata: {...context.metadata, execute: true}}
    }
    after(context: PipelineContext, result: PipelineContext): PipelineContext{
        this.calls.push("after")
        return {...result, metadata: {...result.metadata, after: true}}
    }
}
function createPassingValidator(): Validator{
    return {name: "pass", enabled: true, threshold: 0.5, validate: ()=>({score: 1, passed: true, details: [], flags: []})}
}
function createFailingValidator(): Validator{
    return {name: "fail", enabled: true, threshold: 0.5, validate: ()=>({score: 0, passed: false, details: ["bad"], flags: ["error"]})}
}
describe("PipelineStepBase", ()=>{
    it("stores name from constructor", ()=>{
        let step=new TestStep("custom")
        expect(step.name).toBe("custom")
    })
    it("run calls before execute and after in order", async ()=>{
        let step=new TestStep("ordered")
        await step.run(makeContext())
        expect(step.calls).toEqual(["before", "execute", "after"])
    })
    it("before can modify context", async ()=>{
        let step=new TestStep("before-mod")
        let result=await step.run(makeContext())
        expect(result.metadata.before).toBe(true)
    })
    it("execute result flows to after", async ()=>{
        let step=new TestStep("flow")
        let result=await step.run(makeContext())
        expect(result.metadata.execute).toBe(true)
        expect(result.metadata.after).toBe(true)
    })
    it("after can modify result", async ()=>{
        let step=new TestStep("after-mod")
        let result=await step.run(makeContext())
        expect(result.metadata.after).toBe(true)
    })
    it("returns new context", async ()=>{
        let step=new TestStep("newctx")
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result).not.toBe(ctx)
    })
})
describe("MiddlewareStep", ()=>{
    it("runs inner step", async ()=>{
        let ran=false
        let inner={name: "inner", run: async (ctx: PipelineContext)=>{
            ran=true
            return ctx
        }}
        let step=new MiddlewareStep(inner)
        await step.run(makeContext())
        expect(ran).toBe(true)
    })
    it("runs before middleware", async ()=>{
        let called=false
        let inner={name: "inner", run: async (ctx: PipelineContext)=>ctx}
        let middleware: PipelineMiddleware={before: (ctx)=>{
            called=true
            return {...ctx, metadata: {...ctx.metadata, before: true}}
        }}
        let step=new MiddlewareStep(inner, [middleware])
        let result=await step.run(makeContext())
        expect(called).toBe(true)
        expect(result.metadata.before).toBe(true)
    })
    it("runs after middleware", async ()=>{
        let called=false
        let inner={name: "inner", run: async (ctx: PipelineContext)=>ctx}
        let middleware: PipelineMiddleware={after: (ctx, result)=>{
            called=true
            return {...result, metadata: {...result.metadata, after: true}}
        }}
        let step=new MiddlewareStep(inner, [middleware])
        let result=await step.run(makeContext())
        expect(called).toBe(true)
        expect(result.metadata.after).toBe(true)
    })
    it("runs multiple middleware in order", async ()=>{
        let order: string[]=[]
        let inner={name: "inner", run: async (ctx: PipelineContext)=>{
            order.push("inner")
            return ctx
        }}
        let middlewares: PipelineMiddleware[]=[
            {before: (ctx)=>{order.push("before1"); return ctx}, after: (ctx, result)=>{order.push("after1"); return result}},
            {before: (ctx)=>{order.push("before2"); return ctx}, after: (ctx, result)=>{order.push("after2"); return result}}
        ]
        let step=new MiddlewareStep(inner, middlewares)
        await step.run(makeContext())
        expect(order).toEqual(["before1", "before2", "inner", "after2", "after1"])
    })
    it("passes context through without middleware", async ()=>{
        let inner={name: "inner", run: async (ctx: PipelineContext)=>ctx}
        let step=new MiddlewareStep(inner)
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items).toEqual([makeItem(1)])
    })
    it("after receives inner result", async ()=>{
        let inner={name: "inner", run: async (ctx: PipelineContext)=>{
            return {...ctx, metadata: {...ctx.metadata, inner: true}}
        }}
        let middleware: PipelineMiddleware={after: (ctx, result)=>{
            expect(result.metadata.inner).toBe(true)
            return result
        }}
        let step=new MiddlewareStep(inner, [middleware])
        await step.run(makeContext())
    })
})
describe("FilterStep", ()=>{
    it("filters items by predicate", async ()=>{
        let step=new FilterStep({predicate: (item)=>item.text==="item 2"})
        let ctx=makeContext([makeItem(1), makeItem(2), makeItem(3)])
        let result=await step.run(ctx)
        expect(result.items).toEqual([makeItem(2)])
    })
    it("returns empty array when all fail", async ()=>{
        let step=new FilterStep({predicate: ()=>false})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items).toEqual([])
    })
})
describe("MapStep", ()=>{
    it("transforms items", async ()=>{
        let step=new MapStep({transform: (item)=>({...item, text: item.text + "-mapped"})})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items[0].text).toBe("item 1-mapped")
    })
    it("preserves item count", async ()=>{
        let step=new MapStep({transform: (item)=>item})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items.length).toBe(2)
    })
})
describe("BatchStep", ()=>{
    it("processes in default batches of 10", async ()=>{
        let batches: number[]=[]
        let step=new BatchStep({processor: (items)=>{
            batches.push(items.length)
            return items
        }})
        let ctx=makeContext(Array.from({length: 25}, (_, i)=>makeItem(i+1)))
        await step.run(ctx)
        expect(batches).toEqual([10, 10, 5])
    })
    it("respects batchSize", async ()=>{
        let batches: number[]=[]
        let step=new BatchStep({processor: (items)=>{
            batches.push(items.length)
            return items
        }, batchSize: 3})
        let ctx=makeContext([makeItem(1), makeItem(2), makeItem(3), makeItem(4), makeItem(5)])
        await step.run(ctx)
        expect(batches).toEqual([3, 2])
    })
    it("handles empty items", async ()=>{
        let called=false
        let step=new BatchStep({processor: ()=>{
            called=true
            return []
        }})
        await step.run(makeContext())
        expect(called).toBe(false)
    })
    it("concatenates processed results", async ()=>{
        let step=new BatchStep({processor: (items)=>items.map(item=>({...item, text: item.text + "-batch"}))})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items[0].text).toBe("item 1-batch")
        expect(result.items[1].text).toBe("item 2-batch")
    })
})
describe("ValidationStep", ()=>{
    it("flags failed items", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator()})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items.length).toBe(1)
        expect(result.items[0].metadata?.tags).toContain("validation_failed")
    })
    it("removes failed items when removeFailed=true", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator(), removeFailed: true})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items.length).toBe(0)
    })
    it("adds metadata validationResults", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator()})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.metadata.validationResults).toHaveLength(1)
        expect((result.metadata.validationResults as unknown as {passed: boolean}[])[0].passed).toBe(false)
    })
    it("keeps all items when removeFailed=false", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator()})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items.length).toBe(2)
    })
    it("keeps passed items unchanged", async ()=>{
        let step=new ValidationStep({validator: createPassingValidator()})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items[0].text).toBe("item 1")
        expect(result.items[0].metadata?.tags).toBeUndefined()
    })
    it("handles empty items", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator()})
        let result=await step.run(makeContext())
        expect(result.items.length).toBe(0)
        expect((result.metadata.validationResults as unknown as unknown[]).length).toBe(0)
    })
})
describe("ExportStep", ()=>{
    it("stores result in variables", async ()=>{
        let exporter: Exporter={name: "test", mimeType: "text/plain", extension: ".txt", export: (items)=>"exported " + items.length}
        let step=new ExportStep({exporter})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.variables.exportResult).toBe("exported 2")
    })
    it("passes options to exporter", async ()=>{
        let receivedOptions: ExportOptions|undefined
        let exporter: Exporter={name: "test", mimeType: "text/plain", extension: ".txt", export: (items, options)=>{
            receivedOptions=options
            return ""
        }}
        let step=new ExportStep({exporter, options: {pretty: true}})
        await step.run(makeContext())
        expect(receivedOptions?.pretty).toBe(true)
    })
})
describe("withMiddleware", ()=>{
    it("wraps step with middleware", async ()=>{
        let inner={name: "inner", run: async (ctx: PipelineContext)=>ctx}
        let middleware: PipelineMiddleware={before: (ctx)=>({...ctx, metadata: {...ctx.metadata, wrapped: true}})}
        let step=withMiddleware(inner, [middleware])
        let result=await step.run(makeContext())
        expect(result.metadata.wrapped).toBe(true)
    })
    it("returns MiddlewareStep", ()=>{
        let inner={name: "inner", run: async (ctx: PipelineContext)=>ctx}
        let step=withMiddleware(inner, [])
        expect(step).toBeInstanceOf(MiddlewareStep)
        expect(step.name).toBe("inner")
    })
})
describe("context updates", ()=>{
    it("FilterStep updates context.items", async ()=>{
        let step=new FilterStep({predicate: (item)=>item.text==="item 2"})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items).toEqual([makeItem(2)])
        expect(ctx.items.length).toBe(2)
    })
    it("MapStep updates context.items", async ()=>{
        let step=new MapStep({transform: (item)=>({...item, text: item.text + "!"})})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items[0].text).toBe("item 1!")
    })
    it("BatchStep updates context.items", async ()=>{
        let step=new BatchStep({processor: (items)=>items.map(item=>({...item, text: item.text + "-b"}))})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items[0].text).toBe("item 1-b")
    })
    it("ValidationStep updates context.items", async ()=>{
        let step=new ValidationStep({validator: createFailingValidator(), removeFailed: true})
        let ctx=makeContext([makeItem(1), makeItem(2)])
        let result=await step.run(ctx)
        expect(result.items.length).toBe(0)
    })
    it("ExportStep does not modify context.items", async ()=>{
        let exporter: Exporter={name: "test", mimeType: "text/plain", extension: ".txt", export: ()=>"out"}
        let step=new ExportStep({exporter})
        let ctx=makeContext([makeItem(1)])
        let result=await step.run(ctx)
        expect(result.items).toEqual([makeItem(1)])
    })
})
