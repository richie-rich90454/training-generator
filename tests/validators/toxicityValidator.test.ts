import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { ToxicityValidator, RuleBasedToxicityScorer, TensorFlowToxicityScorer, DEFAULT_TOXICITY_WORDS, type ToxicityLabel, type ToxicityScorer } from "../../src/renderer/validators/toxicityValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return { format: "instruction", instruction: "What?", input: "", output }
}
describe("DEFAULT_TOXICITY_WORDS",()=>{
    test("has all labels",()=>{
        let labels: ToxicityLabel[]=["identity_attack", "insult", "obscene", "severe_toxicity", "sexual_explicit", "threat", "toxicity"]
        for (let label of labels){
            expect(DEFAULT_TOXICITY_WORDS[label]).toBeDefined()
        }
    })
    test("has at least three words per label",()=>{
        for (let label in DEFAULT_TOXICITY_WORDS){
            expect(DEFAULT_TOXICITY_WORDS[label as ToxicityLabel].length).toBeGreaterThanOrEqual(3)
        }
    })
})
describe("RuleBasedToxicityScorer",()=>{
    test("flags insult word", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["You are an idiot"])
        let insult=results[0].find(p => p.label==="insult")
        expect(insult?.match).toBe(true)
        expect(insult?.probability).toBe(1)
    })
    test("flags toxic word", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["This is garbage"])
        let toxicity=results[0].find(p => p.label==="toxicity")
        expect(toxicity?.match).toBe(true)
        expect(toxicity?.probability).toBe(1)
    })
    test("handles clean text", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["Clean helpful text"])
        let matches=results[0].filter(p => p.match)
        expect(matches.length).toBe(0)
        for (let prediction of results[0]){
            expect(prediction.probability).toBe(0)
        }
    })
    test("returns array of arrays shape", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["text one", "text two"])
        expect(results.length).toBe(2)
        expect(results[0].length).toBe(7)
        expect(results[1].length).toBe(7)
    })
    test("is case insensitive", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["You IDIOT"])
        let insult=results[0].find(p => p.label==="insult")
        expect(insult?.match).toBe(true)
    })
    test("uses whole word matching", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["You are moronic"])
        let insult=results[0].find(p => p.label==="insult")
        expect(insult?.match).toBe(false)
    })
    test("uses custom word lists", async ()=>{
        let scorer=new RuleBasedToxicityScorer({ wordLists: { insult: ["foo"] } as Record<ToxicityLabel, string[]> })
        let results=await scorer.classify(["You foo"])
        let insult=results[0].find(p => p.label==="insult")
        expect(insult?.match).toBe(true)
    })
    test("flags identity attack word", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["That is racist"])
        let identity=results[0].find(p => p.label==="identity_attack")
        expect(identity?.match).toBe(true)
    })
    test("flags severe toxicity word", async ()=>{
        let scorer=new RuleBasedToxicityScorer()
        let results=await scorer.classify(["You are worthless"])
        let severe=results[0].find(p => p.label==="severe_toxicity")
        expect(severe?.match).toBe(true)
    })
})
describe("TensorFlowToxicityScorer",()=>{
    test("throws when package missing", async ()=>{
        let scorer=new TensorFlowToxicityScorer()
        await expect(scorer.classify(["text"])).rejects.toThrow("@tensorflow-models/toxicity not installed")
    })
})
describe("ToxicityValidator",()=>{
    test("name is toxicity",()=>{
        let validator=new ToxicityValidator()
        expect(validator.name).toBe("toxicity")
    })
    test("threshold is 0.5",()=>{
        let validator=new ToxicityValidator()
        expect(validator.threshold).toBe(0.5)
    })
    test("flags toxic item", async ()=>{
        let validator=new ToxicityValidator()
        let result=await validator.validate(makeItemWithOutput("You idiot"))
        expect(result.passed).toBe(false)
        expect(result.flags.length).toBeGreaterThan(0)
    })
    test("passes clean item", async ()=>{
        let validator=new ToxicityValidator()
        let result=await validator.validate(makeItemWithOutput("Clean helpful response"))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("aggregates multiple labels", async ()=>{
        let validator=new ToxicityValidator()
        let result=await validator.validate(makeItemWithOutput("You idiot racist moron"))
        expect(result.passed).toBe(false)
        expect(result.flags).toContain("insult")
        expect(result.flags).toContain("identity_attack")
    })
    test("returns details per label", async ()=>{
        let validator=new ToxicityValidator()
        let result=await validator.validate(makeItemWithOutput("You idiot"))
        expect(result.details.some(d => d.startsWith("insult:"))).toBe(true)
    })
    test("respects custom threshold", async ()=>{
        let mockScorer: ToxicityScorer={
            classify: async (texts: string[]) => texts.map(() => [{ label: "toxicity" as ToxicityLabel, match: true, probability: 0.6 }])
        }
        let strictValidator=new ToxicityValidator({scorer: mockScorer, threshold: 0.7})
        let lenientValidator=new ToxicityValidator({scorer: mockScorer, threshold: 0.5})
        let strictResult=await strictValidator.validate(makeItemWithOutput("any"))
        let lenientResult=await lenientValidator.validate(makeItemWithOutput("any"))
        expect(strictValidator.threshold).toBe(0.7)
        expect(strictResult.passed).toBe(true)
        expect(lenientResult.passed).toBe(false)
    })
    test("handles messages format", async ()=>{
        let validator=new ToxicityValidator()
        let item: TrainingItem={ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "You idiot" }] }
        let result=await validator.validate(item)
        expect(result.passed).toBe(false)
        expect(result.flags.length).toBeGreaterThan(0)
    })
    test("handles text field", async ()=>{
        let validator=new ToxicityValidator()
        let item: TrainingItem={format: "text", text: "You idiot"}
        let result=await validator.validate(item)
        expect(result.passed).toBe(false)
        expect(result.flags.length).toBeGreaterThan(0)
    })
    test("uses custom scorer", async ()=>{
        let mockScorer: ToxicityScorer={
            classify: async (texts: string[]) => texts.map(() => [{ label: "toxicity" as ToxicityLabel, match: true, probability: 0.8 }])
        }
        let validator=new ToxicityValidator({ scorer: mockScorer })
        let result=await validator.validate(makeItemWithOutput("any"))
        expect(result.passed).toBe(false)
        expect(result.score).toBeCloseTo(0.2)
    })
    test("uses custom labels", async ()=>{
        let validator=new ToxicityValidator({labels: ["insult"] })
        let result=await validator.validate(makeItemWithOutput("You idiot racist"))
        expect(result.flags).toEqual(["insult"])
    })
})
