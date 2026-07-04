import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { SimpleClaimExtractor, KeywordEntailmentScorer, HallucinationValidator, FactualConsistencyValidator, type ClaimExtractor, type EntailmentScorer } from "../../src/renderer/validators/hallucinationValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return { format: "instruction", instruction: "What?", input: "", output };
}
describe("SimpleClaimExtractor",()=>{
    test("splits sentences",()=>{
        let extractor=new SimpleClaimExtractor();
        let claims=extractor.extractClaims("The sky is blue. The sun is hot.");
        expect(claims.length).toBe(2);
        expect(claims[0]).toBe("The sky is blue");
        expect(claims[1]).toBe("The sun is hot");
    });
    test("filters questions",()=>{
        let extractor=new SimpleClaimExtractor();
        let claims=extractor.extractClaims("The sky is blue. Is it warm?");
        expect(claims.length).toBe(1);
        expect(claims[0]).toBe("The sky is blue");
    });
    test("filters uncertainty",()=>{
        let extractor=new SimpleClaimExtractor();
        let claims=extractor.extractClaims("The sky is blue. I think it will rain. Maybe it is cold. Perhaps tomorrow.");
        expect(claims.length).toBe(1);
        expect(claims[0]).toBe("The sky is blue");
    });
});
describe("KeywordEntailmentScorer",()=>{
    test("returns entailment for contained hypothesis", async ()=>{
        let scorer=new KeywordEntailmentScorer();
        let result=await scorer.scoreEntailment("the quick brown fox", "quick fox");
        expect(result.label).toBe("entailment");
        expect(result.score).toBe(0.9);
    });
    test("returns contradiction for unrelated", async ()=>{
        let scorer=new KeywordEntailmentScorer();
        let result=await scorer.scoreEntailment("the quick brown fox", "lazy dog sleeps");
        expect(result.label).toBe("contradiction");
        expect(result.score).toBe(0.1);
    });
    test("uses synonyms", async ()=>{
        let scorer=new KeywordEntailmentScorer({ synonyms: { canine: ["dog"] } });
        let result=await scorer.scoreEntailment("the canine barked loudly", "the dog barked");
        expect(result.label).toBe("entailment");
        expect(result.score).toBe(0.9);
    });
    test("returns neutral for partial overlap", async ()=>{
        let scorer=new KeywordEntailmentScorer();
        let result=await scorer.scoreEntailment("the quick brown fox", "the lazy dog");
        expect(result.label).toBe("neutral");
        expect(result.score).toBe(0.5);
    });
});
describe("HallucinationValidator",()=>{
    test("name is hallucination",()=>{
        let validator=new HallucinationValidator({ sourceText: "source" });
        expect(validator.name).toBe("hallucination");
    });
    test("threshold is 0.5",()=>{
        let validator=new HallucinationValidator({ sourceText: "source" });
        expect(validator.threshold).toBe(0.5);
    });
    test("flags unsupported claim", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "The sky is blue. The sun is hot." });
        let result=await validator.validate(makeItemWithOutput("The sky is green. The sun is hot."));
        expect(result.passed).toBe(false);
        expect(result.score).toBe(0.5);
        expect(result.flags.length).toBe(1);
        expect(result.flags[0]).toBe("The sky is green");
    });
    test("passes supported claims", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "The sky is blue. The sun is hot." });
        let result=await validator.validate(makeItemWithOutput("The sky is blue. The sun is hot."));
        expect(result.passed).toBe(true);
        expect(result.score).toBe(1);
        expect(result.flags.length).toBe(0);
    });
    test("returns per-claim details", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "The sky is blue." });
        let result=await validator.validate(makeItemWithOutput("The sky is blue."));
        expect(result.details.length).toBe(1);
        expect(result.details[0]).toContain("0.90");
        expect(result.details[0]).toContain("entailment");
    });
    test("handles no claims", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "The sky is blue." });
        let result=await validator.validate(makeItemWithOutput("Maybe?"));
        expect(result.passed).toBe(true);
        expect(result.score).toBe(1);
        expect(result.details.length).toBe(0);
        expect(result.flags.length).toBe(0);
    });
    test("handles empty source", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "" });
        let result=await validator.validate(makeItemWithOutput("The sky is blue."));
        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.flags.length).toBe(1);
    });
    test("uses custom claim extractor", async ()=>{
        let extractor: ClaimExtractor={
            extractClaims: () => ["custom claim"]
        };
        let validator=new HallucinationValidator({ sourceText: "custom claim", claimExtractor: extractor });
        let result=await validator.validate(makeItemWithOutput("anything"));
        expect(result.passed).toBe(true);
        expect(result.details.length).toBe(1);
    });
    test("uses custom entailment scorer", async ()=>{
        let scorer: EntailmentScorer={
            scoreEntailment: async () => ({ score: 0.6, label: "neutral" })
        };
        let validator=new HallucinationValidator({ sourceText: "source", entailmentScorer: scorer });
        let result=await validator.validate(makeItemWithOutput("A claim."));
        expect(result.passed).toBe(false);
        expect(result.flags.length).toBe(1);
    });
    test("extracts text from output", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "instruction", instruction: "", input: "", output: "alpha beta" };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
    test("extracts text from messages", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "alpha beta" }] };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
    test("extracts text from text field", async ()=>{
        let validator=new HallucinationValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "text", text: "alpha beta" };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
});
describe("FactualConsistencyValidator",()=>{
    test("name is factual-consistency",()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "source" });
        expect(validator.name).toBe("factual-consistency");
    });
    test("threshold is 0.7",()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "source" });
        expect(validator.threshold).toBe(0.7);
    });
    test("returns high score for supported answer", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "the quick brown fox" });
        let result=await validator.validate(makeItemWithOutput("quick brown fox"));
        expect(result.score).toBe(0.9);
        expect(result.passed).toBe(true);
    });
    test("returns low score for unsupported answer", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "the quick brown fox" });
        let result=await validator.validate(makeItemWithOutput("lazy dog sleeps"));
        expect(result.score).toBe(0.1);
        expect(result.passed).toBe(false);
    });
    test("uses custom threshold", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "the quick brown fox", threshold: 0.95 });
        let result=await validator.validate(makeItemWithOutput("quick brown fox"));
        expect(result.score).toBe(0.9);
        expect(result.passed).toBe(false);
    });
    test("returns consistency detail", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "the quick brown fox" });
        let result=await validator.validate(makeItemWithOutput("quick brown fox"));
        expect(result.details.length).toBe(1);
        expect(result.details[0]).toBe("consistency: 0.90");
    });
    test("uses custom entailment scorer", async ()=>{
        let scorer: EntailmentScorer={
            scoreEntailment: async () => ({ score: 0.2, label: "contradiction" })
        };
        let validator=new FactualConsistencyValidator({ sourceText: "source", entailmentScorer: scorer });
        let result=await validator.validate(makeItemWithOutput("anything"));
        expect(result.score).toBe(0.2);
        expect(result.passed).toBe(false);
    });
    test("extracts text from output", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "instruction", instruction: "", input: "", output: "alpha beta" };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
    test("extracts text from messages", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "alpha beta" }] };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
    test("extracts text from text field", async ()=>{
        let validator=new FactualConsistencyValidator({ sourceText: "alpha beta" });
        let item: TrainingItem={ format: "text", text: "alpha beta" };
        let result=await validator.validate(item);
        expect(result.passed).toBe(true);
    });
});
