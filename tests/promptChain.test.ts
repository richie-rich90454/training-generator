import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{
    PromptChain,
    createSimpleChain,
    COMMON_CHAIN_TEMPLATES
}from"../src/renderer/promptChain.js"
import type{ChainStep}from"../src/renderer/promptChain.js"
function makeMockProvider(name:string, responses:string[]):Provider{
    let calls=0
    return{
        name,
        async generate():Promise<ProviderResult>{
            let text=responses[calls%responses.length]
            calls++
            return{text, tokens:5, provider:name}
        }
    }
}
function makeCapturingProvider(name:string, responses:string[]):{
    provider:Provider
    calls:{prompt:string, model:string, options?:ProviderOptions}[]
}{
    let calls:{prompt:string, model:string, options?:ProviderOptions}[]=[]
    let idx=0
    let provider:Provider={
        name,
        async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
            calls.push({prompt, model, options})
            let text=responses[idx%responses.length]
            idx++
            return{text, tokens:10, provider:name}
        }
    }
    return{provider, calls}
}
describe("PromptChain constructor", ()=>{
    it("succeeds with valid steps", ()=>{
        let steps:ChainStep[]=[
            {id:"a", type:"custom", promptTemplate:"{{input}}"},
            {id:"b", type:"custom", promptTemplate:"{{a}}", dependsOn:["a"]}
        ]
        let chain=new PromptChain(steps)
        expect(chain.getSteps()).toHaveLength(2)
    })
    it("throws on duplicate step id", ()=>{
        let steps:ChainStep[]=[
            {id:"a", type:"custom", promptTemplate:"{{input}}"},
            {id:"a", type:"custom", promptTemplate:"{{input}}"}
        ]
        expect(()=>new PromptChain(steps)).toThrow("Duplicate step id: a")
    })
    it("throws on unknown dependency", ()=>{
        let steps:ChainStep[]=[
            {id:"a", type:"custom", promptTemplate:"{{input}}", dependsOn:["missing"]}
        ]
        expect(()=>new PromptChain(steps)).toThrow("depends on unknown step: missing")
    })
})
describe("PromptChain.execute", ()=>{
    it("runs all steps sequentially", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["out1", "out2", "out3"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"step1: {{input}}"},
            {id:"s2", type:"custom", promptTemplate:"step2: {{input}}"},
            {id:"s3", type:"custom", promptTemplate:"step3: {{input}}"}
        ])
        let result=await chain.execute(provider, "initial", "default-model")
        expect(result.steps).toHaveLength(3)
        expect(result.steps.map(s=>s.stepId)).toEqual(["s1", "s2", "s3"])
        expect(calls).toHaveLength(3)
    })
    it("passes output of each step as input to next", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["FIRST", "SECOND"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}"},
            {id:"s2", type:"custom", promptTemplate:"{{input}}"}
        ])
        let result=await chain.execute(provider, "start", "m")
        expect(result.steps[0].output).toBe("FIRST")
        expect(result.steps[1].input).toBe("FIRST")
        expect(result.steps[1].output).toBe("SECOND")
        expect(result.finalOutput).toBe("SECOND")
        expect(calls[1].prompt).toBe("FIRST")
    })
    it("resolves {{input}} placeholder", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["out"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"PREFIX: {{input}} SUFFIX"}
        ])
        await chain.execute(provider, "myInput", "m")
        expect(calls[0].prompt).toBe("PREFIX: myInput SUFFIX")
    })
    it("resolves {{stepId}} placeholder for dependencies", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["summary", "final"])
        let chain=new PromptChain([
            {id:"summarize", type:"summarize", promptTemplate:"Summarize: {{input}}"},
            {id:"qa", type:"generate", promptTemplate:"Q&A from: {{summarize}}", dependsOn:["summarize"]}
        ])
        await chain.execute(provider, "text", "m")
        expect(calls[1].prompt).toBe("Q&A from: summary")
    })
    it("uses step.model when specified, otherwise defaultModel", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["a", "b"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}", model:"custom-model"},
            {id:"s2", type:"custom", promptTemplate:"{{input}}"}
        ])
        await chain.execute(provider, "in", "default-model")
        expect(calls[0].model).toBe("custom-model")
        expect(calls[1].model).toBe("default-model")
    })
    it("applies inputTransform when provided", async()=>{
        let{provider, calls}=makeCapturingProvider("mock", ["out"])
        let chain=new PromptChain([
            {
                id:"s1",
                type:"custom",
                promptTemplate:"{{input}}",
                inputTransform:(input)=>input.toUpperCase()
            }
        ])
        await chain.execute(provider, "lowercase", "m")
        expect(calls[0].prompt).toBe("LOWERCASE")
    })
    it("applies outputTransform when provided", async()=>{
        let provider=makeMockProvider("mock", ["raw output"])
        let chain=new PromptChain([
            {
                id:"s1",
                type:"custom",
                promptTemplate:"{{input}}",
                outputTransform:(output)=>output.trim().toUpperCase()
            }
        ])
        let result=await chain.execute(provider, "in", "m")
        expect(result.steps[0].output).toBe("RAW OUTPUT")
        expect(result.finalOutput).toBe("RAW OUTPUT")
    })
    it("returns success=true on completion", async()=>{
        let provider=makeMockProvider("mock", ["a", "b"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}"},
            {id:"s2", type:"custom", promptTemplate:"{{input}}"}
        ])
        let result=await chain.execute(provider, "in", "m")
        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
    })
    it("returns success=false and error on failure", async()=>{
        let provider:Provider={
            name:"failer",
            async generate():Promise<ProviderResult>{
                throw new Error("boom")
            }
        }
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}"}
        ])
        let result=await chain.execute(provider, "in", "m")
        expect(result.success).toBe(false)
        expect(result.error).toBe("boom")
    })
    it("tracks totalTokens and totalDurationMs", async()=>{
        let provider=makeMockProvider("mock", ["a", "b"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}"},
            {id:"s2", type:"custom", promptTemplate:"{{input}}"}
        ])
        let result=await chain.execute(provider, "in", "m")
        expect(result.totalTokens).toBe(10)
        expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
        expect(result.totalDurationMs).toBeLessThanOrEqual(result.steps[0].durationMs+result.steps[1].durationMs+100)
    })
})
describe("PromptChain.executeBatch", ()=>{
    it("processes multiple inputs", async()=>{
        let provider=makeMockProvider("mock", ["a", "b", "c", "d"])
        let chain=new PromptChain([
            {id:"s1", type:"custom", promptTemplate:"{{input}}"},
            {id:"s2", type:"custom", promptTemplate:"{{input}}"}
        ])
        let results=await chain.executeBatch(provider, ["in1", "in2"], "m")
        expect(results).toHaveLength(2)
        expect(results[0].success).toBe(true)
        expect(results[1].success).toBe(true)
        expect(results[0].finalOutput).toBe("b")
        expect(results[1].finalOutput).toBe("d")
    })
})
describe("createSimpleChain", ()=>{
    it("creates a chain from simple step definitions", ()=>{
        let chain=createSimpleChain([
            {id:"a", prompt:"{{input}}"},
            {id:"b", prompt:"{{a}}", model:"special"}
        ])
        let steps=chain.getSteps()
        expect(steps).toHaveLength(2)
        expect(steps[0].type).toBe("custom")
        expect(steps[1].type).toBe("custom")
        expect(steps[0].promptTemplate).toBe("{{input}}")
        expect(steps[1].model).toBe("special")
    })
})
describe("COMMON_CHAIN_TEMPLATES", ()=>{
    it("has at least 3 templates", ()=>{
        expect(COMMON_CHAIN_TEMPLATES.length).toBeGreaterThanOrEqual(3)
    })
    it("\"summarize-then-qa\" has correct step structure", ()=>{
        let template=COMMON_CHAIN_TEMPLATES.find(t=>t.name==="summarize-then-qa")
        expect(template).toBeDefined()
        expect(template!.steps).toHaveLength(2)
        expect(template!.steps[0].id).toBe("summarize")
        expect(template!.steps[0].type).toBe("summarize")
        expect(template!.steps[1].id).toBe("qa")
        expect(template!.steps[1].type).toBe("generate")
        expect(template!.steps[1].dependsOn).toEqual(["summarize"])
        expect(template!.steps[1].promptTemplate).toContain("{{summarize}}")
    })
})
