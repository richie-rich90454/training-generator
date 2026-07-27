import{describe, it, expect}from"vitest"
import{
    CITATION_PROMPT_INSTRUCTION,
    CitationParser,
    extractCitations,
    injectCitationPrompt,
    validateCitations,
    renderCitations,
    countCitations
}from"../src/renderer/citationExtractor.js"
import type{Citation}from"../src/types/interfaces.js"
describe("CITATION_PROMPT_INSTRUCTION", ()=>{
    it("is non-empty string", ()=>{
        expect(typeof CITATION_PROMPT_INSTRUCTION).toBe("string")
        expect(CITATION_PROMPT_INSTRUCTION.length).toBeGreaterThan(0)
    })
    it("mentions page and line citation formats", ()=>{
        expect(CITATION_PROMPT_INSTRUCTION).toContain("[page")
        expect(CITATION_PROMPT_INSTRUCTION).toContain("[line")
    })
})
describe("CitationParser.parsePage", ()=>{
    it("finds [page 12]", ()=>{
        let results=CitationParser.parsePage("text [page 12] more")
        expect(results).toHaveLength(1)
        expect(results[0].citation.page).toBe(12)
        expect(results[0].citation.text).toBe("[page 12]")
        expect(results[0].start).toBe(5)
        expect(results[0].end).toBe(14)
    })
    it("finds [p.7]", ()=>{
        let results=CitationParser.parsePage("see [p.7] for details")
        expect(results).toHaveLength(1)
        expect(results[0].citation.page).toBe(7)
        expect(results[0].citation.text).toBe("[p.7]")
    })
    it("handles multiple occurrences", ()=>{
        let results=CitationParser.parsePage("[page 1] and [page 2] and [p.3]")
        expect(results).toHaveLength(3)
        expect(results[0].citation.page).toBe(1)
        expect(results[1].citation.page).toBe(2)
        expect(results[2].citation.page).toBe(3)
    })
    it("returns empty for no matches", ()=>{
        let results=CitationParser.parsePage("no citations here")
        expect(results).toEqual([])
    })
})
describe("CitationParser.parseLine", ()=>{
    it("finds [line 45]", ()=>{
        let results=CitationParser.parseLine("text [line 45] more")
        expect(results).toHaveLength(1)
        expect(results[0].citation.line).toBe(45)
        expect(results[0].citation.text).toBe("[line 45]")
    })
    it("finds [L 23]", ()=>{
        let results=CitationParser.parseLine("see [L 23] for info")
        expect(results).toHaveLength(1)
        expect(results[0].citation.line).toBe(23)
        expect(results[0].citation.text).toBe("[L 23]")
    })
    it("finds [L23]", ()=>{
        let results=CitationParser.parseLine("see [L23] for info")
        expect(results).toHaveLength(1)
        expect(results[0].citation.line).toBe(23)
        expect(results[0].citation.text).toBe("[L23]")
    })
    it("returns empty for no matches", ()=>{
        let results=CitationParser.parseLine("no citations here")
        expect(results).toEqual([])
    })
})
describe("CitationParser.parseAll", ()=>{
    it("combines page and line citations", ()=>{
        let results=CitationParser.parseAll("[page 5] and [line 12]")
        expect(results).toHaveLength(2)
        expect(results[0].page??results[0].line).toBe(5)
        expect(results[1].page??results[1].line).toBe(12)
    })
    it("deduplicates identical citations", ()=>{
        let results=CitationParser.parseAll("[page 5] [page 5] [line 3] [line 3]")
        expect(results).toHaveLength(2)
    })
    it("returns empty for no citations", ()=>{
        let results=CitationParser.parseAll("no citations")
        expect(results).toEqual([])
    })
    it("sorts by first occurrence", ()=>{
        let results=CitationParser.parseAll("[line 12] before [page 5]")
        expect(results).toHaveLength(2)
        expect(results[0].line).toBe(12)
        expect(results[1].page).toBe(5)
    })
})
describe("extractCitations", ()=>{
    it("strips [page 5] from text", ()=>{
        let result=extractCitations("answer [page 5]")
        expect(result.cleanedText).toBe("answer")
        expect(result.citations).toHaveLength(1)
        expect(result.citations[0].page).toBe(5)
    })
    it("collapses double spaces after stripping", ()=>{
        let result=extractCitations("answer [page 5] more text")
        expect(result.cleanedText).toBe("answer more text")
    })
    it("returns empty array when no citations", ()=>{
        let result=extractCitations("plain text without citations")
        expect(result.citations).toEqual([])
        expect(result.cleanedText).toBe("plain text without citations")
    })
    it("strips multiple citation markers", ()=>{
        let result=extractCitations("[page 1] text [line 2] end")
        expect(result.cleanedText).toBe("text end")
        expect(result.citations).toHaveLength(2)
    })
})
describe("injectCitationPrompt", ()=>{
    it("appends instruction to prompt", ()=>{
        let result=injectCitationPrompt("Generate answer.")
        expect(result).toContain("Generate answer.")
        expect(result).toContain(CITATION_PROMPT_INSTRUCTION)
        expect(result.indexOf(CITATION_PROMPT_INSTRUCTION)).toBeGreaterThan(result.indexOf("Generate answer."))
    })
    it("does not double-append if already present", ()=>{
        let once=injectCitationPrompt("Generate answer.")
        let twice=injectCitationPrompt(once)
        expect(twice).toBe(once)
    })
})
describe("validateCitations", ()=>{
    it("splits valid and invalid citations", ()=>{
        let citations:Citation[]=[
            {page:1, text:"[page 1]"},
            {page:99, text:"[page 99]"}
        ]
        let spans=[{page:1}]
        let result=validateCitations(citations, spans)
        expect(result.valid).toHaveLength(1)
        expect(result.invalid).toHaveLength(1)
        expect(result.valid[0].page).toBe(1)
        expect(result.invalid[0].page).toBe(99)
    })
    it("handles citations with both page and line", ()=>{
        let citations:Citation[]=[
            {page:5, line:12, text:"[page 5, line 12]"},
            {page:5, line:99, text:"[page 5, line 99]"}
        ]
        let spans=[{page:5, line:12}]
        let result=validateCitations(citations, spans)
        expect(result.valid).toHaveLength(1)
        expect(result.invalid).toHaveLength(1)
        expect(result.valid[0].line).toBe(12)
        expect(result.invalid[0].line).toBe(99)
    })
    it("validates line-only citations", ()=>{
        let citations:Citation[]=[
            {line:3, text:"[line 3]"},
            {line:7, text:"[line 7]"}
        ]
        let spans=[{line:3}]
        let result=validateCitations(citations, spans)
        expect(result.valid).toHaveLength(1)
        expect(result.invalid).toHaveLength(1)
    })
})
describe("renderCitations", ()=>{
    it("formats multiple citations", ()=>{
        let citations:Citation[]=[
            {page:5, text:"[page 5]"},
            {line:12, text:"[line 12]"},
            {page:7, line:3, text:"[page 7, line 3]"}
        ]
        let result=renderCitations(citations)
        expect(result).toBe("[page 5] [line 12] [page 7, line 3]")
    })
    it("returns empty string for empty array", ()=>{
        expect(renderCitations([])).toBe("")
    })
    it("formats single page citation", ()=>{
        let citations:Citation[]=[{page:42, text:"[page 42]"}]
        expect(renderCitations(citations)).toBe("[page 42]")
    })
})
describe("countCitations", ()=>{
    it("counts by page", ()=>{
        let citations:Citation[]=[
            {page:1, text:"[page 1]"},
            {page:1, text:"[page 1]"},
            {page:2, text:"[page 2]"}
        ]
        let result=countCitations(citations)
        expect(result.byPage.get(1)).toBe(2)
        expect(result.byPage.get(2)).toBe(1)
        expect(result.total).toBe(3)
    })
    it("counts by line", ()=>{
        let citations:Citation[]=[
            {line:5, text:"[line 5]"},
            {line:5, text:"[line 5]"},
            {line:10, text:"[line 10]"}
        ]
        let result=countCitations(citations)
        expect(result.byLine.get(5)).toBe(2)
        expect(result.byLine.get(10)).toBe(1)
        expect(result.total).toBe(3)
    })
    it("returns 0 total for empty", ()=>{
        let result=countCitations([])
        expect(result.total).toBe(0)
        expect(result.byPage.size).toBe(0)
        expect(result.byLine.size).toBe(0)
    })
})
