import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { BiasValidator, DEFAULT_BIAS_TERMS, suggestAlternative, exportBiasReport, type BiasTerm } from "../../src/renderer/validators/biasValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
describe("DEFAULT_BIAS_TERMS",()=>{
    test("has all six categories",()=>{
        let categories=new Set<string>()
        for (let term of DEFAULT_BIAS_TERMS){
            categories.add(term.category)
        }
        expect(categories.size).toBe(6)
    })
    test("has at least three terms per category",()=>{
        let counts: Record<string, number>={}
        for (let term of DEFAULT_BIAS_TERMS){
            counts[term.category]=(counts[term.category]??0)+1
        }
        for (let category in counts){
            expect(counts[category]).toBeGreaterThanOrEqual(3)
        }
    })
})
describe("buildMatcher",()=>{
    test("creates regexes per category",()=>{
        let validator=new BiasValidator()
        let matchers=validator.buildMatcher(DEFAULT_BIAS_TERMS)
        expect(matchers.has("gender")).toBe(true)
        expect(matchers.has("racial")).toBe(true)
        expect(matchers.has("political")).toBe(true)
        expect(matchers.get("gender")?.length).toBeGreaterThan(0)
    })
})
describe("analyze",()=>{
    test("counts gendered term fireman",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("The fireman arrived.")
        expect(result.categories.gender).toBeDefined()
        expect(result.categories.gender?.count).toBe(1)
        expect(result.categories.gender?.terms).toContain("fireman")
    })
    test("counts racial term blacklist",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("Add it to the blacklist.")
        expect(result.categories.racial).toBeDefined()
        expect(result.categories.racial?.count).toBe(1)
        expect(result.categories.racial?.terms).toContain("blacklist")
    })
    test("counts political term",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("That libtard comment is wrong.")
        expect(result.categories.political).toBeDefined()
        expect(result.categories.political?.count).toBe(1)
        expect(result.categories.political?.terms).toContain("libtard")
    })
    test("handles multiple categories in same text",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("The fireman put the site on the blacklist after a libtard rant.")
        expect(result.totalFlags).toBe(3)
        expect(result.categories.gender?.count).toBe(1)
        expect(result.categories.racial?.count).toBe(1)
        expect(result.categories.political?.count).toBe(1)
    })
    test("returns score of one when no terms",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("Clean helpful text with no issues.")
        expect(result.totalFlags).toBe(0)
        expect(result.score).toBe(1)
    })
    test("decreases score as flags increase",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("fireman policeman chairman mankind blacklist whitelist")
        expect(result.totalFlags).toBe(6)
        expect(result.score).toBe(Math.max(0, 1-6*0.1))
    })
})
describe("suggestAlternative",()=>{
    test("returns suggestion when present",()=>{
        let term: BiasTerm={term: "fireman", category: "gender", severity: "medium", suggestion: "firefighter"}
        expect(suggestAlternative(term)).toBe("firefighter")
    })
    test("returns empty string when missing",()=>{
        let term: BiasTerm={term: "fireman", category: "gender", severity: "medium"}
        expect(suggestAlternative(term)).toBe("")
    })
})
describe("validate",()=>{
    test("name is bias",()=>{
        let validator=new BiasValidator()
        expect(validator.name).toBe("bias")
    })
    test("threshold is 0.5",()=>{
        let validator=new BiasValidator()
        expect(validator.threshold).toBe(0.5)
    })
    test("flags gendered text",()=>{
        let validator=new BiasValidator()
        let result=validator.validate(makeItemWithOutput("Ask the fireman."))
        expect(result.flags.length).toBeGreaterThan(0)
        expect(result.flags.some(f => f.includes("fireman"))).toBe(true)
    })
    test("flags racial text",()=>{
        let validator=new BiasValidator()
        let result=validator.validate(makeItemWithOutput("This is on the whitelist."))
        expect(result.flags.length).toBeGreaterThan(0)
        expect(result.flags.some(f => f.includes("whitelist"))).toBe(true)
    })
    test("passes clean text",()=>{
        let validator=new BiasValidator()
        let result=validator.validate(makeItemWithOutput("Clean helpful response."))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("returns score based on flags",()=>{
        let validator=new BiasValidator()
        let result=validator.validate(makeItemWithOutput("fireman blacklist libtard infidel old fart ghetto"))
        expect(result.score).toBe(Math.max(0, 1-6*0.1))
        expect(result.passed).toBe(false)
    })
    test("extracts text from messages assistant",()=>{
        let validator=new BiasValidator()
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "hi"}, {role: "assistant", content: "The fireman came."}]}
        let result=validator.validate(item)
        expect(result.flags.some(f => f.includes("fireman"))).toBe(true)
    })
    test("extracts text from text field",()=>{
        let validator=new BiasValidator()
        let item: TrainingItem={format: "text", text: "This is on the blacklist."}
        let result=validator.validate(item)
        expect(result.flags.some(f => f.includes("blacklist"))).toBe(true)
    })
    test("includes per-category details",()=>{
        let validator=new BiasValidator()
        let result=validator.validate(makeItemWithOutput("fireman and blacklist"))
        expect(result.details).toContain("gender: 1")
        expect(result.details).toContain("racial: 1")
    })
})
describe("options",()=>{
    test("wholeWord prevents partial matches",()=>{
        let validator=new BiasValidator({wholeWord: true})
        let result=validator.analyze("firemanship")
        expect(result.categories.gender).toBeUndefined()
    })
    test("wholeWord still matches full word",()=>{
        let validator=new BiasValidator({wholeWord: true})
        let result=validator.analyze("fireman")
        expect(result.categories.gender?.count).toBe(1)
    })
    test("caseSensitive option works",()=>{
        let validator=new BiasValidator({caseSensitive: true})
        let result=validator.analyze("Fireman")
        expect(result.categories.gender).toBeUndefined()
    })
    test("caseInsensitive by default",()=>{
        let validator=new BiasValidator()
        let result=validator.analyze("Fireman")
        expect(result.categories.gender?.count).toBe(1)
    })
    test("custom terms override defaults",()=>{
        let custom: BiasTerm[]=[{term: "xyz123", category: "gender", severity: "low"}]
        let validator=new BiasValidator({terms: custom})
        let result=validator.analyze("xyz123")
        expect(result.categories.gender?.count).toBe(1)
        expect(validator.analyze("fireman").categories.gender).toBeUndefined()
    })
})
describe("exportBiasReport",()=>{
    test("aggregates counts across items",()=>{
        let validator=new BiasValidator()
        let items=[makeItemWithOutput("fireman"), makeItemWithOutput("blacklist")]
        let report=exportBiasReport(items, validator)
        expect(report.categories.gender?.count).toBe(1)
        expect(report.categories.racial?.count).toBe(1)
        expect(report.totalFlags).toBe(2)
    })
    test("returns totalFlags across items",()=>{
        let validator=new BiasValidator()
        let items=[makeItemWithOutput("fireman blacklist"), makeItemWithOutput("libtard")]
        let report=exportBiasReport(items, validator)
        expect(report.totalFlags).toBe(3)
    })
    test("handles empty items array",()=>{
        let validator=new BiasValidator()
        let report=exportBiasReport([], validator)
        expect(report.totalFlags).toBe(0)
        expect(report.score).toBe(1)
    })
})
