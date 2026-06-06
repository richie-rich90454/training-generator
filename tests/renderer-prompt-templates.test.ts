// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

function getFallbackPrompt(language:string,type:string):string{
    let prompts:Record<string,Record<string,string>>={
        "en":{
            instruction:"You are a helpful AI assistant. Please provide a detailed and accurate response to the following input.",
            conversation:"You are a helpful AI assistant having a conversation. Respond naturally and helpfully.",
            chunking:"You are a helpful AI assistant. Process the following text chunk and provide a meaningful summary or response.",
            custom:"You are a helpful AI assistant."
        },
        "zh-Hans":{
            instruction:"你是一个有用的AI助手。请对以下输入提供详细和准确的回应。",
            conversation:"你是一个有用的AI助手，正在进行对话。请自然和有帮助地回应。",
            chunking:"你是一个有用的AI助手。处理以下文本块并提供有意义的摘要或回应。",
            custom:"你是一个有用的AI助手。"
        },
        "es":{
            instruction:"Eres un asistente de IA útil. Proporciona una respuesta detallada y precisa a la siguiente entrada.",
            conversation:"Eres un asistente de IA útil teniendo una conversación. Responde naturalmente y de manera útil.",
            chunking:"Eres un asistente de IA útil. Procesa el siguiente fragmento de texto y proporciona un resumen o respuesta significativa.",
            custom:"Eres un asistente de IA útil."
        }
    }
    let langPrompts=prompts[language]||prompts["en"]
    return langPrompts[type]||langPrompts["instruction"]
}

function processPromptTemplate(template:string,text:string):string{
    return template.replace(/\{\{text\}\}/g,text)
}

function validatePromptTemplate(template:string):boolean{
    return template.includes("{{text}}")
}

describe("Fallback prompts",()=>{
    test("returns English prompts by default",()=>{
        let prompt=getFallbackPrompt("en","instruction")
        expect(prompt).toContain("helpful")
        expect(prompt.length).toBeGreaterThan(20)
    })

    test("returns conversation prompt type",()=>{
        let prompt=getFallbackPrompt("en","conversation")
        expect(prompt).toContain("conversation")
    })

    test("returns chunking prompt type",()=>{
        let prompt=getFallbackPrompt("en","chunking")
        expect(prompt).toContain("chunk")
    })

    test("returns custom prompt type",()=>{
        let prompt=getFallbackPrompt("en","custom")
        expect(prompt.length).toBeGreaterThan(0)
    })

    test("falls back to English for unknown language",()=>{
        let prompt=getFallbackPrompt("xx","instruction")
        expect(prompt).toContain("helpful")
    })

    test("falls back to instruction for unknown type",()=>{
        let prompt=getFallbackPrompt("en","unknown_type")
        expect(prompt).toContain("helpful")
    })

    test("returns Chinese simplified prompts",()=>{
        let prompt=getFallbackPrompt("zh-Hans","instruction")
        expect(prompt).toContain("AI")
    })

    test("returns Spanish prompts",()=>{
        let prompt=getFallbackPrompt("es","instruction")
        expect(prompt).toContain("asistente")
    })

    test("all prompt types return non-empty strings",()=>{
        let types:string[]=["instruction","conversation","chunking","custom"]
        for(let type of types){
            expect(getFallbackPrompt("en",type).length).toBeGreaterThan(0)
        }
    })
})

describe("Prompt template processing",()=>{
    test("replaces {{text}} placeholder",()=>{
        let template="Please respond to: {{text}}"
        let result=processPromptTemplate(template,"Hello World")
        expect(result).toBe("Please respond to: Hello World")
    })

    test("replaces multiple placeholders",()=>{
        let template="{{text}} and also {{text}}"
        let result=processPromptTemplate(template,"test")
        expect(result).toBe("test and also test")
    })

    test("handles template without placeholder",()=>{
        let template="No placeholder here"
        let result=processPromptTemplate(template,"ignored")
        expect(result).toBe("No placeholder here")
    })

    test("handles empty text",()=>{
        let template="Content: {{text}}"
        let result=processPromptTemplate(template,"")
        expect(result).toBe("Content: ")
    })

    test("handles text with special characters",()=>{
        let template="Process: {{text}}"
        let result=processPromptTemplate(template,"<html>&\"quotes\"")
        expect(result).toContain("<html>")
        expect(result).toContain("&")
    })

    test("handles multiline text",()=>{
        let template="Input:\n{{text}}\nEnd"
        let result=processPromptTemplate(template,"Line 1\nLine 2")
        expect(result).toContain("Line 1")
        expect(result).toContain("Line 2")
    })

    test("handles very long text",()=>{
        let template="{{text}}"
        let longText="A".repeat(100000)
        let result=processPromptTemplate(template,longText)
        expect(result.length).toBe(100000)
    })
})

describe("Prompt template validation",()=>{
    test("validates template with placeholder",()=>{
        expect(validatePromptTemplate("{{text}}")).toBe(true)
        expect(validatePromptTemplate("Before {{text}} after")).toBe(true)
    })

    test("rejects template without placeholder",()=>{
        expect(validatePromptTemplate("No placeholder")).toBe(false)
    })

    test("rejects empty template",()=>{
        expect(validatePromptTemplate("")).toBe(false)
    })

    test("rejects malformed placeholder",()=>{
        expect(validatePromptTemplate("{text}")).toBe(false)
        expect(validatePromptTemplate("{{text}")).toBe(false)
        expect(validatePromptTemplate("{text}}")).toBe(false)
    })

    test("accepts template with multiple placeholders",()=>{
        expect(validatePromptTemplate("{{text}} and {{text}}")).toBe(true)
    })
})
