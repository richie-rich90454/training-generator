// @vitest-environment node
import{describe, it, expect}from"vitest"
import{defaultScoreFn, runEnsemble, runEnsembleBatch}from"../src/renderer/ensembleProcessor.js"
import type{EnsembleConfig, EnsembleResult}from"../src/renderer/ensembleProcessor.js"
import type{Provider, ProviderResult}from"../src/renderer/provider.js"
function makeMockProvider(name:string, text:string, tokens:number=10, shouldFail:boolean=false):Provider{
    return{
        name,
        async generate(prompt:string):Promise<ProviderResult>{
            if(shouldFail)throw new Error(`${name} failed`)
            return{text, tokens, provider:name}
        }
    }
}
describe("defaultScoreFn", ()=>{
    it("returns positive score for valid JSON text", ()=>{
        let result:ProviderResult={text:JSON.stringify([{instruction:"do something", input:"context data here", output:"result"}]), tokens:10, provider:"test"}
        let score=defaultScoreFn(result, "prompt")
        expect(score).toBeGreaterThan(0)
    })
    it("returns low score for empty text", ()=>{
        let result:ProviderResult={text:"", tokens:10, provider:"test"}
        let score=defaultScoreFn(result, "prompt")
        expect(score).toBeLessThan(0)
        expect(score).toBe(-50)
    })
    it("penalizes error-like text", ()=>{
        let result:ProviderResult={text:"I'm sorry, I cannot help with that request", tokens:10, provider:"test"}
        let score=defaultScoreFn(result, "prompt")
        expect(score).toBeLessThan(0)
    })
    it("rewards longer text over shorter text", ()=>{
        let short:ProviderResult={text:"hi", tokens:10, provider:"test"}
        let long:ProviderResult={text:"This is a much longer piece of text that exceeds the fifty character threshold for additional scoring bonuses and rewards.", tokens:10, provider:"test"}
        let shortScore=defaultScoreFn(short, "prompt")
        let longScore=defaultScoreFn(long, "prompt")
        expect(longScore).toBeGreaterThan(shortScore)
    })
})
describe("runEnsemble", ()=>{
    it("picks highest-scoring result", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "hi", 10)],
            ["p2", makeMockProvider("p2", JSON.stringify([{instruction:"test", input:"data", output:"result"}]), 10)],
            ["p3", makeMockProvider("p3", "I'm sorry, I cannot help", 10)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"},
                {providerId:"p3", model:"m3"}
            ]
        }
        let result=await runEnsemble(providers, "prompt", config)
        expect(result.bestProviderId).toBe("p2")
        expect(result.bestModel).toBe("m2")
        expect(result.bestScore).toBeGreaterThan(result.allResults[0].score)
        expect(result.bestScore).toBeGreaterThan(result.allResults[2].score)
    })
    it("handles missing provider gracefully", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "hello world", 10)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"}
            ]
        }
        let result=await runEnsemble(providers, "prompt", config)
        let missing=result.allResults.find(r=>r.providerId==="p2")
        expect(missing).toBeDefined()
        expect(missing!.error).toContain("not found")
        expect(missing!.score).toBe(-Infinity)
        expect(result.bestProviderId).toBe("p1")
    })
    it("handles provider that throws", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "good response", 10)],
            ["p2", makeMockProvider("p2", "", 10, true)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"}
            ]
        }
        let result=await runEnsemble(providers, "prompt", config)
        let failed=result.allResults.find(r=>r.providerId==="p2")
        expect(failed).toBeDefined()
        expect(failed!.error).toBe("p2 failed")
        expect(failed!.score).toBe(-Infinity)
        expect(result.bestProviderId).toBe("p1")
    })
    it("throws when all models fail", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "", 10, true)],
            ["p2", makeMockProvider("p2", "", 10, true)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"}
            ]
        }
        await expect(runEnsemble(providers, "prompt", config)).rejects.toThrow(/All ensemble models failed/)
    })
    it("uses custom scoringFn when provided", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "short", 10)],
            ["p2", makeMockProvider("p2", "winner response", 10)],
            ["p3", makeMockProvider("p3", "longer text here that would normally score higher", 10)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"},
                {providerId:"p3", model:"m3"}
            ],
            scoringFn:(result:ProviderResult, prompt:string):number=>{
                if(result.text.includes("winner"))return 100
                return 1
            }
        }
        let result=await runEnsemble(providers, "prompt", config)
        expect(result.bestProviderId).toBe("p2")
        expect(result.bestScore).toBe(100)
    })
    it("returns perModelContribution with all models", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "hello", 10)],
            ["p2", makeMockProvider("p2", "world", 10)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"}
            ]
        }
        let result=await runEnsemble(providers, "prompt", config)
        expect(result.perModelContribution["p1/m1"]).toBeDefined()
        expect(result.perModelContribution["p2/m2"]).toBeDefined()
        expect(Object.keys(result.perModelContribution)).toHaveLength(2)
    })
    it("returns allResults with errors for failed models", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "ok", 10)],
            ["p2", makeMockProvider("p2", "", 10, true)],
            ["p3", makeMockProvider("p3", "ok too", 10)]
        ])
        let config:EnsembleConfig={
            models:[
                {providerId:"p1", model:"m1"},
                {providerId:"p2", model:"m2"},
                {providerId:"p3", model:"m3"}
            ]
        }
        let result=await runEnsemble(providers, "prompt", config)
        expect(result.allResults).toHaveLength(3)
        let failed=result.allResults.filter(r=>r.error)
        expect(failed).toHaveLength(1)
        expect(failed[0].providerId).toBe("p2")
    })
    it("with single model returns that model as best", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "only result", 10)]
        ])
        let config:EnsembleConfig={
            models:[{providerId:"p1", model:"m1"}]
        }
        let result=await runEnsemble(providers, "prompt", config)
        expect(result.bestProviderId).toBe("p1")
        expect(result.bestModel).toBe("m1")
        expect(result.best.text).toBe("only result")
        expect(result.allResults).toHaveLength(1)
    })
})
describe("runEnsembleBatch", ()=>{
    it("processes multiple prompts sequentially", async()=>{
        let providers=new Map<string, Provider>([
            ["p1", makeMockProvider("p1", "response", 10)]
        ])
        let config:EnsembleConfig={
            models:[{providerId:"p1", model:"m1"}]
        }
        let prompts=["prompt one", "prompt two", "prompt three"]
        let results=await runEnsembleBatch(providers, prompts, config)
        expect(results).toHaveLength(3)
        for(let r of results){
            expect(r.bestProviderId).toBe("p1")
            expect(r.best.text).toBe("response")
        }
    })
})
