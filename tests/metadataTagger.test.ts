import {describe, it, expect, vi, beforeEach} from "vitest"
import {
    parseTagResponse,
    estimateDifficulty,
    estimateTopic,
    estimateBloomLevel,
    tagItem,
    tagBatch,
    tagWithModel,
    getCachedTags,
    setCachedTags,
    clearTagCache,
    DEFAULT_TAGGING_CONFIG
} from "../src/renderer/metadataTagger.js"
import type {Provider, ProviderResult, ProviderOptions} from "../src/renderer/provider.js"
import type {ParsedTags} from "../src/renderer/metadataTagger.js"
function makeMockProvider(response:string, shouldFail:boolean=false):Provider{
    let generate=async(_prompt:string, _model:string, _options?:ProviderOptions):Promise<ProviderResult>=>{
        if(shouldFail)throw new Error("mock error")
        return{text:response, tokens:10, provider:"mock"}
    }
    return{name:"mock", generate:vi.fn(generate)}
}
describe("parseTagResponse", ()=>{
    it("returns all fields for valid JSON", ()=>{
        let response=JSON.stringify({difficulty:"easy", topic:"math", bloom_level:"apply"})
        let result=parseTagResponse(response)
        expect(result.difficulty).toBe("easy")
        expect(result.topic).toBe("math")
        expect(result.bloomLevel).toBe("apply")
    })
    it("returns empty object for invalid JSON", ()=>{
        let result=parseTagResponse("not json")
        expect(result).toEqual({})
    })
    it("returns undefined for invalid difficulty", ()=>{
        let response=JSON.stringify({difficulty:"invalid", topic:"math"})
        let result=parseTagResponse(response)
        expect(result.difficulty).toBeUndefined()
        expect(result.topic).toBe("math")
    })
    it("returns undefined for invalid bloom level", ()=>{
        let response=JSON.stringify({bloom_level:"invalid", topic:"math"})
        let result=parseTagResponse(response)
        expect(result.bloomLevel).toBeUndefined()
        expect(result.topic).toBe("math")
    })
    it("truncates long topic names to 100 chars", ()=>{
        let longTopic="a".repeat(150)
        let response=JSON.stringify({topic:longTopic})
        let result=parseTagResponse(response)
        expect(result.topic).toBeDefined()
        expect(result.topic!.length).toBe(100)
    })
    it("accepts both bloom_level and bloomLevel keys", ()=>{
        let response1=JSON.stringify({bloom_level:"apply"})
        let response2=JSON.stringify({bloomLevel:"apply"})
        expect(parseTagResponse(response1).bloomLevel).toBe("apply")
        expect(parseTagResponse(response2).bloomLevel).toBe("apply")
    })
})
describe("estimateDifficulty", ()=>{
    it("returns easy for short simple text", ()=>{
        let result=estimateDifficulty("Hello world.")
        expect(result).toBe("easy")
    })
    it("returns hard for long text with math", ()=>{
        let text="x".repeat(2500)+" $x^2+y^2$ "
        let result=estimateDifficulty(text)
        expect(result).toBe("hard")
    })
    it("returns medium for moderate text", ()=>{
        let text="concept ".repeat(100)+" function test(){}"
        let result=estimateDifficulty(text)
        expect(result).toBe("medium")
    })
})
describe("estimateTopic", ()=>{
    it("returns most frequent meaningful word", ()=>{
        let text="javascript is great javascript rocks javascript forever"
        let result=estimateTopic(text)
        expect(result).toBe("javascript")
    })
    it("returns general for empty text", ()=>{
        let result=estimateTopic("")
        expect(result).toBe("general")
    })
})
describe("estimateBloomLevel", ()=>{
    it("returns create for creative text", ()=>{
        let result=estimateBloomLevel("Please design and build a new system.")
        expect(result).toBe("create")
    })
    it("returns evaluate for evaluative text", ()=>{
        let result=estimateBloomLevel("Evaluate and judge the quality of this.")
        expect(result).toBe("evaluate")
    })
    it("returns remember as default", ()=>{
        let result=estimateBloomLevel("The sky is blue.")
        expect(result).toBe("remember")
    })
})
describe("tagItem", ()=>{
    it("uses heuristics when provider is null", async()=>{
        let result=await tagItem(null, "Please design a new system.")
        expect(result.bloomLevel).toBe("create")
        expect(result.difficulty).toBeDefined()
        expect(result.topic).toBeDefined()
    })
    it("uses model when provider is provided and returns tags", async()=>{
        let response=JSON.stringify({difficulty:"hard", topic:"physics", bloom_level:"analyze"})
        let mockProvider=makeMockProvider(response)
        let result=await tagItem(mockProvider, "some text about physics")
        expect(result.difficulty).toBe("hard")
        expect(result.topic).toBe("physics")
        expect(result.bloomLevel).toBe("analyze")
        expect(mockProvider.generate).toHaveBeenCalled()
    })
    it("falls back to heuristics on provider error", async()=>{
        let mockProvider=makeMockProvider("", true)
        let result=await tagItem(mockProvider, "Please design a new system.")
        expect(result.bloomLevel).toBe("create")
        expect(result.difficulty).toBeDefined()
        expect(result.topic).toBeDefined()
    })
})
describe("tagBatch", ()=>{
    it("processes multiple items", async()=>{
        let items=["Hello world.", "Please design something.", "Evaluate this argument."]
        let results=await tagBatch(null, items)
        expect(results).toHaveLength(3)
        expect(results[0]).toBeDefined()
        expect(results[1]).toBeDefined()
        expect(results[2]).toBeDefined()
    })
})
describe("tag cache", ()=>{
    beforeEach(()=>{
        clearTagCache()
    })
    it("set/get/clear works", ()=>{
        let tags:ParsedTags={difficulty:"easy", topic:"test"}
        setCachedTags("hash1", tags)
        expect(getCachedTags("hash1")).toEqual(tags)
        clearTagCache()
        expect(getCachedTags("hash1")).toBeUndefined()
    })
})
describe("DEFAULT_TAGGING_CONFIG", ()=>{
    it("has correct defaults", ()=>{
        expect(DEFAULT_TAGGING_CONFIG.model).toBe("gpt-3.5-turbo")
        expect(DEFAULT_TAGGING_CONFIG.enableDifficulty).toBe(true)
        expect(DEFAULT_TAGGING_CONFIG.enableTopic).toBe(true)
        expect(DEFAULT_TAGGING_CONFIG.enableBloom).toBe(true)
    })
})
