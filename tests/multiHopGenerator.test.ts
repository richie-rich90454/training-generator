import {describe, it, expect, vi} from "vitest"
import {
    parseMultiHopResponse,
    formatChunksForPrompt,
    generateMultiHopQuestion,
    generateMultiHopBatch,
    validateMultiHop,
    selectRandomChunks,
    DEFAULT_MULTIHOP_CONFIG
} from "../src/renderer/multiHopGenerator.js"
import type {Provider, ProviderResult, ProviderOptions} from "../src/renderer/provider.js"
import type {ChunkRef, MultiHopQuestion} from "../src/renderer/multiHopGenerator.js"
function makeMockProvider(response:string, shouldFail:boolean=false):Provider{
    let generate=async(_prompt:string, _model:string, _options?:ProviderOptions):Promise<ProviderResult>=>{
        if(shouldFail)throw new Error("mock error")
        return{text:response, tokens:10, provider:"mock"}
    }
    return{name:"mock", generate:vi.fn(generate)}
}
describe("parseMultiHopResponse", ()=>{
    it("returns all fields for valid JSON", ()=>{
        let response=JSON.stringify({
            question:"What connects A and B?",
            answer:"The connection is C",
            hops:3,
            source_chunks:[0, 2, 4],
            reasoning:"Used chunk 0 for A, chunk 2 for B, chunk 4 for C"
        })
        let result=parseMultiHopResponse(response)
        expect(result.question).toBe("What connects A and B?")
        expect(result.answer).toBe("The connection is C")
        expect(result.hops).toBe(3)
        expect(result.sourceChunks).toEqual([0, 2, 4])
        expect(result.reasoning).toBe("Used chunk 0 for A, chunk 2 for B, chunk 4 for C")
    })
    it("returns fallback for invalid JSON", ()=>{
        let result=parseMultiHopResponse("not json at all")
        expect(result.question).toBe("not json at all")
        expect(result.answer).toBe("")
        expect(result.hops).toBe(1)
        expect(result.sourceChunks).toEqual([])
        expect(result.reasoning).toBe("")
    })
    it("returns defaults for missing fields", ()=>{
        let response=JSON.stringify({question:"only question"})
        let result=parseMultiHopResponse(response)
        expect(result.question).toBe("only question")
        expect(result.answer).toBe("")
        expect(result.hops).toBe(1)
        expect(result.sourceChunks).toEqual([])
        expect(result.reasoning).toBe("")
    })
})
describe("formatChunksForPrompt", ()=>{
    it("formats chunks with index and label", ()=>{
        let chunks:ChunkRef[]=[
            {index:0, text:"Alpha content", label:"intro"},
            {index:1, text:"Beta content", label:"body"}
        ]
        let result=formatChunksForPrompt(chunks)
        expect(result).toContain("[Chunk 0] intro:")
        expect(result).toContain("Alpha content")
        expect(result).toContain("[Chunk 1] body:")
        expect(result).toContain("Beta content")
        expect(result).toContain("\n\n")
    })
})
describe("generateMultiHopQuestion", ()=>{
    it("throws when fewer than 2 chunks provided", async()=>{
        let mockProvider=makeMockProvider("{}")
        let chunks:ChunkRef[]=[{index:0, text:"only one", label:"a"}]
        await expect(generateMultiHopQuestion(mockProvider, chunks)).rejects.toThrow("at least 2 chunks")
    })
    it("calls provider and returns parsed question", async()=>{
        let response=JSON.stringify({
            question:"Q?",
            answer:"A",
            hops:2,
            source_chunks:[0, 1],
            reasoning:"r"
        })
        let mockProvider=makeMockProvider(response)
        let chunks:ChunkRef[]=[
            {index:0, text:"c1", label:"l1"},
            {index:1, text:"c2", label:"l2"}
        ]
        let result=await generateMultiHopQuestion(mockProvider, chunks)
        expect(mockProvider.generate).toHaveBeenCalled()
        expect(result.question).toBe("Q?")
        expect(result.answer).toBe("A")
        expect(result.hops).toBe(2)
        expect(result.sourceChunks).toEqual([0, 1])
    })
})
describe("generateMultiHopBatch", ()=>{
    it("generates multiple questions", async()=>{
        let response=JSON.stringify({
            question:"Q",
            answer:"A",
            hops:2,
            source_chunks:[0, 1],
            reasoning:"r"
        })
        let mockProvider=makeMockProvider(response)
        let chunks:ChunkRef[]=[
            {index:0, text:"c1", label:"l1"},
            {index:1, text:"c2", label:"l2"}
        ]
        let results=await generateMultiHopBatch(mockProvider, chunks, 3)
        expect(results).toHaveLength(3)
        expect(mockProvider.generate).toHaveBeenCalledTimes(3)
        expect(results[0].question).toBe("Q")
        expect(results[2].answer).toBe("A")
    })
})
describe("validateMultiHop", ()=>{
    it("accepts valid question with enough hops", ()=>{
        let q:MultiHopQuestion={
            question:"Q?",
            answer:"A",
            hops:2,
            sourceChunks:[0, 1],
            reasoning:"r"
        }
        let result=validateMultiHop(q)
        expect(result.valid).toBe(true)
        expect(result.reason).toBe("")
    })
    it("rejects question with too few hops", ()=>{
        let q:MultiHopQuestion={
            question:"Q?",
            answer:"A",
            hops:1,
            sourceChunks:[0, 1],
            reasoning:"r"
        }
        let result=validateMultiHop(q)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain("1 hops")
    })
    it("rejects question with too few source chunks", ()=>{
        let q:MultiHopQuestion={
            question:"Q?",
            answer:"A",
            hops:2,
            sourceChunks:[0],
            reasoning:"r"
        }
        let result=validateMultiHop(q)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain("source chunks")
    })
    it("rejects question missing question or answer", ()=>{
        let q:MultiHopQuestion={
            question:"",
            answer:"A",
            hops:2,
            sourceChunks:[0, 1],
            reasoning:"r"
        }
        let result=validateMultiHop(q)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain("Missing question or answer")
    })
    it("rejects question with negative chunk index", ()=>{
        let q:MultiHopQuestion={
            question:"Q?",
            answer:"A",
            hops:2,
            sourceChunks:[0, -1],
            reasoning:"r"
        }
        let result=validateMultiHop(q)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain("Negative chunk index")
    })
})
describe("selectRandomChunks", ()=>{
    it("returns all chunks when count >= chunks.length", ()=>{
        let chunks:ChunkRef[]=[
            {index:0, text:"a", label:"la"},
            {index:1, text:"b", label:"lb"}
        ]
        let result=selectRandomChunks(chunks, 5)
        expect(result).toHaveLength(2)
        expect(result).toEqual(chunks)
    })
    it("returns exactly count chunks", ()=>{
        let chunks:ChunkRef[]=[
            {index:0, text:"a", label:"la"},
            {index:1, text:"b", label:"lb"},
            {index:2, text:"c", label:"lc"},
            {index:3, text:"d", label:"ld"},
            {index:4, text:"e", label:"le"}
        ]
        let result=selectRandomChunks(chunks, 3)
        expect(result).toHaveLength(3)
        let indices=result.map(c=>c.index)
        let unique=new Set(indices)
        expect(unique.size).toBe(3)
        for(let r of result){
            expect(chunks).toContain(r)
        }
    })
    it("is deterministic with same seed", ()=>{
        let chunks:ChunkRef[]=[
            {index:0, text:"a", label:"la"},
            {index:1, text:"b", label:"lb"},
            {index:2, text:"c", label:"lc"},
            {index:3, text:"d", label:"ld"},
            {index:4, text:"e", label:"le"}
        ]
        let r1=selectRandomChunks(chunks, 3, 42)
        let r2=selectRandomChunks(chunks, 3, 42)
        expect(r1.map(c=>c.index)).toEqual(r2.map(c=>c.index))
    })
})
describe("DEFAULT_MULTIHOP_CONFIG", ()=>{
    it("has minHops=2 and maxHops=4", ()=>{
        expect(DEFAULT_MULTIHOP_CONFIG.minHops).toBe(2)
        expect(DEFAULT_MULTIHOP_CONFIG.maxHops).toBe(4)
        expect(DEFAULT_MULTIHOP_CONFIG.model).toBe("gpt-3.5-turbo")
    })
})
