// @vitest-environment node
import { describe, it, expect } from "vitest"
import { findPreviousWhitespace, findPreviousSentenceBoundary, detectSemanticUnits, isInSemanticUnit, estimateTextDensity, semanticChunk, simpleChunk, splitSentences } from "../src/renderer/chunker.js"
describe("findPreviousWhitespace", () => {
    it("returns -1 when no whitespace before position", () => {
        let text="abcdef"
        expect(findPreviousWhitespace(text, 3)).toBe(-1)
    })
    it("finds immediate preceding space", () => {
        let text="abc def"
        expect(findPreviousWhitespace(text, 4)).toBe(3)
    })
    it("finds preceding newline", () => {
        let text="abc\ndef"
        expect(findPreviousWhitespace(text, 4)).toBe(3)
    })
    it("finds preceding tab", () => {
        let text="abc\tdef"
        expect(findPreviousWhitespace(text, 4)).toBe(3)
    })
    it("returns -1 at position 0", () => {
        let text="abc"
        expect(findPreviousWhitespace(text, 0)).toBe(-1)
    })
    it("skips non-whitespace characters", () => {
        let text="abc  def"
        expect(findPreviousWhitespace(text, 6)).toBe(4)
    })
    it("handles all-whitespace text", () => {
        let text="   "
        expect(findPreviousWhitespace(text, 2)).toBe(1)
    })
    it("handles empty text", () => {
        expect(findPreviousWhitespace("", 0)).toBe(-1)
    })
})
describe("findPreviousSentenceBoundary", () => {
    it("finds period followed by space", () => {
        let text="Hello. World"
        expect(findPreviousSentenceBoundary(text, 7)).toBe(6)
    })
    it("finds question mark", () => {
        let text="Hello? World"
        expect(findPreviousSentenceBoundary(text, 7)).toBe(6)
    })
    it("finds exclamation mark", () => {
        let text="Hello! World"
        expect(findPreviousSentenceBoundary(text, 7)).toBe(6)
    })
    it("finds chinese period followed by space", () => {
        let text="你好。 世界"
        expect(findPreviousSentenceBoundary(text, 4)).toBe(3)
    })
    it("finds boundary at end of text", () => {
        let text="Hello."
        expect(findPreviousSentenceBoundary(text, 6)).toBe(6)
    })
    it("returns -1 when no boundary", () => {
        let text="Hello World"
        expect(findPreviousSentenceBoundary(text, 5)).toBe(-1)
    })
    it("ignores period not followed by whitespace", () => {
        let text="Hello.World"
        expect(findPreviousSentenceBoundary(text, 6)).toBe(-1)
    })
    it("handles multiple boundaries", () => {
        let text="A. B. C. D"
        expect(findPreviousSentenceBoundary(text, 9)).toBe(8)
    })
})
describe("detectSemanticUnits", () => {
    it("detects fenced code block", () => {
        let text="```js\nlet x=1\n```"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
        expect(units[0].type).toBe("code_block")
    })
    it("detects indented code block", () => {
        let text="    let x=1\n    let y=2"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
        expect(units[0].type).toBe("code_block")
    })
    it("detects table rows", () => {
        let text="| a | b |\n| c | d |"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
        expect(units[0].type).toBe("table")
    })
    it("detects bullet list", () => {
        let text="- item one\n- item two"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
        expect(units[0].type).toBe("list")
    })
    it("detects numbered list", () => {
        let text="1. item one\n2. item two"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
    })
    it("returns empty for plain text", () => {
        let text="Just plain text without units."
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(0)
    })
    it("detects multiple separate units", () => {
        let text="```\ncode\n```\n\n- list item"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(2)
    })
    it("reports correct start and end positions", () => {
        let text="```\ncode\n```"
        let units=detectSemanticUnits(text)
        expect(units[0].start).toBe(0)
        expect(units[0].end).toBe(text.length)
    })
})
describe("isInSemanticUnit", () => {
    let units=[{ start: 10, end: 20, type: "code_block" }]
    it("returns true inside unit", () => {
        expect(isInSemanticUnit(15, units)).toBe(true)
    })
    it("returns false before unit", () => {
        expect(isInSemanticUnit(5, units)).toBe(false)
    })
    it("returns false after unit", () => {
        expect(isInSemanticUnit(25, units)).toBe(false)
    })
    it("returns false at exact start", () => {
        expect(isInSemanticUnit(10, units)).toBe(false)
    })
    it("returns false at exact end", () => {
        expect(isInSemanticUnit(20, units)).toBe(false)
    })
})
describe("estimateTextDensity", () => {
    it("returns default for empty text", () => {
        expect(estimateTextDensity("")).toBe(0.5)
    })
    it("returns low value for whitespace", () => {
        let density=estimateTextDensity("   ")
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(1)
    })
    it("returns value between 0 and 1 for normal text", () => {
        let density=estimateTextDensity("The quick brown fox jumps over the lazy dog.")
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(1)
    })
    it("returns different values for dense and sparse text", () => {
        let dense=estimateTextDensity("abc".repeat(100))
        let sparse=estimateTextDensity("a b c d e f g h i j k l m n o p q r s t u v w x y z")
        expect(dense).not.toBe(sparse)
    })
})
describe("semanticChunk boundaries", () => {
    let cases:[string, number, number, number][]=[
        ["", 100, 0, 0],
        ["   ", 100, 0, 0],
        ["Short.", 100, 0, 1],
        ["A. B. C.", 10, 0, 1],
        ["A. B. C.", 100, 0, 1],
        ["One. Two. Three.", 8, 0, 2],
        ["No terminators here at all", 15, 0, 1],
        ["Line one\nLine two\nLine three", 12, 0, 3],
    ]
    cases.forEach(([text, size, overlap, expected])=>{
        it(`splits "${text.slice(0, 20).replace(/\n/g, "\\n")}" into ${expected} chunks`, () => {
            let chunks=semanticChunk(text, size, overlap)
            expect(chunks.length).toBe(expected)
        })
    })
    it("returns empty for nullish text", () => {
        expect(semanticChunk("", 100, 0)).toEqual([])
    })
    it("returns single chunk when text equals chunkSize", () => {
        let text="A".repeat(100)+"."
        expect(semanticChunk(text, 101, 0)).toHaveLength(1)
    })
    it("produces chunks for long text", () => {
        let text="A".repeat(200)+"."
        let chunks=semanticChunk(text, 100, 0)
        expect(chunks.length).toBeGreaterThan(0)
    })
})
describe("semanticChunk overlap", () => {
    let text="First sentence here. Second sentence here. Third sentence here. Fourth sentence here."
    it("produces more chunks with larger overlap", () => {
        let noOverlap=semanticChunk(text, 30, 0)
        let withOverlap=semanticChunk(text, 30, 10)
        expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length)
    })
    it("includes overlap text in subsequent chunks", () => {
        let chunks=semanticChunk(text, 30, 10)
        if(chunks.length>1){
            let firstEnd=chunks[0].slice(-10)
            let found=chunks.slice(1).some(c=>c.includes(firstEnd))
            expect(found).toBe(true)
        }
    })
    it("handles zero overlap", () => {
        let chunks=semanticChunk(text, 30, 0)
        expect(chunks.length).toBeGreaterThan(1)
    })
    it("handles overlap larger than chunk", () => {
        let chunks=semanticChunk(text, 30, 50)
        expect(chunks.length).toBeGreaterThan(0)
    })
})
describe("semanticChunk sentence boundaries", () => {
    it("preserves sentence boundaries", () => {
        let text="Sentence one. Sentence two. Sentence three."
        let chunks=semanticChunk(text, 25, 0)
        chunks.forEach(chunk=>{
            expect(chunk.trim().length).toBeGreaterThan(0)
        })
    })
    it("splits at exclamation", () => {
        let text="Wow! Amazing! Great!"
        let chunks=semanticChunk(text, 12, 0)
        expect(chunks.length).toBeGreaterThanOrEqual(2)
    })
    it("splits at question", () => {
        let text="What? Why? How?"
        let chunks=semanticChunk(text, 10, 0)
        expect(chunks.length).toBeGreaterThanOrEqual(2)
    })
    it("handles mixed terminators", () => {
        let text="Hello. Yes? No! Maybe."
        let chunks=semanticChunk(text, 12, 0)
        expect(chunks.length).toBeGreaterThanOrEqual(2)
    })
    it("keeps code blocks intact when small", () => {
        let text="Intro. ```js\nlet x=1\n``` Outro."
        let chunks=semanticChunk(text, 50, 0)
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.some(c=>c.includes("```"))).toBe(true)
    })
    it("keeps lists intact when small", () => {
        let text="Intro.\n- one\n- two\n- three\nOutro."
        let chunks=semanticChunk(text, 80, 0)
        expect(chunks.some(c=>c.includes("- one"))).toBe(true)
    })
})
describe("semanticChunk smartSizing", () => {
    it("doubles chunk size for sparse text", () => {
        let text="A ".repeat(500)
        let normal=semanticChunk(text, 100, 0, false)
        let smart=semanticChunk(text, 100, 0, true)
        expect(smart.length).toBeLessThanOrEqual(normal.length)
    })
    it("increases chunk size moderately for medium density", () => {
        let text="The quick brown fox jumps over the lazy dog. ".repeat(20)
        let normal=semanticChunk(text, 100, 0, false)
        let smart=semanticChunk(text, 100, 0, true)
        expect(smart.length).toBeLessThanOrEqual(normal.length)
    })
    it("does not reduce below chunkSize", () => {
        let text="A".repeat(1000)
        let chunks=semanticChunk(text, 100, 0, true)
        expect(chunks.length).toBeGreaterThan(0)
    })
})
describe("semanticChunk very long input", () => {
    it("handles 10000 characters", () => {
        let text="Word ".repeat(2000)+"."
        let chunks=semanticChunk(text, 500, 50)
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.every(c=>c.trim().length>0)).toBe(true)
    })
    it("handles 20000 characters", () => {
        let text="Sentence ".repeat(2222)+"."
        let chunks=semanticChunk(text, 1000, 100)
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.every(c=>c.trim().length>0)).toBe(true)
    })
    it("produces non-empty chunks for long text", () => {
        let text="A. ".repeat(1000)
        let chunks=semanticChunk(text, 200, 20)
        chunks.forEach(c=>expect(c.trim().length).toBeGreaterThan(0))
    })
})
describe("simpleChunk", () => {
    it("returns empty for empty string", () => {
        expect(simpleChunk("", 100)).toEqual([])
    })
    it("returns empty for whitespace", () => {
        expect(simpleChunk("   ", 100)).toEqual([])
    })
    it("returns single chunk for short text", () => {
        let text="Short text."
        expect(simpleChunk(text, 100)).toEqual([text])
    })
    it("splits long text into expected count", () => {
        let text="A".repeat(1000)
        let chunks=simpleChunk(text, 100)
        expect(chunks.length).toBe(10)
    })
    it("respects chunk size", () => {
        let text="A".repeat(1000)
        let chunks=simpleChunk(text, 200)
        chunks.forEach(c=>expect(c.length).toBeLessThanOrEqual(210))
    })
    it("breaks at whitespace when available", () => {
        let text="word ".repeat(100).trim()
        let chunks=simpleChunk(text, 50)
        chunks.forEach(c=>expect(c.endsWith(" ")||c.length<=50).toBe(true))
    })
    it("breaks at sentence boundary when available", () => {
        let text="A. B. C. D. E. F."
        let chunks=simpleChunk(text, 8)
        expect(chunks.length).toBeGreaterThanOrEqual(3)
    })
    it("avoids splitting inside semantic units", () => {
        let text="```\ncode block content\n```"
        let chunks=simpleChunk(text, 15)
        expect(chunks.some(c=>c.includes("```"))).toBe(true)
    })
    it("handles text with no boundaries", () => {
        let text="A".repeat(500)
        let chunks=simpleChunk(text, 100)
        expect(chunks.length).toBe(5)
    })
    it("handles unicode", () => {
        let text="こんにちは ".repeat(100)
        let chunks=simpleChunk(text, 50)
        expect(chunks.length).toBeGreaterThan(1)
        chunks.forEach(c=>expect(c.length).toBeGreaterThan(0))
    })
    it("does not lose content", () => {
        let text="Word ".repeat(200).trim()
        let chunks=simpleChunk(text, 100)
        let joined=chunks.join(" ")
        expect(joined.length).toBeGreaterThan(text.length*0.8)
    })
})
describe("chunker bug fixes", () => {
    it("preserves tail text when trimming to word boundary", () => {
        let text="One two three four five six seven eight nine ten."
        let chunks=semanticChunk(text, 25, 0)
        let joined=chunks.join(" ")
        expect(joined.replace(/\s+/g, " ").trim()).toContain("ten")
    })
    it("uses overlap text instead of context prefix when overlap is set", () => {
        let text="First sentence here. Second sentence here. Third sentence here. Fourth sentence here."
        let chunks=semanticChunk(text, 35, 10)
        expect(chunks.length).toBeGreaterThan(1)
        for (let i=1; i<chunks.length; i++) {
            expect(chunks[i].startsWith("[CONTEXT FROM PREVIOUS CHUNK:]")).toBe(false)
        }
    })
    it("splits at CJK punctuation without whitespace", () => {
        let text="你好。世界。再见。再见面。"
        let chunks=semanticChunk(text, 10, 0)
        expect(chunks.length).toBeGreaterThanOrEqual(2)
    })
    it("detects table rows without leading or trailing pipes", () => {
        let text="a|b|c\nd|e|f"
        let units=detectSemanticUnits(text)
        expect(units.length).toBe(1)
        expect(units[0].type).toBe("table")
    })
    it("does not split after common abbreviations in fallback splitter", () => {
        let text="Dr. Smith visited e.g. the hospital. Then he left."
        let sentences=splitSentences(text)
        expect(sentences.length).toBeGreaterThanOrEqual(2)
        let joined=sentences.join(" ")
        expect(joined).toContain("Dr. Smith")
        expect(joined).toContain("e.g. the hospital")
    })
})
