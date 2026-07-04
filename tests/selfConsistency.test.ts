import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{normalizeAnswer, vote, selfConsistencyGenerate, DEFAULT_SC_CONFIG}from"../src/renderer/selfConsistency.js"
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
function makeFailingProvider(name:string, failCount:number):Provider{
    let calls=0
    return{
        name,
        async generate():Promise<ProviderResult>{
            calls++
            if(calls<=failCount)throw new Error(`${name} failed`)
            return{text:"success", tokens:5, provider:name}
        }
    }
}
describe("normalizeAnswer", ()=>{
    it("trims whitespace and lowercases", ()=>{
        expect(normalizeAnswer("  Hello World  ")).toBe("hello world")
    })
    it("removes trailing punctuation", ()=>{
        expect(normalizeAnswer("Hello.")).toBe("hello")
        expect(normalizeAnswer("Wait!?")).toBe("wait")
        expect(normalizeAnswer("Done...")).toBe("done")
    })
    it("normalizes JSON by sorting keys", ()=>{
        expect(normalizeAnswer('{"b":2,"a":1}')).toBe('{"a":1,"b":2}')
    })
    it("collapses multiple spaces", ()=>{
        expect(normalizeAnswer("hello   world")).toBe("hello world")
    })
})
describe("vote", ()=>{
    it("with clear majority returns correct winner", ()=>{
        let results=[r("A"), r("B"), r("A"), r("A"), r("B")]
        let result=vote(results)
        expect(result.winner.text).toBe("A")
        expect(result.voteCount).toBe(3)
        expect(result.confidence).toBe(3/5)
    })
    it("with tie returns first (highest count) as winner", ()=>{
        let results=[r("A"), r("B"), r("A"), r("B")]
        let result=vote(results)
        expect(result.winner.text).toBe("A")
        expect(result.voteCount).toBe(2)
        expect(result.confidence).toBe(0.5)
    })
    it("with single result returns that as winner with confidence=1", ()=>{
        let results=[r("X")]
        let result=vote(results)
        expect(result.winner.text).toBe("X")
        expect(result.voteCount).toBe(1)
        expect(result.confidence).toBe(1)
        expect(result.totalSamples).toBe(1)
    })
    it("with all different results returns confidence=1/samples", ()=>{
        let results=[r("A"), r("B"), r("C")]
        let result=vote(results)
        expect(result.confidence).toBe(1/3)
        expect(result.uniqueAnswers).toBe(3)
    })
    it("throws on empty array", ()=>{
        expect(()=>vote([])).toThrow("No results to vote on")
    })
    it("returns correct uniqueAnswers count", ()=>{
        let results=[r("A"), r("B"), r("A")]
        let result=vote(results)
        expect(result.uniqueAnswers).toBe(2)
    })
    it("returns distribution sorted by count descending", ()=>{
        let results=[r("A"), r("B"), r("A"), r("C")]
        let result=vote(results)
        expect(result.distribution[0].count).toBeGreaterThanOrEqual(result.distribution[1].count)
        expect(result.distribution[1].count).toBeGreaterThanOrEqual(result.distribution[2].count)
        expect(result.distribution[0].answer).toBe("A")
        expect(result.distribution[0].count).toBe(2)
    })
})
describe("selfConsistencyGenerate", ()=>{
    it("generates N samples and votes", async()=>{
        let provider=makeMockProvider("mock", ["answer"])
        let result=await selfConsistencyGenerate(provider, "prompt", "model", {samples:4, temperature:0.8})
        expect(result.winner.text).toBe("answer")
        expect(result.voteCount).toBe(4)
        expect(result.totalSamples).toBe(4)
        expect(result.uniqueAnswers).toBe(1)
    })
    it("handles partial failures (some samples error)", async()=>{
        let provider=makeFailingProvider("flaky", 2)
        let result=await selfConsistencyGenerate(provider, "prompt", "model", {samples:5, temperature:0.7})
        expect(result.winner.text).toBe("success")
        expect(result.totalSamples).toBe(3)
        expect(result.voteCount).toBe(3)
    })
    it("throws when all samples fail", async()=>{
        let provider:Provider={
            name:"bad",
            async generate():Promise<ProviderResult>{
                throw new Error("always fails")
            }
        }
        await expect(selfConsistencyGenerate(provider, "prompt", "model", {samples:3, temperature:0.7})).rejects.toThrow(/All 3 samples failed/)
    })
    it("uses configured temperature", async()=>{
        let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
            return{text:"answer", tokens:5, provider:"mock"}
        })
        let provider:Provider={name:"mock", generate}
        await selfConsistencyGenerate(provider, "prompt", "model", {samples:3, temperature:0.9})
        expect(generate).toHaveBeenCalledTimes(3)
        expect(generate).toHaveBeenCalledWith("prompt", "model", expect.objectContaining({temperature:0.9}))
    })
})
describe("DEFAULT_SC_CONFIG", ()=>{
    it("has samples=5, temperature=0.7", ()=>{
        expect(DEFAULT_SC_CONFIG.samples).toBe(5)
        expect(DEFAULT_SC_CONFIG.temperature).toBe(0.7)
    })
})
