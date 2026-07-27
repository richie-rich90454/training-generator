import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { computeStats, LengthDistributionValidator, TokenDistributionAnalyzer } from "../../src/renderer/validators/lengthDistributionValidator.js"
function makeItem(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
describe("computeStats",()=>{
    test("computes mean",()=>{
        let stats=computeStats([1, 2, 3, 4, 5])
        expect(stats.mean).toBe(3)
    })
    test("computes population stdDev",()=>{
        let stats=computeStats([1, 2, 3, 4, 5])
        expect(stats.stdDev).toBe(Math.sqrt(2))
    })
    test("computes median for odd count",()=>{
        let stats=computeStats([1, 2, 3, 4, 5])
        expect(stats.median).toBe(3)
    })
    test("computes median for even count",()=>{
        let stats=computeStats([1, 2, 3, 4])
        expect(stats.median).toBe(2.5)
    })
    test("computes p95",()=>{
        let stats=computeStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
        expect(stats.p95).toBe(19)
    })
    test("handles empty array",()=>{
        let stats=computeStats([])
        expect(stats.count).toBe(0)
        expect(stats.mean).toBe(0)
        expect(stats.stdDev).toBe(0)
        expect(stats.min).toBe(0)
        expect(stats.max).toBe(0)
        expect(stats.median).toBe(0)
        expect(stats.p95).toBe(0)
    })
    test("handles single value",()=>{
        let stats=computeStats([42])
        expect(stats.mean).toBe(42)
        expect(stats.stdDev).toBe(0)
        expect(stats.min).toBe(42)
        expect(stats.max).toBe(42)
        expect(stats.median).toBe(42)
        expect(stats.p95).toBe(42)
    })
    test("computes min and max",()=>{
        let stats=computeStats([5, 1, 3, 2, 4])
        expect(stats.min).toBe(1)
        expect(stats.max).toBe(5)
    })
})
describe("LengthDistributionValidator",()=>{
    test("has correct name and threshold",()=>{
        let validator=new LengthDistributionValidator()
        expect(validator.name).toBe("length-distribution")
        expect(validator.threshold).toBe(0.5)
    })
    test("passes with insufficient history",()=>{
        let validator=new LengthDistributionValidator()
        let result=validator.validate(makeItem("hi"))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("does not flag normal item",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44))]
        validator.updateHistory(items)
        let result=validator.validate(makeItem("f".repeat(42)))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("flags length outlier",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44))]
        validator.updateHistory(items)
        let result=validator.validate(makeItem("x".repeat(200)))
        expect(result.flags).toContain("length_outlier")
    })
    test("flags token outlier",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(33)), makeItem("b".repeat(34)), makeItem("c".repeat(35)), makeItem("d".repeat(36)), makeItem("e".repeat(37))]
        validator.updateHistory(items)
        let result=validator.validate(makeItem("x".repeat(32)))
        expect(result.flags).toContain("token_outlier")
    })
    test("handles both outliers",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44))]
        validator.updateHistory(items)
        let result=validator.validate(makeItem(""))
        expect(result.score).toBe(0)
        expect(result.flags).toContain("length_outlier")
        expect(result.flags).toContain("token_outlier")
    })
    test("score is 0.5 for one outlier",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(39)), makeItem("b".repeat(40)), makeItem("c".repeat(41)), makeItem("d".repeat(42)), makeItem("e".repeat(43))]
        validator.updateHistory(items)
        let result=validator.validate(makeItem("x".repeat(38)))
        expect(result.score).toBe(0.5)
        expect(result.flags).toContain("length_outlier")
        expect(result.flags).not.toContain("token_outlier")
    })
    test("updateHistory appends to history",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44))]
        validator.updateHistory(items.slice(0, 2))
        validator.updateHistory(items.slice(2))
        let result=validator.validate(makeItem("f".repeat(42)))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
    })
    test("extracts text from messages assistant",()=>{
        let validator=new LengthDistributionValidator()
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "hi"}, {role: "assistant", content: "a".repeat(42)}]}
        validator.updateHistory([item, makeItem("b".repeat(40)), makeItem("c".repeat(41)), makeItem("d".repeat(43)), makeItem("e".repeat(44))])
        let result=validator.validate(item)
        expect(result.details).toContain("length: 42")
    })
    test("extracts text from text field",()=>{
        let validator=new LengthDistributionValidator()
        let item: TrainingItem={format: "text", text: "a".repeat(42)}
        validator.updateHistory([item, makeItem("b".repeat(40)), makeItem("c".repeat(41)), makeItem("d".repeat(43)), makeItem("e".repeat(44))])
        let result=validator.validate(item)
        expect(result.details).toContain("length: 42")
    })
})
describe("getHistogram",()=>{
    test("returns bins",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(10)), makeItem("b".repeat(20)), makeItem("c".repeat(30)), makeItem("d".repeat(40)), makeItem("e".repeat(50))]
        validator.updateHistory(items)
        let histogram=validator.getHistogram()
        expect(histogram.length).toBe(10)
        let total=0
        for (let bin of histogram){
            total+=bin.count
        }
        expect(total).toBe(5)
    })
    test("respects bin count",()=>{
        let validator=new LengthDistributionValidator()
        let items=[makeItem("a".repeat(10)), makeItem("b".repeat(20)), makeItem("c".repeat(30)), makeItem("d".repeat(40)), makeItem("e".repeat(50))]
        validator.updateHistory(items)
        let histogram=validator.getHistogram(5)
        expect(histogram.length).toBe(5)
    })
    test("returns empty histogram when no history",()=>{
        let validator=new LengthDistributionValidator()
        let histogram=validator.getHistogram()
        expect(histogram).toEqual([])
    })
})
describe("TokenDistributionAnalyzer",()=>{
    test("analyze returns stats",()=>{
        let analyzer=new TokenDistributionAnalyzer()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44))]
        let result=analyzer.analyze(items)
        expect(result.lengthStats.count).toBe(5)
        expect(result.tokenStats.count).toBe(5)
        expect(result.histogram.length).toBe(10)
        expect(result.outliers).toEqual([])
    })
    test("analyze finds outliers",()=>{
        let analyzer=new TokenDistributionAnalyzer()
        let items=[makeItem("a".repeat(40)), makeItem("b".repeat(41)), makeItem("c".repeat(42)), makeItem("d".repeat(43)), makeItem("e".repeat(44)), makeItem("x".repeat(200))]
        let result=analyzer.analyze(items)
        expect(result.outliers.length).toBeGreaterThan(0)
        expect(result.outliers[0].index).toBe(5)
        expect(result.outliers[0].reason).toContain("length_outlier")
    })
    test("handles empty items",()=>{
        let analyzer=new TokenDistributionAnalyzer()
        let result=analyzer.analyze([])
        expect(result.lengthStats.count).toBe(0)
        expect(result.tokenStats.count).toBe(0)
        expect(result.histogram).toEqual([])
        expect(result.outliers).toEqual([])
    })
})