// @vitest-environment node
import {describe, it, expect} from "vitest"
import {FewShotBuffer, formatExamplesForPrompt, injectExamples, createRingBuffer, DEFAULT_FEW_SHOT_CONFIG} from "../src/renderer/fewShotInjector.js"
describe("FewShotBuffer.add", ()=>{
    it("adds example to buffer", ()=>{
        let buffer=new FewShotBuffer()
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        expect(buffer.size()).toBe(1)
    })
    it("rejects example below quality threshold", ()=>{
        let buffer=new FewShotBuffer()
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.5})
        expect(buffer.size()).toBe(0)
    })
    it("maintains buffer size by evicting oldest", ()=>{
        let buffer=new FewShotBuffer({bufferSize:2, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9})
        expect(buffer.size()).toBe(2)
        let examples=buffer.toJSON()
        expect(examples[0].input).toBe("q2")
        expect(examples[1].input).toBe("q3")
    })
})
describe("FewShotBuffer.getExamples", ()=>{
    it("returns examples sorted by quality descending", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.8})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.95})
        buffer.add({input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9})
        let examples=buffer.getExamples()
        expect(examples.length).toBe(3)
        expect(examples[0].qualityScore).toBe(0.95)
        expect(examples[1].qualityScore).toBe(0.9)
        expect(examples[2].qualityScore).toBe(0.8)
    })
    it("limits to maxExamplesPerPrompt", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:2})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q4", output:"a4", processingType:"instruction", qualityScore:0.9})
        let examples=buffer.getExamples()
        expect(examples.length).toBe(2)
    })
    it("filters by processingType", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:10})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"conversation", qualityScore:0.9})
        buffer.add({input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9})
        let examples=buffer.getExamples(10, "instruction")
        expect(examples.length).toBe(2)
        expect(examples.every(e=>e.processingType==="instruction")).toBe(true)
    })
    it("returns empty array when buffer empty", ()=>{
        let buffer=new FewShotBuffer()
        let examples=buffer.getExamples()
        expect(examples).toEqual([])
    })
})
describe("FewShotBuffer.size", ()=>{
    it("returns correct count", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9})
        expect(buffer.size()).toBe(2)
    })
})
describe("FewShotBuffer.clear", ()=>{
    it("empties the buffer", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.clear()
        expect(buffer.size()).toBe(0)
    })
})
describe("FewShotBuffer.setConfig", ()=>{
    it("updates config", ()=>{
        let buffer=new FewShotBuffer()
        buffer.setConfig({maxExamplesPerPrompt:5})
        let config=buffer.getConfig()
        expect(config.maxExamplesPerPrompt).toBe(5)
        expect(config.bufferSize).toBe(20)
    })
    it("trims buffer when size reduced", ()=>{
        let buffer=new FewShotBuffer({bufferSize:5, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q4", output:"a4", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q5", output:"a5", processingType:"instruction", qualityScore:0.9})
        buffer.setConfig({bufferSize:2})
        expect(buffer.size()).toBe(2)
        let examples=buffer.toJSON()
        expect(examples[0].input).toBe("q4")
        expect(examples[1].input).toBe("q5")
    })
})
describe("FewShotBuffer.toJSON", ()=>{
    it("returns examples array", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.add({input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9})
        buffer.add({input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9})
        let examples=buffer.toJSON()
        expect(examples.length).toBe(2)
        expect(examples[0].input).toBe("q1")
        expect(examples[1].input).toBe("q2")
    })
})
describe("FewShotBuffer.fromJSON", ()=>{
    it("loads examples", ()=>{
        let buffer=new FewShotBuffer({bufferSize:10, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.fromJSON([
            {input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9},
            {input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9}
        ])
        expect(buffer.size()).toBe(2)
        expect(buffer.toJSON()[0].input).toBe("q1")
    })
    it("trims to buffer size", ()=>{
        let buffer=new FewShotBuffer({bufferSize:2, minQualityScore:0, maxExamplesPerPrompt:3})
        buffer.fromJSON([
            {input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9},
            {input:"q2", output:"a2", processingType:"instruction", qualityScore:0.9},
            {input:"q3", output:"a3", processingType:"instruction", qualityScore:0.9},
            {input:"q4", output:"a4", processingType:"instruction", qualityScore:0.9},
            {input:"q5", output:"a5", processingType:"instruction", qualityScore:0.9}
        ])
        expect(buffer.size()).toBe(2)
        let examples=buffer.toJSON()
        expect(examples[0].input).toBe("q4")
        expect(examples[1].input).toBe("q5")
    })
})
describe("formatExamplesForPrompt", ()=>{
    it("returns empty string for no examples", ()=>{
        expect(formatExamplesForPrompt([])).toBe("")
    })
    it("formats examples correctly", ()=>{
        let examples=[
            {input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9}
        ]
        let result=formatExamplesForPrompt(examples)
        expect(result).toContain("Example 1:")
        expect(result).toContain("Input: q1")
        expect(result).toContain("Output: a1")
        expect(result).toContain("high-quality training data")
    })
})
describe("injectExamples", ()=>{
    it("returns original prompt when no examples", ()=>{
        let result=injectExamples("my prompt", [])
        expect(result).toBe("my prompt")
    })
    it("prepends formatted examples to prompt", ()=>{
        let examples=[
            {input:"q1", output:"a1", processingType:"instruction", qualityScore:0.9}
        ]
        let result=injectExamples("my prompt", examples)
        expect(result).toContain("Example 1:")
        expect(result).toContain("my prompt")
        expect(result.indexOf("Example 1:")).toBeLessThan(result.indexOf("my prompt"))
    })
})
describe("createRingBuffer", ()=>{
    it("creates buffer with specified size", ()=>{
        let buffer=createRingBuffer(5)
        let config=buffer.getConfig()
        expect(config.bufferSize).toBe(5)
    })
})
describe("DEFAULT_FEW_SHOT_CONFIG", ()=>{
    it("has bufferSize=20 and minQualityScore=0.7", ()=>{
        expect(DEFAULT_FEW_SHOT_CONFIG.bufferSize).toBe(20)
        expect(DEFAULT_FEW_SHOT_CONFIG.minQualityScore).toBe(0.7)
    })
})
