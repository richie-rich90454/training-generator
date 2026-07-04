// @vitest-environment node
import {describe, it, expect} from "vitest"
import {analyzeChunk, selectModel} from "../src/renderer/modelSelector.js"
import type {ModelCandidate, ChunkCharacteristics} from "../src/renderer/modelSelector.js"
function makeChunk(overrides:Partial<ChunkCharacteristics>={}):ChunkCharacteristics{
    let base:ChunkCharacteristics={
        length:100,
        hasCode:false,
        hasMath:false,
        hasTable:false,
        language:'en',
        isMultilingual:false,
        estimatedComplexity:'easy'
    }
    return{...base, ...overrides}
}
describe("analyzeChunk - plain English", ()=>{
    it("returns language='en', hasCode=false, hasMath=false, estimatedComplexity based on length", ()=>{
        let text="The quick brown fox jumps over the lazy dog."
        let result=analyzeChunk(text)
        expect(result.language).toBe('en')
        expect(result.hasCode).toBe(false)
        expect(result.hasMath).toBe(false)
        expect(result.hasTable).toBe(false)
        expect(result.isMultilingual).toBe(false)
        expect(result.estimatedComplexity).toBe('easy')
        expect(result.length).toBe(text.length)
    })
    it("classifies medium length (>2000) as medium complexity", ()=>{
        let text="a".repeat(2500)
        let result=analyzeChunk(text)
        expect(result.estimatedComplexity).toBe('medium')
    })
    it("classifies long length (>5000) as hard complexity", ()=>{
        let text="a".repeat(5500)
        let result=analyzeChunk(text)
        expect(result.estimatedComplexity).toBe('hard')
    })
})
describe("analyzeChunk - code detection", ()=>{
    it("returns hasCode=true for code block with function keyword", ()=>{
        let text="function add(a, b) {\n    return a + b;\n}"
        let result=analyzeChunk(text)
        expect(result.hasCode).toBe(true)
    })
    it("returns hasCode=true for triple backtick code block", ()=>{
        let text="```js\nconsole.log('hi');\n```"
        let result=analyzeChunk(text)
        expect(result.hasCode).toBe(true)
    })
})
describe("analyzeChunk - math detection", ()=>{
    it("returns hasMath=true for LaTeX math", ()=>{
        let text="The formula is $\\frac{a}{b}$ and it works."
        let result=analyzeChunk(text)
        expect(result.hasMath).toBe(true)
    })
    it("returns hasMath=true for \\sqrt LaTeX command", ()=>{
        let text="The square root is \\sqrt{x} for x."
        let result=analyzeChunk(text)
        expect(result.hasMath).toBe(true)
    })
})
describe("analyzeChunk - table detection", ()=>{
    it("returns hasTable=true for markdown table", ()=>{
        let text="| Name | Age |\n|------|-----|\n| Alice | 30 |"
        let result=analyzeChunk(text)
        expect(result.hasTable).toBe(true)
    })
    it("returns hasTable=false for plain text without pipes", ()=>{
        let text="No table here at all."
        let result=analyzeChunk(text)
        expect(result.hasTable).toBe(false)
    })
})
describe("analyzeChunk - language detection", ()=>{
    it("returns language='zh' for Chinese text", ()=>{
        let text="你好世界，这是一个测试。"
        let result=analyzeChunk(text)
        expect(result.language).toBe('zh')
    })
    it("returns language='ja' for Japanese text", ()=>{
        let text="こんにちは、ありがとう。"
        let result=analyzeChunk(text)
        expect(result.language).toBe('ja')
    })
    it("returns language='ko' for Korean text", ()=>{
        let text="안녕하세요 세계."
        let result=analyzeChunk(text)
        expect(result.language).toBe('ko')
    })
    it("returns isMultilingual=true for mixed CJK and Latin", ()=>{
        let text="Hello 你好 World 世界"
        let result=analyzeChunk(text)
        expect(result.isMultilingual).toBe(true)
    })
    it("returns isMultilingual=false for pure CJK text", ()=>{
        let text="你好世界"
        let result=analyzeChunk(text)
        expect(result.isMultilingual).toBe(false)
    })
})
describe("selectModel - validation", ()=>{
    it("throws when candidates array is empty", ()=>{
        let chunk=makeChunk()
        expect(()=>selectModel([], 'instruction', chunk)).toThrow("No model candidates provided")
    })
})
describe("selectModel - strength matching", ()=>{
    it("picks code-strength model for code chunks", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'code-model', contextWindow:10000, strengths:['code']},
            {providerId:'p2', model:'general-model', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({hasCode:true, estimatedComplexity:'hard'})
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('code-model')
    })
    it("picks math-strength model for math chunks", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'math-model', contextWindow:10000, strengths:['math']},
            {providerId:'p2', model:'general-model', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({hasMath:true, estimatedComplexity:'hard'})
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('math-model')
    })
    it("picks reasoning model for CoT processing type", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'reasoning-model', contextWindow:10000, strengths:['reasoning']},
            {providerId:'p2', model:'general-model', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({estimatedComplexity:'easy'})
        let result=selectModel(candidates, 'cot', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('reasoning-model')
    })
    it("picks speed model for chunking processing type", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'speed-model', contextWindow:10000, strengths:['speed']},
            {providerId:'p2', model:'general-model', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({estimatedComplexity:'easy'})
        let result=selectModel(candidates, 'chunking', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('speed-model')
    })
    it("picks multilingual model for multilingual chunks", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'multi-model', contextWindow:10000, strengths:['multilingual']},
            {providerId:'p2', model:'general-model', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({isMultilingual:true})
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p1')
    })
})
describe("selectModel - alternatives", ()=>{
    it("returns up to 2 alternatives when more candidates exist", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'m1', contextWindow:10000, strengths:['general']},
            {providerId:'p2', model:'m2', contextWindow:10000, strengths:['general']},
            {providerId:'p3', model:'m3', contextWindow:10000, strengths:['general']},
            {providerId:'p4', model:'m4', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk()
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.alternatives.length).toBe(2)
    })
    it("returns fewer alternatives when fewer candidates exist", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'m1', contextWindow:10000, strengths:['general']},
            {providerId:'p2', model:'m2', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk()
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.alternatives.length).toBe(1)
    })
    it("returns empty alternatives when only one candidate exists", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'m1', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk()
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.alternatives.length).toBe(0)
    })
})
describe("selectModel - cost penalty", ()=>{
    it("penalizes high cost and prefers cheaper model", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'cheap', contextWindow:10000, strengths:['general'], costPer1kTokens:0.01},
            {providerId:'p2', model:'expensive', contextWindow:10000, strengths:['general'], costPer1kTokens:5}
        ]
        let chunk=makeChunk()
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('cheap')
    })
})
describe("selectModel - context window", ()=>{
    it("prefers models that fit the context window", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'big', contextWindow:10000, strengths:['general']},
            {providerId:'p2', model:'small', contextWindow:1000, strengths:['general']}
        ]
        let chunk=makeChunk({length:900})
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p1')
        expect(result.model).toBe('big')
    })
    it("penalizes model when chunk exceeds 80% of context window", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'tight-fit', contextWindow:1000, strengths:['general']},
            {providerId:'p2', model:'roomy', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk({length:900})
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.providerId).toBe('p2')
    })
})
describe("selectModel - reason string", ()=>{
    it("includes model name and score in reason", ()=>{
        let candidates:ModelCandidate[]=[
            {providerId:'p1', model:'m1', contextWindow:10000, strengths:['general']}
        ]
        let chunk=makeChunk()
        let result=selectModel(candidates, 'instruction', chunk)
        expect(result.reason).toContain('m1')
        expect(result.reason).toContain('score')
    })
})
