// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

interface TrainingItem{
    instruction?:string
    input?:string
    output?:string
    text?:string
    messages?:Array<{role:string;content:string}>
}

function createTrainingItem(text:string,format:string,instruction?:string):TrainingItem{
    if(format=="chatml"){
        let messages=[
            {role:"system",content:instruction||"You are a helpful assistant."},
            {role:"user",content:text}
        ]
        return{messages}
    }
    if(format=="text"){
        return{text}
    }
    // Default: instruction format
    return{
        instruction:instruction||"Respond helpfully to the following input.",
        input:text,
        output:""
    }
}

describe("createTrainingItem",()=>{
    test("creates instruction format item",()=>{
        let item=createTrainingItem("What is 2+2?","instruction")
        expect(item.instruction).toBeDefined()
        expect(item.input).toBe("What is 2+2?")
        expect(item.output).toBe("")
    })

    test("creates instruction format with custom instruction",()=>{
        let item=createTrainingItem("Translate this","instruction","You are a translator")
        expect(item.instruction).toBe("You are a translator")
        expect(item.input).toBe("Translate this")
    })

    test("creates chatml format item",()=>{
        let item=createTrainingItem("Hello","chatml")
        expect(item.messages).toBeDefined()
        expect(item.messages).toHaveLength(2)
        expect(item.messages![0].role).toBe("system")
        expect(item.messages![1].role).toBe("user")
        expect(item.messages![1].content).toBe("Hello")
    })

    test("creates chatml format with custom system prompt",()=>{
        let item=createTrainingItem("Hello","chatml","Custom system prompt")
        expect(item.messages![0].content).toBe("Custom system prompt")
    })

    test("creates text format item",()=>{
        let item=createTrainingItem("Raw text content","text")
        expect(item.text).toBe("Raw text content")
    })

    test("text format ignores instruction parameter",()=>{
        let item=createTrainingItem("Content","text","This should be ignored")
        expect(item.text).toBe("Content")
        expect(item.instruction).toBeUndefined()
    })

    test("instruction format uses default instruction when none provided",()=>{
        let item=createTrainingItem("test","instruction")
        expect(item.instruction).toBe("Respond helpfully to the following input.")
    })

    test("chatml format uses default system prompt when none provided",()=>{
        let item=createTrainingItem("test","chatml")
        expect(item.messages![0].content).toBe("You are a helpful assistant.")
    })

    test("handles empty text",()=>{
        let item=createTrainingItem("","instruction")
        expect(item.input).toBe("")
    })

    test("handles text with special characters",()=>{
        let item=createTrainingItem("What is <html> & \"quotes\"?","instruction")
        expect(item.input).toContain("<html>")
        expect(item.input).toContain("&")
    })

    test("handles very long text",()=>{
        let longText="A".repeat(10000)
        let item=createTrainingItem(longText,"text")
        expect(item.text).toBe(longText)
    })

    test("handles unicode text",()=>{
        let item=createTrainingItem("こんにちは 世界","instruction")
        expect(item.input).toBe("こんにちは 世界")
    })
})
