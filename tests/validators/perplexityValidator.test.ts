import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { PerplexityValidator, buildTrigramModel, scoreText, perplexityFromScore, ReferenceModelScorer, type Scorer } from "../../src/renderer/validators/perplexityValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
describe("buildTrigramModel",()=>{
    test("builds map",()=>{
        let model=buildTrigramModel(["abc", "bcd"])
        expect(model.size).toBeGreaterThan(0)
        expect(model.get("abc")).toBe(1)
        expect(model.get("bcd")).toBe(1)
    })
})
describe("scoreText",()=>{
    test("returns finite number",()=>{
        let model=buildTrigramModel(["the quick brown fox"])
        let score=scoreText("the quick brown fox", model)
        expect(Number.isFinite(score)).toBe(true)
        expect(score).toBeGreaterThanOrEqual(0)
    })
    test("handles unseen trigrams with Laplace smoothing",()=>{
        let model=buildTrigramModel(["abc"])
        let score=scoreText("xyz", model)
        expect(Number.isFinite(score)).toBe(true)
    })
})
describe("perplexityFromScore",()=>{
    test("computes correctly",()=>{
        let p=perplexityFromScore(Math.log(4), 1)
        expect(p).toBeCloseTo(4, 5)
    })
    test("returns 0 for zero tokens",()=>{
        expect(perplexityFromScore(1, 0)).toBe(0)
    })
})
describe("PerplexityValidator",()=>{
    test("default threshold is 100",()=>{
        let validator=new PerplexityValidator()
        expect(validator.threshold).toBe(100)
    })
    test("name is perplexity",()=>{
        let validator=new PerplexityValidator()
        expect(validator.name).toBe("perplexity")
    })
    test("validate extracts text from output field",async ()=>{
        let validator=new PerplexityValidator()
        let result=await validator.validate(makeItemWithOutput("hello world"))
        expect(result.details[0]).toMatch(/^perplexity: /)
    })
    test("validate extracts text from messages assistant",async ()=>{
        let validator=new PerplexityValidator()
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "hi"}, {role: "assistant", content: "hello there"}]}
        let result=await validator.validate(item)
        expect(result.details[0]).toMatch(/^perplexity: /)
    })
    test("validate extracts text from text field",async ()=>{
        let validator=new PerplexityValidator()
        let item: TrainingItem={format: "text", text: "sample text"}
        let result=await validator.validate(item)
        expect(result.details[0]).toMatch(/^perplexity: /)
    })
    test("returns passed=true for low perplexity with mocked scorer",async ()=>{
        let scorer: Scorer={score: async () => ({logProb: Math.log(2), tokens: 1})}
        let validator=new PerplexityValidator({scorer})
        let result=await validator.validate(makeItemWithOutput("any text"))
        expect(result.passed).toBe(true)
    })
    test("returns passed=false for high perplexity with mocked scorer",async ()=>{
        let scorer: Scorer={score: async () => ({logProb: Math.log(200), tokens: 1})}
        let validator=new PerplexityValidator({scorer})
        let result=await validator.validate(makeItemWithOutput("any text"))
        expect(result.passed).toBe(false)
    })
    test("flags high_perplexity when failed",async ()=>{
        let scorer: Scorer={score: async () => ({logProb: Math.log(200), tokens: 1})}
        let validator=new PerplexityValidator({scorer})
        let result=await validator.validate(makeItemWithOutput("any text"))
        expect(result.flags).toContain("high_perplexity")
    })
    test("train builds model from examples",async ()=>{
        let validator=new PerplexityValidator()
        await validator.train([makeItemWithOutput("the quick brown fox")])
        let result=await validator.validate(makeItemWithOutput("the quick brown fox"))
        expect(result.passed).toBe(true)
        expect(result.details[0]).toMatch(/^perplexity: /)
    })
    test("validate uses trained model when no scorer",async ()=>{
        let validator=new PerplexityValidator()
        let trainingText="the quick brown fox jumps over the lazy dog"
        await validator.train([
            makeItemWithOutput(trainingText),
            makeItemWithOutput(trainingText),
            makeItemWithOutput(trainingText)
        ])
        let result=await validator.validate(makeItemWithOutput(trainingText))
        expect(result.passed).toBe(true)
        expect(result.details[0]).toMatch(/^perplexity: /)
    })
})
describe("ReferenceModelScorer",()=>{
    test("accepts modelName",()=>{
        let scorer=new ReferenceModelScorer({modelName: "gpt2"})
        expect(scorer.modelName).toBe("gpt2")
    })
    test("throws when transformers.js not installed",async ()=>{
        let scorer=new ReferenceModelScorer({modelName: "gpt2"})
        await expect(scorer.score("hello")).rejects.toThrow("transformers.js not installed")
    })
})
describe("result format",()=>{
    test("score is in [0,1]",async ()=>{
        let scorer: Scorer={score: async () => ({logProb: Math.log(50), tokens: 1})}
        let validator=new PerplexityValidator({scorer})
        let result=await validator.validate(makeItemWithOutput("text"))
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(1)
    })
    test("passed condition is strict less-than threshold",async ()=>{
        let scorer: Scorer={score: async () => ({logProb: Math.log(100), tokens: 1})}
        let validator=new PerplexityValidator({scorer})
        let result=await validator.validate(makeItemWithOutput("text"))
        expect(result.passed).toBe(false)
    })
})