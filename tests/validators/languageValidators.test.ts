import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import {
    COMMON_STOPWORDS,
    GrammarValidator,
    ReadingLevelValidator,
    CoverageValidator,
    CompletenessValidator,
    AmbiguityValidator
} from "../../src/renderer/validators/languageValidators.js"
function makeItemWithOutput(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
function makeItemWithMessages(content: string): TrainingItem{
    return {format: "chatml", messages: [{role: "user", content: "Question?"}, {role: "assistant", content: content}]}
}
function makeItemWithText(text: string): TrainingItem{
    return {format: "text", text}
}
describe("GrammarValidator",()=>{
    test("flags repeated words",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithOutput("The the quick brown fox."))
        expect(result.flags).toContain("repeated_words")
        expect(result.score).toBeLessThan(1)
    })
    test("flags double spaces",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithOutput("The  quick  brown  fox."))
        expect(result.flags).toContain("double_spaces")
        expect(result.score).toBeLessThan(1)
    })
    test("flags missing capitalization",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithOutput("Hello. world is nice."))
        expect(result.flags).toContain("missing_capitalization")
        expect(result.score).toBeLessThan(1)
    })
    test("flags confusables",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithOutput("Their going to the store."))
        expect(result.flags).toContain("confusables")
        expect(result.score).toBeLessThan(1)
    })
    test("passes clean text",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithOutput("The quick brown fox jumps over the lazy dog."))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("score decreases with issues",()=>{
        let validator=new GrammarValidator()
        let clean=validator.validate(makeItemWithOutput("Clean text here."))
        let dirty=validator.validate(makeItemWithOutput("The  the  quick. brown  fox. Their going."))
        expect(clean.score).toBeGreaterThan(dirty.score)
        expect(dirty.passed).toBe(false)
    })
    test("has name grammar and threshold 0.8",()=>{
        let validator=new GrammarValidator()
        expect(validator.name).toBe("grammar")
        expect(validator.threshold).toBe(0.8)
    })
})
describe("ReadingLevelValidator",()=>{
    test("computes flesch for simple text",()=>{
        let validator=new ReadingLevelValidator()
        let result=validator.validate(makeItemWithOutput("See the cat run. The cat is fast."))
        expect(result.passed).toBe(true)
        expect(result.score).toBeGreaterThan(0.5)
        expect(result.details[0]).toMatch(/flesch:/)
    })
    test("computes lower score for complex text",()=>{
        let validator=new ReadingLevelValidator()
        let simple=validator.validate(makeItemWithOutput("See the cat run."))
        let complex=validator.validate(makeItemWithOutput("The multifaceted heterogeneous configuration necessitates comprehensive analysis."))
        expect(complex.score).toBeLessThan(simple.score)
    })
    test("handles short text",()=>{
        let validator=new ReadingLevelValidator()
        let result=validator.validate(makeItemWithOutput("Hi."))
        expect(result.details[0]).toMatch(/flesch:/)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(1)
    })
    test("has name reading-level and threshold 0.5",()=>{
        let validator=new ReadingLevelValidator()
        expect(validator.name).toBe("reading-level")
        expect(validator.threshold).toBe(0.5)
    })
})
describe("CoverageValidator",()=>{
    test("high when answer covers source keywords",()=>{
        let source="The quick brown fox jumps over the lazy dog"
        let validator=new CoverageValidator({sourceText: source})
        let result=validator.validate(makeItemWithOutput("quick brown fox"))
        expect(result.score).toBeGreaterThan(0.5)
        expect(result.passed).toBe(true)
        expect(result.details[0]).toMatch(/coverage:/)
    })
    test("low when missing keywords",()=>{
        let source="The quick brown fox jumps over the lazy dog"
        let validator=new CoverageValidator({sourceText: source})
        let result=validator.validate(makeItemWithOutput("hello world"))
        expect(result.score).toBeLessThan(0.5)
        expect(result.passed).toBe(false)
    })
    test("ignores stopwords",()=>{
        let source="The quick brown fox jumps over the lazy dog"
        let validator=new CoverageValidator({sourceText: source})
        let result=validator.validate(makeItemWithOutput("the a an is of"))
        expect(result.score).toBe(0)
        expect(result.passed).toBe(false)
    })
    test("has name coverage and threshold 0.5",()=>{
        let validator=new CoverageValidator({sourceText: "source text"})
        expect(validator.name).toBe("coverage")
        expect(validator.threshold).toBe(0.5)
    })
})
describe("CompletenessValidator",()=>{
    test("high when answer addresses question",()=>{
        let item: TrainingItem={format: "instruction", instruction: "What is photosynthesis?", input: "", output: "Photosynthesis is the process plants use to convert light into energy."}
        let validator=new CompletenessValidator()
        let result=validator.validate(item)
        expect(result.score).toBeGreaterThan(0.5)
        expect(result.passed).toBe(true)
        expect(result.details[0]).toMatch(/completeness:/)
    })
    test("low when missing",()=>{
        let item: TrainingItem={format: "instruction", instruction: "What is photosynthesis?", input: "", output: "I do not know."}
        let validator=new CompletenessValidator()
        let result=validator.validate(item)
        expect(result.score).toBeLessThan(0.5)
        expect(result.passed).toBe(false)
    })
    test("ignores stopwords",()=>{
        let item: TrainingItem={format: "instruction", instruction: "What is the cat?", input: "", output: "The dog runs."}
        let validator=new CompletenessValidator()
        let result=validator.validate(item)
        expect(result.score).toBe(0)
    })
    test("has name completeness and threshold 0.5",()=>{
        let validator=new CompletenessValidator()
        expect(validator.name).toBe("completeness")
        expect(validator.threshold).toBe(0.5)
    })
})
describe("AmbiguityValidator",()=>{
    test("flags many vague pronouns",()=>{
        let validator=new AmbiguityValidator()
        let result=validator.validate(makeItemWithOutput("It is this and that. They said it. This is it."))
        expect(result.flags).toContain("vague_pronouns")
        expect(result.passed).toBe(false)
    })
    test("flags passive voice",()=>{
        let validator=new AmbiguityValidator()
        let result=validator.validate(makeItemWithOutput("The ball was kicked by the player."))
        expect(result.flags).toContain("passive_voice")
    })
    test("passes clean text",()=>{
        let validator=new AmbiguityValidator()
        let result=validator.validate(makeItemWithOutput("The player threw the ball."))
        expect(result.passed).toBe(true)
        expect(result.flags).toEqual([])
    })
    test("has name ambiguity and threshold 0.7",()=>{
        let validator=new AmbiguityValidator()
        expect(validator.name).toBe("ambiguity")
        expect(validator.threshold).toBe(0.7)
    })
})
describe("COMMON_STOPWORDS",()=>{
    test("includes common words",()=>{
        expect(COMMON_STOPWORDS).toContain("the")
        expect(COMMON_STOPWORDS).toContain("is")
        expect(COMMON_STOPWORDS).toContain("of")
    })
})
describe("format handling",()=>{
    test("GrammarValidator handles messages format",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithMessages("The  the quick."))
        expect(result.flags).toContain("double_spaces")
        expect(result.flags).toContain("repeated_words")
    })
    test("GrammarValidator handles text format",()=>{
        let validator=new GrammarValidator()
        let result=validator.validate(makeItemWithText("Their going."))
        expect(result.flags).toContain("confusables")
    })
    test("ReadingLevelValidator handles messages format",()=>{
        let validator=new ReadingLevelValidator()
        let result=validator.validate(makeItemWithMessages("See the cat run."))
        expect(result.details[0]).toMatch(/flesch:/)
    })
    test("ReadingLevelValidator handles text format",()=>{
        let validator=new ReadingLevelValidator()
        let result=validator.validate(makeItemWithText("The cat is fast."))
        expect(result.details[0]).toMatch(/flesch:/)
    })
    test("CoverageValidator handles messages format",()=>{
        let validator=new CoverageValidator({sourceText: "quick brown fox"})
        let result=validator.validate(makeItemWithMessages("quick brown"))
        expect(result.details[0]).toMatch(/coverage:/)
    })
    test("CoverageValidator handles text format",()=>{
        let validator=new CoverageValidator({sourceText: "quick brown fox"})
        let result=validator.validate(makeItemWithText("quick brown"))
        expect(result.details[0]).toMatch(/coverage:/)
    })
    test("CompletenessValidator handles messages format",()=>{
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "What is photosynthesis?"}, {role: "assistant", content: "Photosynthesis converts light into energy."}]}
        let validator=new CompletenessValidator()
        let result=validator.validate(item)
        expect(result.score).toBeGreaterThan(0)
        expect(result.details[0]).toMatch(/completeness:/)
    })
    test("CompletenessValidator handles text format",()=>{
        let item: TrainingItem={format: "text", text: "Photosynthesis converts light into energy.", instruction: "What is photosynthesis?"}
        let validator=new CompletenessValidator()
        let result=validator.validate(item)
        expect(result.score).toBeGreaterThan(0)
        expect(result.details[0]).toMatch(/completeness:/)
    })
    test("AmbiguityValidator handles messages format",()=>{
        let validator=new AmbiguityValidator()
        let result=validator.validate(makeItemWithMessages("It was thrown."))
        expect(result.flags.length).toBeGreaterThan(0)
    })
    test("AmbiguityValidator handles text format",()=>{
        let validator=new AmbiguityValidator()
        let result=validator.validate(makeItemWithText("It was thrown."))
        expect(result.flags.length).toBeGreaterThan(0)
    })
})
