// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

// Extract parseQuestionAnswerPairs logic for testing
function parseQuestionAnswerPairs(text:string):Array<{role:string;content:string}>{
    let messages:Array<{role:string;content:string}>=[]
    let regex=/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis
    let match:RegExpExecArray|null
    while((match=regex.exec(text))!==null){
        if(match[1]&&match[2]){
            messages.push({role:"user",content:match[1].trim()})
            messages.push({role:"assistant",content:match[2].trim()})
        }
    }
    return messages
}

// Extract parseConversationTurns logic for testing
function parseConversationTurns(text:string):Array<{role:string;content:string}>{
    let messages:Array<{role:string;content:string}>=[]
    let regex=/(Human|User):\s*(.*?)\s*(Assistant|AI):\s*(.*?)(?=(?:Human|User):|$)/gis
    let match:RegExpExecArray|null
    while((match=regex.exec(text))!==null){
        if(match[2]&&match[4]){
            messages.push({role:"user",content:match[2].trim()})
            messages.push({role:"assistant",content:match[4].trim()})
        }
    }
    return messages
}

describe("parseQuestionAnswerPairs",()=>{
    test("parses simple Q&A pair",()=>{
        let text="Q: What is 2+2?\nA: 4"
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(2)
        expect(messages[0]).toEqual({role:"user",content:"What is 2+2?"})
        expect(messages[1]).toEqual({role:"assistant",content:"4"})
    })

    test("parses multiple Q&A pairs",()=>{
        let text="Q: What is 2+2?\nA: 4\n\nQ: What is 3+3?\nA: 6"
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(4)
        expect(messages[0].role).toBe("user")
        expect(messages[1].role).toBe("assistant")
        expect(messages[2].role).toBe("user")
        expect(messages[3].role).toBe("assistant")
    })

    test("handles multiline answers",()=>{
        let text="Q: Explain recursion\nA: Recursion is when a function calls itself.\nIt needs a base case to stop."
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(2)
        expect(messages[1].content).toContain("base case")
    })

    test("returns empty array for no Q&A pairs",()=>{
        let text="This is just plain text without any Q&A format."
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(0)
    })

    test("handles extra whitespace",()=>{
        let text="Q:   Hello   \nA:   World   "
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(2)
        expect(messages[0].content).toBe("Hello")
        expect(messages[1].content).toBe("World")
    })

    test("handles case insensitive matching",()=>{
        let text="q: lowercase question\na: lowercase answer"
        let messages=parseQuestionAnswerPairs(text)
        // The regex uses 'i' flag so it should match
        expect(messages.length).toBeGreaterThan(0)
    })

    test("handles Q without A gracefully",()=>{
        let text="Q: Orphan question without answer"
        let messages=parseQuestionAnswerPairs(text)
        // Should not add incomplete pairs
        expect(messages.every(m=>m.content.length>0)).toBe(true)
    })

    test("handles empty Q&A content",()=>{
        let text="Q: \nA: "
        let messages=parseQuestionAnswerPairs(text)
        // Empty content should be filtered out
        expect(messages).toHaveLength(0)
    })

    test("preserves special characters in content",()=>{
        let text="Q: What is <html>?\nA: It's a markup language & it uses <tags>."
        let messages=parseQuestionAnswerPairs(text)
        expect(messages[0].content).toContain("<html>")
        expect(messages[1].content).toContain("<tags>")
    })

    test("handles very long Q&A pairs",()=>{
        let longQuestion="What is the meaning of life? ".repeat(50)
        let longAnswer="The meaning of life is 42. ".repeat(50)
        let text=`Q: ${longQuestion}\nA: ${longAnswer}`
        let messages=parseQuestionAnswerPairs(text)
        expect(messages).toHaveLength(2)
    })
})

describe("parseConversationTurns",()=>{
    test("parses Human/Assistant turns",()=>{
        let text="Human: Hello\nAssistant: Hi there!"
        let messages=parseConversationTurns(text)
        expect(messages).toHaveLength(2)
        expect(messages[0]).toEqual({role:"user",content:"Hello"})
        expect(messages[1]).toEqual({role:"assistant",content:"Hi there!"})
    })

    test("parses User/Assistant turns",()=>{
        let text="User: What is AI?\nAssistant: AI stands for Artificial Intelligence."
        let messages=parseConversationTurns(text)
        expect(messages).toHaveLength(2)
        expect(messages[0].role).toBe("user")
        expect(messages[1].role).toBe("assistant")
    })

    test("parses multiple turns",()=>{
        let text="Human: Hi\nAssistant: Hello!\nHuman: How are you?\nAssistant: I'm fine, thanks!"
        let messages=parseConversationTurns(text)
        expect(messages).toHaveLength(4)
    })

    test("returns empty array for no turns",()=>{
        let text="Just some regular text."
        let messages=parseConversationTurns(text)
        expect(messages).toHaveLength(0)
    })

    test("handles multiline responses",()=>{
        let text="Human: Explain JS\nAssistant: JavaScript is a programming language.\nIt runs in browsers."
        let messages=parseConversationTurns(text)
        expect(messages).toHaveLength(2)
        expect(messages[1].content).toContain("programming language")
    })

    test("handles case insensitive matching",()=>{
        let text="human: hello\nassistant: hi"
        let messages=parseConversationTurns(text)
        expect(messages.length).toBeGreaterThan(0)
    })

    test("preserves special characters",()=>{
        let text="Human: What is <div>?\nAssistant: It's an HTML element & it's a container."
        let messages=parseConversationTurns(text)
        expect(messages[0].content).toContain("<div>")
        expect(messages[1].content).toContain("HTML element")
    })
})
