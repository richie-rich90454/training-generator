// @vitest-environment node
import{describe,it,expect}from "vitest"
import{parseQAPairs,parseConversationTurns}from "../src/cli/parsers.ts"
describe("parseQAPairs",()=>{
    it("parses question/answer pairs with required colon",()=>{
        let text="Question: What is 2+2?\nAnswer: 4"
        let result=parseQAPairs(text)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({question:"What is 2+2?",answer:"4"})
    })
    it("does not treat label without colon as question",()=>{
        let text="Question without colon\nAnswer not a label"
        let result=parseQAPairs(text)
        expect(result).toHaveLength(0)
    })
    it("handles multiline answers",()=>{
        let text="Question: Explain recursion\nAnswer: A function calls itself.\nIt needs a base case."
        let result=parseQAPairs(text)
        expect(result).toHaveLength(1)
        expect(result[0].answer).toContain("base case")
    })
    it("parses multiple pairs",()=>{
        let text="Question: One?\nAnswer: A\n\nQuestion: Two?\nAnswer: B"
        let result=parseQAPairs(text)
        expect(result).toHaveLength(2)
    })
    it("ignores orphan questions without answers",()=>{
        let text="Question: Orphan\nThis is still the question."
        let result=parseQAPairs(text)
        expect(result).toHaveLength(0)
    })
    it("returns empty array for empty input",()=>{
        expect(parseQAPairs("")).toEqual([])
        expect(parseQAPairs(null as unknown as string)).toEqual([])
    })
})
describe("parseConversationTurns",()=>{
    it("parses user/assistant turns with required colon",()=>{
        let text="User: Hello\nAssistant: Hi"
        let result=parseConversationTurns(text)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({user:"Hello",assistant:"Hi"})
    })
    it("ignores turns without colon labels",()=>{
        let text="User hello\nAssistant hi"
        let result=parseConversationTurns(text)
        expect(result).toHaveLength(0)
    })
})
