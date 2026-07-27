import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { MockEmbeddingService, cosineSimilarity, SemanticDedupValidator, DiversityValidator } from "../../src/renderer/validators/diversityValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
describe("cosineSimilarity",()=>{
    test("identical vectors return 1",()=>{
        let a=[1,0,0]
        let b=[1,0,0]
        expect(cosineSimilarity(a,b)).toBeCloseTo(1,10)
    })
    test("orthogonal vectors return 0",()=>{
        let a=[1,0,0]
        let b=[0,1,0]
        expect(cosineSimilarity(a,b)).toBeCloseTo(0,10)
    })
    test("zero vector returns 0",()=>{
        let a=[0,0,0]
        let b=[1,2,3]
        expect(cosineSimilarity(a,b)).toBe(0)
    })
})
describe("MockEmbeddingService",()=>{
    test("returns consistent embeddings for same text",async ()=>{
        let service=new MockEmbeddingService()
        let e1=await service.embed(["hello"])
        let e2=await service.embed(["hello"])
        expect(e1[0]).toEqual(e2[0])
    })
    test("maps different texts to different buckets",async ()=>{
        let service=new MockEmbeddingService()
        let embeddings=await service.embed(["a","b","c","d","e","f","g","h"])
        let seen=new Set<string>()
        for (let embedding of embeddings){
            let key=embedding.join(",")
            expect(seen.has(key)).toBe(false)
            seen.add(key)
        }
    })
    test("produces unit vectors",async ()=>{
        let service=new MockEmbeddingService()
        let embeddings=await service.embed(["a"])
        let vec=embeddings[0]
        let len=Math.sqrt(vec.reduce((sum,v) => sum+v*v,0))
        expect(len).toBeCloseTo(1,10)
    })
    test("same text has cosine similarity 1",async ()=>{
        let service=new MockEmbeddingService()
        let e1=await service.embed(["foo"])
        let e2=await service.embed(["foo"])
        expect(cosineSimilarity(e1[0],e2[0])).toBeCloseTo(1,10)
    })
    test("different buckets are orthogonal",async ()=>{
        let service=new MockEmbeddingService()
        let embeddings=await service.embed(["a","b"])
        expect(cosineSimilarity(embeddings[0],embeddings[1])).toBeCloseTo(0,10)
    })
})
describe("SemanticDedupValidator",()=>{
    test("name is semantic-dedup",()=>{
        let validator=new SemanticDedupValidator()
        expect(validator.name).toBe("semantic-dedup")
    })
    test("marks exact duplicate",async ()=>{
        let validator=new SemanticDedupValidator()
        let item=makeItemWithOutput("duplicate text")
        await validator.validate(item)
        let result=await validator.validate(item)
        expect(result.passed).toBe(false)
        expect(result.score).toBe(0)
    })
    test("allows distinct text",async ()=>{
        let validator=new SemanticDedupValidator()
        let result1=await validator.validate(makeItemWithOutput("a"))
        let result2=await validator.validate(makeItemWithOutput("b"))
        expect(result1.passed).toBe(true)
        expect(result2.passed).toBe(true)
        expect(result2.score).toBe(1)
    })
    test("respects threshold",async ()=>{
        let validator=new SemanticDedupValidator({similarityThreshold: 1})
        let item1=makeItemWithOutput("a")
        let item2=makeItemWithOutput("a2")
        await validator.validate(item1)
        let result=await validator.validate(item2)
        expect(result.passed).toBe(true)
    })
    test("reset clears state",async ()=>{
        let validator=new SemanticDedupValidator()
        let item=makeItemWithOutput("reset test")
        await validator.validate(item)
        validator.reset()
        let result=await validator.validate(item)
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
    })
    test("flags semantic_duplicate",async ()=>{
        let validator=new SemanticDedupValidator()
        let item=makeItemWithOutput("flag test")
        await validator.validate(item)
        let result=await validator.validate(item)
        expect(result.flags).toContain("semantic_duplicate")
    })
    test("extracts text from messages assistant",async ()=>{
        let validator=new SemanticDedupValidator()
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "hi"}, {role: "assistant", content: "assistant reply"}]}
        let result=await validator.validate(item)
        expect(result.passed).toBe(true)
    })
    test("extracts text from text field",async ()=>{
        let validator=new SemanticDedupValidator()
        let item: TrainingItem={format: "text", text: "plain text"}
        let result=await validator.validate(item)
        expect(result.passed).toBe(true)
    })
})
describe("DiversityValidator",()=>{
    test("name is diversity",()=>{
        let validator=new DiversityValidator()
        expect(validator.name).toBe("diversity")
    })
    test("clusters similar items",async ()=>{
        let validator=new DiversityValidator()
        await validator.validate(makeItemWithOutput("a"))
        await validator.validate(makeItemWithOutput("a2"))
        expect(validator.clusters.length).toBe(1)
    })
    test("separates dissimilar items into different clusters",async ()=>{
        let validator=new DiversityValidator()
        await validator.validate(makeItemWithOutput("a"))
        await validator.validate(makeItemWithOutput("b"))
        expect(validator.clusters.length).toBe(2)
    })
    test("flags cluster_too_large",async ()=>{
        let validator=new DiversityValidator({maxClusterSize: 2})
        await validator.validate(makeItemWithOutput("a"))
        await validator.validate(makeItemWithOutput("a2"))
        let result=await validator.validate(makeItemWithOutput("ab"))
        expect(result.flags).toContain("cluster_too_large")
        expect(result.passed).toBe(false)
    })
    test("allows items under maxClusterSize",async ()=>{
        let validator=new DiversityValidator({maxClusterSize: 5})
        let result=await validator.validate(makeItemWithOutput("a"))
        expect(result.passed).toBe(true)
        expect(result.flags).not.toContain("cluster_too_large")
    })
    test("score decreases as cluster grows",async ()=>{
        let validator=new DiversityValidator({maxClusterSize: 4})
        let r1=await validator.validate(makeItemWithOutput("a"))
        let r2=await validator.validate(makeItemWithOutput("a2"))
        let r3=await validator.validate(makeItemWithOutput("ab"))
        expect(r1.score).toBeGreaterThan(r2.score)
        expect(r2.score).toBeGreaterThan(r3.score)
    })
    test("uses custom maxClusterSize",async ()=>{
        let validator=new DiversityValidator({maxClusterSize: 3})
        await validator.validate(makeItemWithOutput("a"))
        await validator.validate(makeItemWithOutput("a2"))
        let result=await validator.validate(makeItemWithOutput("ab"))
        expect(result.passed).toBe(false)
        expect(result.score).toBe(0)
    })
    test("reset clears clusters",async ()=>{
        let validator=new DiversityValidator()
        await validator.validate(makeItemWithOutput("a"))
        validator.reset()
        expect(validator.clusters.length).toBe(0)
    })
})
