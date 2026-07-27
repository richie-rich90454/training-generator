import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../src/types/index.js"
import { BaseValidator, ValidatorChain, CompositeValidator, MutatingValidator, createLegacyValidator, createDefaultValidatorChain, validateItemsV2, type ValidationResult, type Validator } from "../src/renderer/validatorFramework.js"
class PassValidator extends BaseValidator{
    constructor(name: string, options?: {enabled?: boolean; threshold?: number}){
        super(name, options)
    }
    validate(): ValidationResult{
        return this.buildResult(1, true, [], [])
    }
}
class ScoreValidator extends BaseValidator{
    score: number
    flags: string[]
    constructor(name: string, score: number, flags?: string[]){
        super(name)
        this.score=score
        this.flags=flags??[]
    }
    validate(): ValidationResult{
        return this.buildResult(this.score, this.score>=this.threshold, [], this.flags)
    }
}
class ToggleValidator extends BaseValidator{
    fail: boolean
    flag: string
    constructor(name: string, fail: boolean, flag?: string){
        super(name)
        this.fail=fail
        this.flag=flag??""
    }
    validate(): ValidationResult{
        if (this.fail){
            return this.buildResult(0, false, [this.flag], [this.flag])
        }
        return this.buildResult(1, true, [], [])
    }
}
class RedactValidator extends MutatingValidator{
    mutate(item: TrainingItem): TrainingItem{
        return {...item, output: "redacted"}
    }
    validate(item: TrainingItem): ValidationResult{
        return this.buildResult(item.output==="redacted"?1:0, item.output==="redacted", [], [])
    }
}
function makeItem(output: string): TrainingItem{
    return {format: "instruction", instruction: "What is 2+2?", input: "Compute", output}
}
describe("BaseValidator",()=>{
    test("buildResult fills defaults and provided values",()=>{
        let validator=new PassValidator("test")
        let result=validator.buildResult(0.8, true, ["detail"], ["flag"])
        expect(result.score).toBe(0.8)
        expect(result.passed).toBe(true)
        expect(result.details).toEqual(["detail"])
        expect(result.flags).toEqual(["flag"])
        let defaults=validator.buildResult(0.5, false)
        expect(defaults.details).toEqual([])
        expect(defaults.flags).toEqual([])
    })
    test("constructor applies options",()=>{
        let validator=new PassValidator("opt", {enabled: false, threshold: 0.9})
        expect(validator.enabled).toBe(false)
        expect(validator.threshold).toBe(0.9)
    })
    test("defaults when no options provided",()=>{
        let validator=new PassValidator("def")
        expect(validator.enabled).toBe(true)
        expect(validator.threshold).toBe(0.5)
    })
})
describe("ValidatorChain",()=>{
    test("one passing validator passes",async ()=>{
        let chain=new ValidatorChain([new PassValidator("pass")])
        let result=await chain.validate(makeItem("The answer is four because two plus two equals four."))
        expect(result.overallScore).toBe(1)
        expect(result.passed).toBe(true)
        expect(result.flags).toEqual([])
    })
    test("one failing validator fails",async ()=>{
        let chain=new ValidatorChain([new ToggleValidator("fail", true, "bad")])
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(0)
        expect(result.passed).toBe(false)
        expect(result.flags).toEqual(["bad"])
    })
    test("average score with two validators",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("a", 0.4), new ScoreValidator("b", 0.8)])
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBeCloseTo(0.6, 10)
        expect(result.passed).toBe(true)
    })
    test("flags union from validators",async ()=>{
        let chain=new ValidatorChain([new ToggleValidator("one", true, "x"), new ToggleValidator("two", true, "y")])
        let result=await chain.validate(makeItem("ok"))
        expect(result.flags).toEqual(["x", "y"])
    })
    test("add inserts validator",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("a", 0)])
        chain.add(new ScoreValidator("b", 1))
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(0.5)
    })
    test("remove deletes validator",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("a", 1), new ScoreValidator("b", 0)])
        chain.remove("b")
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(1)
        expect(Object.keys(result.results)).toEqual(["a"])
    })
    test("remove non-existent validator is no-op",()=>{
        let chain=new ValidatorChain([new PassValidator("a")])
        chain.remove("missing")
        expect(chain.validators.length).toBe(1)
    })
    test("setEnabled disables validator",async ()=>{
        let chain=new ValidatorChain([new PassValidator("pass"), new ToggleValidator("fail", true, "bad")])
        chain.setEnabled("fail", false)
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(1)
        expect(result.passed).toBe(true)
    })
    test("setEnabled enables validator",async ()=>{
        let pass=new PassValidator("pass", {enabled: false})
        let chain=new ValidatorChain([pass])
        chain.setEnabled("pass", true)
        let result=await chain.validate(makeItem("ok"))
        expect(result.passed).toBe(true)
    })
    test("empty chain returns zero score and fails",async ()=>{
        let chain=new ValidatorChain([])
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(0)
        expect(result.passed).toBe(false)
    })
    test("validateBatch returns correct length and indices",async ()=>{
        let chain=new ValidatorChain([new PassValidator("pass")])
        let batch=await chain.validateBatch([makeItem("a"), makeItem("b"), makeItem("c")])
        expect(batch.length).toBe(3)
        expect(batch[0].itemIndex).toBe(0)
        expect(batch[1].itemIndex).toBe(1)
        expect(batch[2].itemIndex).toBe(2)
    })
    test("overall passed respects threshold",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("a", 0.6), new ScoreValidator("b", 1)], 0.8)
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(0.8)
        expect(result.passed).toBe(true)
        let strict=new ValidatorChain([new ScoreValidator("a", 0.6), new ScoreValidator("b", 1)], 0.9)
        let strictResult=await strict.validate(makeItem("ok"))
        expect(strictResult.passed).toBe(false)
    })
    test("disabled validators excluded from average",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("a", 0), new ScoreValidator("b", 1), new ScoreValidator("c", 1)])
        chain.setEnabled("a", false)
        let result=await chain.validate(makeItem("ok"))
        expect(result.overallScore).toBe(1)
    })
})
describe("MutatingValidator",()=>{
    test("mutate changes item before validate",()=>{
        let validator=new RedactValidator("redact")
        let item=makeItem("sensitive data here")
        let mutated=validator.mutate(item)
        expect(mutated.output).toBe("redacted")
    })
    test("validateAndMutate returns result and mutated item",async ()=>{
        let validator=new RedactValidator("redact")
        let item=makeItem("sensitive data here")
        let {result, item: mutated}=await validator.validateAndMutate(item)
        expect(mutated.output).toBe("redacted")
        expect(result.score).toBe(1)
        expect(result.passed).toBe(true)
    })
})
describe("CompositeValidator",()=>{
    test("delegates to inner chain",async ()=>{
        let composite=new CompositeValidator("combo", [new ToggleValidator("a", false), new ToggleValidator("b", true)])
        let result=await composite.validate(makeItem("ok"))
        expect(result.score).toBe(0.5)
        expect(result.passed).toBe(true)
    })
    test("collects flags from inner chain",async ()=>{
        let composite=new CompositeValidator("combo", [new ToggleValidator("a", true, "x"), new ToggleValidator("b", true, "y")])
        let result=await composite.validate(makeItem("ok"))
        expect(result.flags).toEqual(["x", "y"])
    })
})
describe("createDefaultValidatorChain",()=>{
    test("includes legacy validator",()=>{
        let chain=createDefaultValidatorChain()
        let hasLegacy=chain.validators.some(v => v.name==="legacy" && v.enabled)
        expect(hasLegacy).toBe(true)
    })
})
describe("LegacyValidator",()=>{
    test("returns score one for clean item",async ()=>{
        let validator=createLegacyValidator()
        let result=await validator.validate(makeItem("The answer is four because two plus two equals four."))
        expect(result.score).toBe(1)
        expect(result.passed).toBe(true)
        expect(result.flags).toEqual([])
    })
    test("returns score zero and flags for bad item",async ()=>{
        let validator=createLegacyValidator()
        let item: TrainingItem={format: "instruction", instruction: "What?", input: "", output: ""}
        let result=await validator.validate(item)
        expect(result.score).toBe(0)
        expect(result.passed).toBe(false)
        expect(result.flags).toContain("missing_answer")
    })
})
describe("validateItemsV2",()=>{
    test("produces QualityReport shape",async ()=>{
        let report=await validateItemsV2([makeItem("The answer is four because two plus two equals four.")])
        expect(report.totalItems).toBe(1)
        expect(report.flaggedItems).toBe(0)
        expect(report.passRate).toBe(100)
        expect(Array.isArray(report.flags)).toBe(true)
        expect(typeof report.breakdown).toBe("object")
    })
    test("respects enabled and disabled validators",async ()=>{
        let chain=new ValidatorChain([new ScoreValidator("bad", 0), new ScoreValidator("good", 1)], 0.6)
        let enabledReport=await validateItemsV2([makeItem("x")], chain)
        expect(enabledReport.passRate).toBe(0)
        chain.setEnabled("bad", false)
        let disabledReport=await validateItemsV2([makeItem("x")], chain)
        expect(disabledReport.passRate).toBe(100)
    })
    test("breakdown counts reasons",async ()=>{
        let chain=new ValidatorChain([createLegacyValidator()])
        let items=[makeItem("short"), makeItem("")]
        let report=await validateItemsV2(items, chain)
        expect(report.breakdown["answer_too_short"]).toBe(1)
        expect(report.breakdown["missing_answer"]).toBe(1)
    })
    test("passRate matches flagged count",async ()=>{
        let items=[makeItem("The answer is four because two plus two equals four."), makeItem("The answer is four because two plus two equals four."), makeItem("The answer is four because two plus two equals four."), makeItem("short")]
        let report=await validateItemsV2(items)
        expect(report.totalItems).toBe(4)
        expect(report.flaggedItems).toBe(1)
        expect(report.passRate).toBe(75)
    })
})
