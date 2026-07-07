// @vitest-environment happy-dom
import{describe,test,it,expect}from "vitest"

// Extract parseQuestionAnswerPairs logic for testing
function parseQuestionAnswerPairs(text:string):Array<{role:string;content:string}>{
    let messages:Array<{role:string;content:string}>=[]
    let regex=/Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=Q:|$)/gi
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
    let regex=/(Human|User):\s*([\s\S]*?)\s*(Assistant|AI):\s*([\s\S]*?)(?=(?:Human|User):|$)/gi
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

// OutputStore-style parse functions matching the real outputStore.createTrainingItem return types
function parseQAPairs(text:string):Array<{question:string;answer:string}>{
    let pairs:Array<{question:string;answer:string}>=[]
    let qaMatches=text.match(/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis)
    if(qaMatches){
        for(let match of qaMatches){
            let qMatch=match.match(/Q:\s*(.*?)\s*A:\s*(.*)/is)
            if(qMatch&&qMatch[1]&&qMatch[2]){
                pairs.push({
                    question:qMatch[1].trim(),
                    answer:qMatch[2].trim()
                })
            }
        }
    }
    return pairs
}

function parseConvTurns(text:string):Array<{user:string;assistant:string}>{
    let turns:Array<{user:string;assistant:string}>=[]
    let convMatches=text.match(/Human:\s*(.*?)\s*Assistant:\s*(.*?)(?=Human:|$)/gis)
    if(convMatches){
        for(let match of convMatches){
            let hMatch=match.match(/Human:\s*(.*?)\s*Assistant:\s*(.*)/is)
            if(hMatch&&hMatch[1]&&hMatch[2]){
                turns.push({
                    user:hMatch[1].trim(),
                    assistant:hMatch[2].trim()
                })
            }
        }
    }
    return turns
}

let outputManager={
    parseQuestionAnswerPairs:parseQAPairs,
    parseConversationTurns:parseConvTurns
}

describe("Q:/A: format parsing",()=>{
    it("should parse Q: and A: format",()=>{
        let result=outputManager.parseQuestionAnswerPairs("Q: What is this?\nA: This is a test")
        expect(result.length).toBe(1)
        expect(result[0].question).toBe("What is this?")
        expect(result[0].answer).toBe("This is a test")
    })

    it("should parse multiple Q:/A: pairs",()=>{
        let result=outputManager.parseQuestionAnswerPairs("Q: First question\nA: First answer\nQ: Second question\nA: Second answer")
        expect(result.length).toBe(2)
        expect(result[0].question).toBe("First question")
        expect(result[0].answer).toBe("First answer")
        expect(result[1].question).toBe("Second question")
        expect(result[1].answer).toBe("Second answer")
    })

    it("should handle Q: and A: with colons",()=>{
        let result=outputManager.parseQuestionAnswerPairs("Q: What is this?\nA: This is a test")
        expect(result.length).toBe(1)
    })
})

describe("Human:/Assistant: format parsing",()=>{
    it("should parse Human: and Assistant: conversation format",()=>{
        let result=outputManager.parseConversationTurns("Human: Hello\nAssistant: Hi there!")
        expect(result.length).toBe(1)
        expect(result[0].user).toBe("Hello")
        expect(result[0].assistant).toBe("Hi there!")
    })

    it("should parse multiple turns",()=>{
        let result=outputManager.parseConversationTurns("Human: Question 1\nAssistant: Answer 1\nHuman: Question 2\nAssistant: Answer 2")
        expect(result.length).toBe(2)
    })
})
