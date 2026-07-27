import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{
    parseCritiqueResponse,
    critiqueItem,
    reviseItem,
    refineItem,
    refineBatch,
    DEFAULT_REFINEMENT_CONFIG,
    CRITIQUE_PROMPT,
    REVISE_PROMPT
}from"../src/renderer/refinementLoop.js"
function r(text:string, provider:string="mock"):ProviderResult{
    return{text, tokens:5, provider}
}
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
function makeMockProviderWithCapture(name:string, responses:string[]){
    let calls:{prompt:string, model:string, options?:ProviderOptions}[]=[]
    let idx=0
    let provider:Provider={
        name,
        async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
            calls.push({prompt, model, options})
            let text=responses[idx%responses.length]
            idx++
            return{text, tokens:5, provider:name}
        }
    }
    return{provider, calls}
}
describe("parseCritiqueResponse", ()=>{
    it("parses valid JSON with score, issues, and suggestions", ()=>{
        let response=JSON.stringify({score:0.9, issues:["issue1", "issue2"], suggestions:["sug1"]})
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0.9)
        expect(result.issues).toEqual(["issue1", "issue2"])
        expect(result.suggestions).toEqual(["sug1"])
        expect(result.rawResponse).toBe(response)
    })
    it("extracts score from text when JSON is invalid", ()=>{
        let response="The score: 0.75 is good. Some text here."
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0.75)
        expect(result.issues).toEqual([])
        expect(result.suggestions).toEqual([])
        expect(result.rawResponse).toBe(response)
    })
    it("returns 0.5 default score when no score found in invalid JSON", ()=>{
        let response="not json and no score"
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0.5)
        expect(result.issues).toEqual([])
        expect(result.suggestions).toEqual([])
    })
    it("clamps score above 1 down to 1", ()=>{
        let response=JSON.stringify({score:1.5, issues:[], suggestions:[]})
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(1)
    })
    it("clamps score below 0 up to 0", ()=>{
        let response=JSON.stringify({score:-0.3, issues:[], suggestions:[]})
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0)
    })
    it("returns defaults for missing fields in valid JSON", ()=>{
        let response=JSON.stringify({})
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0.5)
        expect(result.issues).toEqual([])
        expect(result.suggestions).toEqual([])
        expect(result.rawResponse).toBe(response)
    })
    it("preserves issues and suggestions when score is missing", ()=>{
        let response=JSON.stringify({issues:["a"], suggestions:["b"]})
        let result=parseCritiqueResponse(response)
        expect(result.score).toBe(0.5)
        expect(result.issues).toEqual(["a"])
        expect(result.suggestions).toEqual(["b"])
    })
})
describe("critiqueItem", ()=>{
    it("calls provider with critique prompt and returns parsed result", async()=>{
        let critiqueJson=JSON.stringify({score:0.85, issues:["unclear"], suggestions:["add detail"]})
        let{provider, calls}=makeMockProviderWithCapture("mock", [critiqueJson])
        let result=await critiqueItem(provider, "training item here", "gpt-4")
        expect(result.score).toBe(0.85)
        expect(result.issues).toEqual(["unclear"])
        expect(result.suggestions).toEqual(["add detail"])
        expect(calls).toHaveLength(1)
        expect(calls[0].prompt).toContain(CRITIQUE_PROMPT)
        expect(calls[0].prompt).toContain("training item here")
        expect(calls[0].model).toBe("gpt-4")
    })
    it("forwards options to provider", async()=>{
        let critiqueJson=JSON.stringify({score:0.5, issues:[], suggestions:[]})
        let{provider, calls}=makeMockProviderWithCapture("mock", [critiqueJson])
        let opts:ProviderOptions={temperature:0.3, max_tokens:100}
        await critiqueItem(provider, "item", "model", opts)
        expect(calls[0].options).toBe(opts)
    })
})
describe("reviseItem", ()=>{
    it("calls provider with revision prompt and returns trimmed text", async()=>{
        let{provider, calls}=makeMockProviderWithCapture("mock", ["  revised item text  "])
        let critique={score:0.4, issues:["bad grammar"], suggestions:["fix it"], rawResponse:""}
        let result=await reviseItem(provider, "original item", critique, "model-x")
        expect(result).toBe("revised item text")
        expect(calls).toHaveLength(1)
        expect(calls[0].prompt).toContain(REVISE_PROMPT)
        expect(calls[0].prompt).toContain("original item")
        expect(calls[0].prompt).toContain("bad grammar")
        expect(calls[0].prompt).toContain("fix it")
        expect(calls[0].model).toBe("model-x")
    })
    it("forwards options to provider", async()=>{
        let{provider, calls}=makeMockProviderWithCapture("mock", ["revised"])
        let critique={score:0.4, issues:[], suggestions:[], rawResponse:""}
        let opts:ProviderOptions={temperature:0.5}
        await reviseItem(provider, "item", critique, "model", opts)
        expect(calls[0].options).toBe(opts)
    })
})
describe("refineItem", ()=>{
    it("stops when quality threshold is reached on first pass", async()=>{
        let critiqueJson=JSON.stringify({score:0.9, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critiqueJson, "should not be called"])
        let result=await refineItem(provider, "item", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.reachedThreshold).toBe(true)
        expect(result.passes).toBe(1)
        expect(result.finalScore).toBe(0.9)
        expect(result.revisions).toHaveLength(0)
        expect(result.critiques).toHaveLength(1)
        expect(result.finalItem).toBe("item")
    })
    it("stops when quality threshold is reached after revisions", async()=>{
        let lowCritique=JSON.stringify({score:0.5, issues:["vague"], suggestions:["be specific"]})
        let highCritique=JSON.stringify({score:0.85, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [lowCritique, "revised v1", highCritique, "should not be called"])
        let result=await refineItem(provider, "item", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.reachedThreshold).toBe(true)
        expect(result.passes).toBe(2)
        expect(result.finalScore).toBe(0.85)
        expect(result.revisions).toEqual(["revised v1"])
        expect(result.critiques).toHaveLength(2)
        expect(result.finalItem).toBe("revised v1")
    })
    it("runs max passes when threshold not reached", async()=>{
        let lowCritique=JSON.stringify({score:0.4, issues:["x"], suggestions:["y"]})
        let provider=makeMockProvider("mock", [lowCritique, "rev1", lowCritique, "rev2", lowCritique, "rev3"])
        let result=await refineItem(provider, "item", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.reachedThreshold).toBe(false)
        expect(result.passes).toBe(3)
        expect(result.finalScore).toBe(0.4)
        expect(result.revisions).toHaveLength(3)
        expect(result.critiques).toHaveLength(3)
        expect(result.finalItem).toBe("rev3")
    })
    it("returns reachedThreshold=true when score equals threshold", async()=>{
        let critique=JSON.stringify({score:0.8, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique])
        let result=await refineItem(provider, "item", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.reachedThreshold).toBe(true)
        expect(result.passes).toBe(1)
    })
    it("returns reachedThreshold=false when score below threshold after max passes", async()=>{
        let critique=JSON.stringify({score:0.79, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique, "rev1", critique, "rev2", critique, "rev3"])
        let result=await refineItem(provider, "item", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.reachedThreshold).toBe(false)
        expect(result.passes).toBe(3)
    })
    it("records all critiques and revisions across passes", async()=>{
        let c1=JSON.stringify({score:0.3, issues:["i1"], suggestions:["s1"]})
        let c2=JSON.stringify({score:0.5, issues:["i2"], suggestions:["s2"]})
        let c3=JSON.stringify({score:0.7, issues:["i3"], suggestions:["s3"]})
        let provider=makeMockProvider("mock", [c1, "rev1", c2, "rev2", c3, "rev3"])
        let result=await refineItem(provider, "orig", "model", {maxPasses:3, qualityThreshold:0.8})
        expect(result.critiques).toHaveLength(3)
        expect(result.critiques[0].score).toBe(0.3)
        expect(result.critiques[1].score).toBe(0.5)
        expect(result.critiques[2].score).toBe(0.7)
        expect(result.critiques[0].issues).toEqual(["i1"])
        expect(result.critiques[2].suggestions).toEqual(["s3"])
        expect(result.revisions).toEqual(["rev1", "rev2", "rev3"])
        expect(result.originalItem).toBe("orig")
        expect(result.finalItem).toBe("rev3")
    })
    it("uses critiqueModel and reviseModel when provided", async()=>{
        let critique=JSON.stringify({score:0.5, issues:[], suggestions:[]})
        let{provider, calls}=makeMockProviderWithCapture("mock", [critique, "rev1", critique, "rev2", critique, "rev3"])
        await refineItem(provider, "item", "default-model", {
            maxPasses:3,
            qualityThreshold:0.9,
            critiqueModel:"critique-model",
            reviseModel:"revise-model"
        })
        expect(calls[0].model).toBe("critique-model")
        expect(calls[1].model).toBe("revise-model")
        expect(calls[2].model).toBe("critique-model")
        expect(calls[3].model).toBe("revise-model")
    })
    it("with maxPasses=1 runs single pass without revision when threshold met", async()=>{
        let critique=JSON.stringify({score:0.95, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique])
        let result=await refineItem(provider, "item", "model", {maxPasses:1, qualityThreshold:0.8})
        expect(result.passes).toBe(1)
        expect(result.revisions).toHaveLength(0)
        expect(result.reachedThreshold).toBe(true)
    })
    it("with maxPasses=1 performs one critique and one revision when threshold not met", async()=>{
        let critique=JSON.stringify({score:0.5, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique, "rev1"])
        let result=await refineItem(provider, "item", "model", {maxPasses:1, qualityThreshold:0.8})
        expect(result.passes).toBe(1)
        expect(result.reachedThreshold).toBe(false)
        expect(result.revisions).toHaveLength(1)
        expect(result.finalItem).toBe("rev1")
    })
    it("uses DEFAULT_REFINEMENT_CONFIG when no config provided", async()=>{
        let critique=JSON.stringify({score:0.5, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique, "r1", critique, "r2", critique, "r3"])
        let result=await refineItem(provider, "item", "model")
        expect(result.passes).toBe(DEFAULT_REFINEMENT_CONFIG.maxPasses)
        expect(result.reachedThreshold).toBe(false)
    })
})
describe("refineBatch", ()=>{
    it("processes multiple items sequentially", async()=>{
        let critique=JSON.stringify({score:0.9, issues:[], suggestions:[]})
        let provider=makeMockProvider("mock", [critique])
        let items=["item1", "item2", "item3"]
        let results=await refineBatch(provider, items, "model", {maxPasses:3, qualityThreshold:0.8})
        expect(results).toHaveLength(3)
        expect(results[0].originalItem).toBe("item1")
        expect(results[0].reachedThreshold).toBe(true)
        expect(results[1].originalItem).toBe("item2")
        expect(results[2].originalItem).toBe("item3")
    })
    it("returns empty array for empty input", async()=>{
        let provider=makeMockProvider("mock", [])
        let results=await refineBatch(provider, [], "model")
        expect(results).toEqual([])
    })
    it("handles mixed threshold outcomes across items", async()=>{
        let high=JSON.stringify({score:0.9, issues:[], suggestions:[]})
        let low=JSON.stringify({score:0.4, issues:["x"], suggestions:["y"]})
        let provider=makeMockProvider("mock", [
            high,
            low, "rev1", low, "rev2", low, "rev3"
        ])
        let results=await refineBatch(provider, ["good-item", "bad-item"], "model", {maxPasses:3, qualityThreshold:0.8})
        expect(results).toHaveLength(2)
        expect(results[0].reachedThreshold).toBe(true)
        expect(results[0].passes).toBe(1)
        expect(results[1].reachedThreshold).toBe(false)
        expect(results[1].passes).toBe(3)
    })
})
describe("DEFAULT_REFINEMENT_CONFIG", ()=>{
    it("has maxPasses=3 and qualityThreshold=0.8", ()=>{
        expect(DEFAULT_REFINEMENT_CONFIG.maxPasses).toBe(3)
        expect(DEFAULT_REFINEMENT_CONFIG.qualityThreshold).toBe(0.8)
    })
})
