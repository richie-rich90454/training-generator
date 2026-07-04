import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{
    autoRegenerate,
    autoRegenerateBatch,
    gradeItemLocal,
    regenerateItem,
    DEFAULT_REGENERATION_CONFIG
}from"../src/renderer/autoRegenerator.js"
import{GRADING_PROMPT}from"../src/renderer/adversarialFilter.js"
function gradeJson(score:number, issues:string[]=[]):string{
    return JSON.stringify({score, reason:`score ${score}`, issues, rawResponse:""})
}
function makeSpyProvider():{provider:Provider, generate:ReturnType<typeof vi.fn>, gradeResponses:string[], regenResponses:string[]}{
    let gradeResponses:string[]=[]
    let regenResponses:string[]=[]
    let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
        if(prompt.includes(GRADING_PROMPT)){
            let idx=gradeResponses.length
            let text=gradeResponses[idx]??gradeJson(0.5)
            return{text, tokens:5, provider:"mock"}
        }
        let idx=regenResponses.length
        let text=regenResponses[idx]??`regen-${idx}`
        return{text, tokens:5, provider:"mock"}
    })
    let provider:Provider={name:"mock-spy", generate}
    return{provider, generate, gradeResponses, regenResponses}
}
function makeFailingRegenProvider(gradeResponses:string[]):{provider:Provider, generate:ReturnType<typeof vi.fn>}{
    let gradeCalls=0
    let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
        if(prompt.includes(GRADING_PROMPT)){
            let text=gradeResponses[gradeCalls%gradeResponses.length]
            gradeCalls++
            return{text, tokens:5, provider:"mock"}
        }
        throw new Error("regeneration failed")
    })
    let provider:Provider={name:"mock-fail", generate}
    return{provider, generate}
}
describe("DEFAULT_REGENERATION_CONFIG", ()=>{
    it("has maxAttempts=2", ()=>{
        expect(DEFAULT_REGENERATION_CONFIG.maxAttempts).toBe(2)
    })
    it("has qualityThreshold=0.7", ()=>{
        expect(DEFAULT_REGENERATION_CONFIG.qualityThreshold).toBe(0.7)
    })
})
describe("gradeItemLocal", ()=>{
    it("calls provider with grading prompt and parses response", async()=>{
        let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
            return{text:gradeJson(0.85, ["minor issue"]), tokens:5, provider:"mock"}
        })
        let provider:Provider={name:"m", generate}
        let result=await gradeItemLocal(provider, "my item", "model-x")
        expect(generate).toHaveBeenCalledTimes(1)
        let[prompt, model]=generate.mock.calls[0]
        expect(prompt).toContain(GRADING_PROMPT)
        expect(prompt).toContain("my item")
        expect(model).toBe("model-x")
        expect(result.score).toBe(0.85)
        expect(result.issues).toEqual(["minor issue"])
    })
    it("passes options to provider.generate", async()=>{
        let provider:Provider={
            name:"m",
            async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
                expect(options?.temperature).toBe(0.5)
                return{text:gradeJson(0.5), tokens:1, provider:"m"}
            }
        }
        await gradeItemLocal(provider, "item", "m", {temperature:0.5})
    })
})
describe("regenerateItem", ()=>{
    it("adjusts temperature per attempt", async()=>{
        let{provider, generate}=makeSpyProvider()
        let config={
            maxAttempts:3,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1,
            options:{temperature:0.5}
        }
        let grade={score:0.3, reason:"low", issues:["bad"], rawResponse:""}
        await regenerateItem(provider, "orig-prompt", "model", config, grade, 1)
        await regenerateItem(provider, "orig-prompt", "model", config, grade, 2)
        await regenerateItem(provider, "orig-prompt", "model", config, grade, 3)
        let opts1=generate.mock.calls[0][2]as ProviderOptions
        let opts2=generate.mock.calls[1][2]as ProviderOptions
        let opts3=generate.mock.calls[2][2]as ProviderOptions
        expect(opts1.temperature).toBeCloseTo(0.6, 5)
        expect(opts2.temperature).toBeCloseTo(0.7, 5)
        expect(opts3.temperature).toBeCloseTo(0.8, 5)
    })
    it("clamps temperature to upper bound 1.0", async()=>{
        let{provider, generate}=makeSpyProvider()
        let config={
            maxAttempts:1,
            qualityThreshold:0.9,
            temperatureAdjustment:0.5,
            options:{temperature:0.9}
        }
        let grade={score:0.3, reason:"low", issues:[], rawResponse:""}
        await regenerateItem(provider, "p", "m", config, grade, 1)
        let opts=generate.mock.calls[0][2]as ProviderOptions
        expect(opts.temperature).toBe(1.0)
    })
    it("clamps temperature to lower bound 0", async()=>{
        let{provider, generate}=makeSpyProvider()
        let config={
            maxAttempts:1,
            qualityThreshold:0.9,
            temperatureAdjustment:0.5,
            options:{temperature:0.0}
        }
        let grade={score:0.3, reason:"low", issues:[], rawResponse:""}
        await regenerateItem(provider, "p", "m", config, grade, 1)
        let opts=generate.mock.calls[0][2]as ProviderOptions
        expect(opts.temperature).toBe(0.5)
    })
    it("uses fallback model when configured", async()=>{
        let{provider, generate}=makeSpyProvider()
        let config={
            maxAttempts:1,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1,
            fallbackModel:"fallback-model-x"
        }
        let grade={score:0.3, reason:"low", issues:[], rawResponse:""}
        await regenerateItem(provider, "p", "main-model", config, grade, 1)
        let model=generate.mock.calls[0][1]
        expect(model).toBe("fallback-model-x")
    })
    it("uses main model when no fallback configured", async()=>{
        let{provider, generate}=makeSpyProvider()
        let config={
            maxAttempts:1,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        }
        let grade={score:0.3, reason:"low", issues:[], rawResponse:""}
        await regenerateItem(provider, "p", "main-model", config, grade, 1)
        let model=generate.mock.calls[0][1]
        expect(model).toBe("main-model")
    })
})
describe("autoRegenerate", ()=>{
    it("with already-good item returns immediately with regenerated=false", async()=>{
        let provider:Provider={
            name:"m",
            generate:vi.fn(async(prompt:string):Promise<ProviderResult>=>{
                return{text:gradeJson(0.9, []), tokens:5, provider:"mock"}
            })
        }
        let result=await autoRegenerate(provider, "good item", "orig prompt", "model")
        expect(result.regenerated).toBe(false)
        expect(result.attempts).toBe(0)
        expect(result.originalItem).toBe("good item")
        expect(result.finalItem).toBe("good item")
        expect(result.originalGrade.score).toBe(0.9)
        expect(result.finalGrade.score).toBe(0.9)
        expect(result.allAttempts).toHaveLength(1)
        expect(result.allAttempts[0].attempt).toBe(0)
        expect(provider.generate).toHaveBeenCalledTimes(1)
    })
    it("with low-quality item attempts regeneration", async()=>{
        let gradeScores=[0.3, 0.4, 0.5]
        let gradeCalls=0
        let provider:Provider={
            name:"m",
            generate:vi.fn(async(prompt:string):Promise<ProviderResult>=>{
                if(prompt.includes(GRADING_PROMPT)){
                    let score=gradeScores[gradeCalls]
                    gradeCalls++
                    return{text:gradeJson(score, ["issue1"]), tokens:5, provider:"mock"}
                }
                return{text:"regenerated-item", tokens:5, provider:"mock"}
            })
        }
        let result=await autoRegenerate(provider, "bad item", "orig prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        })
        expect(result.originalGrade.score).toBe(0.3)
        expect(result.attempts).toBe(2)
        expect(result.allAttempts.length).toBe(3)
        expect(result.finalItem).toBe("regenerated-item")
    })
    it("stops when threshold reached", async()=>{
        let gradeScores=[0.3, 0.95, 0.99]
        let gradeCalls=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    let score=gradeScores[gradeCalls]
                    gradeCalls++
                    return{text:gradeJson(score), tokens:5, provider:"m"}
                }
                return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerate(provider, "item", "prompt", "model", {
            maxAttempts:5,
            qualityThreshold:0.7,
            temperatureAdjustment:0.1
        })
        expect(result.attempts).toBe(1)
        expect(result.finalGrade.score).toBe(0.95)
        expect(gradeCalls).toBe(2)
    })
    it("stops at maxAttempts even if threshold not reached", async()=>{
        let gradeCalls=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    gradeCalls++
                    return{text:gradeJson(0.4), tokens:5, provider:"m"}
                }
                return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerate(provider, "item", "prompt", "model", {
            maxAttempts:3,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        })
        expect(result.attempts).toBe(3)
        expect(gradeCalls).toBe(4)
        expect(result.finalGrade.score).toBe(0.4)
    })
    it("keeps best attempt even if threshold not reached", async()=>{
        let gradeScores=[0.3, 0.6, 0.45]
        let gradeCalls=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    let score=gradeScores[gradeCalls]
                    gradeCalls++
                    return{text:gradeJson(score), tokens:5, provider:"m"}
                }
                return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerate(provider, "orig", "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        })
        expect(result.finalGrade.score).toBe(0.6)
        expect(result.finalItem).toBe("regen-1")
        expect(result.regenerated).toBe(true)
    })
    it("handles regeneration failure gracefully", async()=>{
        let warnSpy=vi.spyOn(console, "warn").mockImplementation(()=>{})
        let{provider}=makeFailingRegenProvider([gradeJson(0.3, ["issue1"])])
        let result=await autoRegenerate(provider, "item", "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        })
        expect(result.originalGrade.score).toBe(0.3)
        expect(result.finalGrade.score).toBe(0.3)
        expect(result.finalItem).toBe("item")
        expect(result.regenerated).toBe(false)
        expect(result.attempts).toBe(0)
        expect(result.allAttempts).toHaveLength(1)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })
    it("adjusts temperature per attempt via autoRegenerate", async()=>{
        let gradeScores=[0.3, 0.4, 0.4]
        let gradeCalls=0
        let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
            if(prompt.includes(GRADING_PROMPT)){
                let score=gradeScores[gradeCalls]
                gradeCalls++
                return{text:gradeJson(score), tokens:5, provider:"m"}
            }
            return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
        })
        let provider:Provider={name:"m", generate}
        let config={
            maxAttempts:2,
            qualityThreshold:0.9,
            temperatureAdjustment:0.15,
            options:{temperature:0.5}
        }
        await autoRegenerate(provider, "item", "prompt", "model", config)
        let regenCalls=generate.mock.calls.filter((c:Parameters<typeof generate>)=>!c[0].includes(GRADING_PROMPT))
        expect(regenCalls).toHaveLength(2)
        let opts1=regenCalls[0][2]as ProviderOptions
        let opts2=regenCalls[1][2]as ProviderOptions
        expect(opts1.temperature).toBeCloseTo(0.65, 5)
        expect(opts2.temperature).toBeCloseTo(0.8, 5)
    })
    it("uses fallback model when configured", async()=>{
        let gradeCalls=0
        let generate=vi.fn(async(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>=>{
            if(prompt.includes(GRADING_PROMPT)){
                gradeCalls++
                return{text:gradeJson(0.3, ["issue"]), tokens:5, provider:"m"}
            }
            return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
        })
        let provider:Provider={name:"m", generate}
        let config={
            maxAttempts:1,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1,
            fallbackModel:"fallback-x"
        }
        await autoRegenerate(provider, "item", "prompt", "main-model", config)
        let regenCalls=generate.mock.calls.filter((c:Parameters<typeof generate>)=>!c[0].includes(GRADING_PROMPT))
        expect(regenCalls[0][1]).toBe("fallback-x")
    })
    it("returns allAttempts array including original at attempt 0", async()=>{
        let gradeScores=[0.3, 0.5, 0.6]
        let gradeCalls=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    let score=gradeScores[gradeCalls]
                    gradeCalls++
                    return{text:gradeJson(score), tokens:5, provider:"m"}
                }
                return{text:`regen-${gradeCalls}`, tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerate(provider, "orig-item", "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.9,
            temperatureAdjustment:0.1
        })
        expect(result.allAttempts).toHaveLength(3)
        expect(result.allAttempts[0].attempt).toBe(0)
        expect(result.allAttempts[0].item).toBe("orig-item")
        expect(result.allAttempts[0].grade.score).toBe(0.3)
        expect(result.allAttempts[1].attempt).toBe(1)
        expect(result.allAttempts[1].item).toBe("regen-1")
        expect(result.allAttempts[1].grade.score).toBe(0.5)
        expect(result.allAttempts[2].attempt).toBe(2)
        expect(result.allAttempts[2].item).toBe("regen-2")
        expect(result.allAttempts[2].grade.score).toBe(0.6)
    })
})
describe("autoRegenerateBatch", ()=>{
    it("correctly categorizes regenerated vs kept", async()=>{
        let itemAGrades=[0.9]
        let itemBGrades=[0.3, 0.8]
        let itemCGrades=[0.3, 0.4]
        let stateA=0, stateB=0, stateC=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    if(prompt.includes("item-a")){
                        let s=itemAGrades[stateA]
                        stateA++
                        return{text:gradeJson(s), tokens:5, provider:"m"}
                    }
                    else if(prompt.includes("item-b")){
                        let s=itemBGrades[stateB]
                        stateB++
                        return{text:gradeJson(s), tokens:5, provider:"m"}
                    }
                    else{
                        let s=itemCGrades[stateC]
                        stateC++
                        return{text:gradeJson(s), tokens:5, provider:"m"}
                    }
                }
                if(prompt.includes("item-a"))return{text:"item-a-regen", tokens:5, provider:"m"}
                if(prompt.includes("item-b"))return{text:"item-b-regen", tokens:5, provider:"m"}
                return{text:"item-c-regen", tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerateBatch(provider, ["item-a", "item-b", "item-c"], "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.7,
            temperatureAdjustment:0.1
        })
        expect(result.totalItems).toBe(3)
        expect(result.regeneratedCount).toBe(1)
        expect(result.keptCount).toBe(2)
        expect(result.kept[0].originalItem).toBe("item-a")
        expect(result.regenerated[0].originalItem).toBe("item-b")
    })
    it("computes correct average scores", async()=>{
        let itemAGrades=[0.9]
        let itemBGrades=[0.3, 0.8]
        let stateA=0, stateB=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    if(prompt.includes("item-a")){
                        let s=itemAGrades[stateA]
                        stateA++
                        return{text:gradeJson(s), tokens:5, provider:"m"}
                    }
                    let s=itemBGrades[stateB]
                    stateB++
                    return{text:gradeJson(s), tokens:5, provider:"m"}
                }
                return{text:"regen", tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerateBatch(provider, ["item-a", "item-b"], "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.7,
            temperatureAdjustment:0.1
        })
        let expectedOriginal=(0.9+0.3)/2
        let expectedFinal=(0.9+0.8)/2
        expect(result.averageOriginalScore).toBeCloseTo(expectedOriginal, 5)
        expect(result.averageFinalScore).toBeCloseTo(expectedFinal, 5)
    })
    it("computes score improvement", async()=>{
        let itemAGrades=[0.3, 0.8]
        let stateA=0
        let provider:Provider={
            name:"m",
            async generate(prompt:string):Promise<ProviderResult>{
                if(prompt.includes(GRADING_PROMPT)){
                    let s=itemAGrades[stateA]
                    stateA++
                    return{text:gradeJson(s), tokens:5, provider:"m"}
                }
                return{text:"regen", tokens:5, provider:"m"}
            }
        }
        let result=await autoRegenerateBatch(provider, ["item-a"], "prompt", "model", {
            maxAttempts:2,
            qualityThreshold:0.7,
            temperatureAdjustment:0.1
        })
        expect(result.scoreImprovement).toBeCloseTo(0.5, 5)
    })
    it("with empty items returns zeros", async()=>{
        let provider:Provider={
            name:"m",
            async generate():Promise<ProviderResult>{
                return{text:"", tokens:0, provider:"m"}
            }
        }
        let result=await autoRegenerateBatch(provider, [], "prompt", "model")
        expect(result.totalItems).toBe(0)
        expect(result.regeneratedCount).toBe(0)
        expect(result.keptCount).toBe(0)
        expect(result.regenerated).toHaveLength(0)
        expect(result.kept).toHaveLength(0)
        expect(result.averageOriginalScore).toBe(0)
        expect(result.averageFinalScore).toBe(0)
        expect(result.scoreImprovement).toBe(0)
    })
})
