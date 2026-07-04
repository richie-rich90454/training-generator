import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{
    parseGradeResponse,
    gradeItem,
    filterItem,
    filterBatch,
    summarizeGrades,
    DEFAULT_ADVERSARIAL_CONFIG,
    GRADING_PROMPT
}from"../src/renderer/adversarialFilter.js"
function makeMockProvider(name:string, response:string):Provider{
    return{
        name,
        async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
            return{text:response, tokens:5, provider:name}
        }
    }
}
function makeMockProviderWithSpy(name:string, response:string){
    let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
        return{text:response, tokens:5, provider:name}
    })
    let provider:Provider={name, generate}
    return{provider, generate}
}
function makeSequenceProvider(name:string, responses:string[]):Provider{
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
function makeFilterResult(score:number, accepted:boolean):import("../src/renderer/adversarialFilter.js").FilterResult{
    return{
        accepted,
        grade:{score, reason:"", issues:[], rawResponse:""},
        item:"",
        filteredOut:!accepted
    }
}
describe("parseGradeResponse", ()=>{
    it("with valid JSON returns score, reason, issues", ()=>{
        let response=JSON.stringify({score:0.85, reason:"good quality", issues:["minor typo"]})
        let result=parseGradeResponse(response)
        expect(result.score).toBe(0.85)
        expect(result.reason).toBe("good quality")
        expect(result.issues).toEqual(["minor typo"])
        expect(result.rawResponse).toBe(response)
    })
    it("with invalid JSON extracts score from text", ()=>{
        let response="The score: 0.7 based on quality"
        let result=parseGradeResponse(response)
        expect(result.score).toBe(0.7)
        expect(result.reason).toBe("parsed from text")
        expect(result.issues).toEqual([])
        expect(result.rawResponse).toBe(response)
    })
    it("clamps score to [0, 1]", ()=>{
        let high=parseGradeResponse(JSON.stringify({score:1.5}))
        expect(high.score).toBe(1)
        let low=parseGradeResponse(JSON.stringify({score:-0.5}))
        expect(low.score).toBe(0)
    })
    it("handles missing fields with defaults", ()=>{
        let result=parseGradeResponse(JSON.stringify({}))
        expect(result.score).toBe(0.5)
        expect(result.reason).toBe("")
        expect(result.issues).toEqual([])
    })
    it("handles NaN score", ()=>{
        let result=parseGradeResponse(JSON.stringify({score:"not-a-number"}))
        expect(result.score).toBe(0.5)
    })
    it("falls back to 0.5 when no score found in text", ()=>{
        let result=parseGradeResponse("no score here at all")
        expect(result.score).toBe(0.5)
        expect(result.reason).toBe("parsed from text")
    })
})
describe("gradeItem", ()=>{
    it("calls provider with grading prompt", async()=>{
        let{provider, generate}=makeMockProviderWithSpy("mock", JSON.stringify({score:0.9, reason:"excellent", issues:[]}))
        let result=await gradeItem(provider, "my training item")
        expect(generate).toHaveBeenCalledTimes(1)
        let[prompt, model, options]=generate.mock.calls[0]
        expect(prompt).toContain(GRADING_PROMPT)
        expect(prompt).toContain("my training item")
        expect(model).toBe(DEFAULT_ADVERSARIAL_CONFIG.model)
        expect(options).toBeUndefined()
        expect(result.score).toBe(0.9)
        expect(result.reason).toBe("excellent")
    })
    it("passes config model and options to provider", async()=>{
        let{provider, generate}=makeMockProviderWithSpy("mock", JSON.stringify({score:0.5}))
        let config={
            model:"custom-model",
            threshold:0.5,
            options:{temperature:0.3, max_tokens:100},
            dropBelowThreshold:true
        }
        await gradeItem(provider, "item", config)
        let[, model, options]=generate.mock.calls[0]
        expect(model).toBe("custom-model")
        expect(options).toEqual({temperature:0.3, max_tokens:100})
    })
})
describe("filterItem", ()=>{
    it("accepts item above threshold", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.8, reason:"good", issues:[]}))
        let result=await filterItem(provider, "good item", {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toBe(true)
        expect(result.filteredOut).toBe(false)
        expect(result.grade.score).toBe(0.8)
        expect(result.item).toBe("good item")
    })
    it("rejects item below threshold", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.2, reason:"poor", issues:["bad"]}))
        let result=await filterItem(provider, "bad item", {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toBe(false)
        expect(result.filteredOut).toBe(true)
        expect(result.grade.score).toBe(0.2)
    })
    it("with dropBelowThreshold=false does not filter out", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.1}))
        let result=await filterItem(provider, "bad item", {model:"m", threshold:0.5, dropBelowThreshold:false})
        expect(result.accepted).toBe(false)
        expect(result.filteredOut).toBe(false)
    })
    it("accepts item exactly at threshold", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.5}))
        let result=await filterItem(provider, "item", {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toBe(true)
        expect(result.filteredOut).toBe(false)
    })
})
describe("filterBatch", ()=>{
    it("returns correct acceptance and rejection rates", async()=>{
        let provider=makeSequenceProvider("mock", [
            JSON.stringify({score:0.9}),
            JSON.stringify({score:0.2}),
            JSON.stringify({score:0.8}),
            JSON.stringify({score:0.3})
        ])
        let result=await filterBatch(provider, ["a", "b", "c", "d"], {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toHaveLength(2)
        expect(result.rejected).toHaveLength(2)
        expect(result.acceptanceRate).toBe(0.5)
        expect(result.filterRate).toBe(0.5)
        expect(result.averageScore).toBeCloseTo((0.9+0.2+0.8+0.3)/4, 5)
    })
    it("with all accepted returns acceptanceRate=1", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.95}))
        let result=await filterBatch(provider, ["a", "b", "c"], {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toHaveLength(3)
        expect(result.rejected).toHaveLength(0)
        expect(result.acceptanceRate).toBe(1)
        expect(result.filterRate).toBe(0)
    })
    it("with all rejected returns filterRate=1", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.1}))
        let result=await filterBatch(provider, ["a", "b", "c"], {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toHaveLength(0)
        expect(result.rejected).toHaveLength(3)
        expect(result.acceptanceRate).toBe(0)
        expect(result.filterRate).toBe(1)
    })
    it("with empty items returns zero rates", async()=>{
        let provider=makeMockProvider("mock", JSON.stringify({score:0.9}))
        let result=await filterBatch(provider, [], {model:"m", threshold:0.5, dropBelowThreshold:true})
        expect(result.accepted).toHaveLength(0)
        expect(result.rejected).toHaveLength(0)
        expect(result.acceptanceRate).toBe(0)
        expect(result.filterRate).toBe(0)
        expect(result.averageScore).toBe(0)
    })
})
describe("summarizeGrades", ()=>{
    it("computes correct mean, median, min, max, stdDev", ()=>{
        let results=[
            makeFilterResult(0.9, true),
            makeFilterResult(0.1, false),
            makeFilterResult(0.5, true),
            makeFilterResult(0.7, true),
            makeFilterResult(0.3, false)
        ]
        let summary=summarizeGrades(results)
        expect(summary.count).toBe(5)
        expect(summary.mean).toBeCloseTo((0.9+0.1+0.5+0.7+0.3)/5, 5)
        expect(summary.min).toBe(0.1)
        expect(summary.max).toBe(0.9)
        // sorted: [0.1, 0.3, 0.5, 0.7, 0.9], median=0.5
        expect(summary.median).toBe(0.5)
        let mean=summary.mean
        let variance=results.reduce((sum, r)=>sum+(r.grade.score-mean)**2, 0)/results.length
        expect(summary.stdDev).toBeCloseTo(Math.sqrt(variance), 5)
    })
    it("computes median for even count as average of two middle values", ()=>{
        let results=[
            makeFilterResult(0.1, false),
            makeFilterResult(0.2, false),
            makeFilterResult(0.8, true),
            makeFilterResult(0.9, true)
        ]
        let summary=summarizeGrades(results)
        expect(summary.count).toBe(4)
        // sorted: [0.1, 0.2, 0.8, 0.9], median=(0.2+0.8)/2=0.5
        expect(summary.median).toBe(0.5)
        expect(summary.min).toBe(0.1)
        expect(summary.max).toBe(0.9)
    })
    it("with empty array returns zeros", ()=>{
        let summary=summarizeGrades([])
        expect(summary.count).toBe(0)
        expect(summary.mean).toBe(0)
        expect(summary.median).toBe(0)
        expect(summary.min).toBe(0)
        expect(summary.max).toBe(0)
        expect(summary.stdDev).toBe(0)
    })
    it("with single item has stdDev=0", ()=>{
        let results=[makeFilterResult(0.7, true)]
        let summary=summarizeGrades(results)
        expect(summary.count).toBe(1)
        expect(summary.mean).toBe(0.7)
        expect(summary.median).toBe(0.7)
        expect(summary.min).toBe(0.7)
        expect(summary.max).toBe(0.7)
        expect(summary.stdDev).toBe(0)
    })
})
describe("DEFAULT_ADVERSARIAL_CONFIG", ()=>{
    it("has threshold=0.5", ()=>{
        expect(DEFAULT_ADVERSARIAL_CONFIG.threshold).toBe(0.5)
    })
    it("has default model and dropBelowThreshold", ()=>{
        expect(DEFAULT_ADVERSARIAL_CONFIG.model).toBe("gpt-3.5-turbo")
        expect(DEFAULT_ADVERSARIAL_CONFIG.dropBelowThreshold).toBe(true)
    })
})
