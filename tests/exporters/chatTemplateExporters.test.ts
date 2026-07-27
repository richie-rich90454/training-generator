// @vitest-environment node
import { describe, test, expect } from "vitest"
import type { TrainingItem, ChatMessage } from "../../src/types/index.js"
import {
    itemToMessages,
    applyShareGptTemplate,
    applyLlama2Template,
    applyLlama3Template,
    applyMistralTemplate,
    ShareGptExporter,
    OpenAIFineTuneExporter,
    Llama2Exporter,
    Llama3Exporter,
    MistralExporter
} from "../../src/renderer/exporters/chatTemplateExporters.js"
import { Exporter } from "../../src/renderer/exportFormats.js"
function parseJsonl(text: string): unknown[]{
    return text.trim().split("\n").map(line=>JSON.parse(line))
}
describe("itemToMessages", ()=>{
    test("extracts messages from messages field", ()=>{
        let item: TrainingItem={ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }
        let messages=itemToMessages(item)
        expect(messages).toHaveLength(3)
        expect(messages[0].role).toBe("system")
        expect(messages[1].content).toBe("hi")
    })
    test("converts instruction and output to single turn", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "solve", output: "answer" }
        let messages=itemToMessages(item)
        expect(messages).toEqual([{ role: "user", content: "solve" }, { role: "assistant", content: "answer" }])
    })
    test("includes input with instruction", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "solve", input: "2+2", output: "4" }
        let messages=itemToMessages(item)
        expect(messages[0].content).toBe("solve\n2+2")
        expect(messages[1].content).toBe("4")
    })
    test("converts text field to user message", ()=>{
        let item: TrainingItem={ format: "text", text: "hello" }
        let messages=itemToMessages(item)
        expect(messages).toEqual([{ role: "user", content: "hello" }])
    })
    test("returns empty array for empty item", ()=>{
        let item: TrainingItem={ format: "instruction" }
        expect(itemToMessages(item)).toEqual([])
    })
    test("filters invalid message roles", ()=>{
        let item={ format: "chatml", messages: [{ role: "user", content: "ok" }, { role: "invalid", content: "bad" }, { role: "assistant", content: "ok2" }] } as unknown as TrainingItem
        let messages=itemToMessages(item)
        expect(messages).toHaveLength(2)
        expect(messages[0].role).toBe("user")
        expect(messages[1].role).toBe("assistant")
    })
})
describe("applyShareGptTemplate", ()=>{
    test("maps user to human and assistant to gpt", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyShareGptTemplate(messages)
        expect(result.conversations).toEqual([{ from: "human", value: "hi" }, { from: "gpt", value: "hello" }])
    })
    test("preserves system role", ()=>{
        let messages: ChatMessage[]=[{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyShareGptTemplate(messages)
        expect(result.conversations[0]).toEqual({ from: "system", value: "sys" })
    })
    test("skips invalid roles", ()=>{
        let messages=[{ role: "user", content: "hi" }, { role: "foo", content: "bad" }] as ChatMessage[]
        let result=applyShareGptTemplate(messages)
        expect(result.conversations).toHaveLength(1)
        expect(result.conversations[0].from).toBe("human")
    })
})
describe("ShareGptExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new ShareGptExporter()
        expect(exporter.name).toBe("sharegpt")
        expect(exporter.mimeType).toBe("application/jsonl")
        expect(exporter.extension).toBe(".jsonl")
        expect(typeof exporter.export).toBe("function")
    })
    test("exports valid JSONL with mapped roles", ()=>{
        let exporter=new ShareGptExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)
        expect(parsed).toHaveLength(1)
        expect(parsed[0]).toMatchObject({ id: 1, conversations: [{ from: "human", value: "hi" }, { from: "gpt", value: "hello" }] })
    })
    test("handles system message", ()=>{
        let exporter=new ShareGptExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { conversations: { from: string, value: string }[] }
        expect(parsed.conversations[0].from).toBe("system")
    })
    test("skips invalid roles", ()=>{
        let exporter=new ShareGptExporter()
        let item={ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "invalid", content: "bad" }, { role: "assistant", content: "hello" }] } as unknown as TrainingItem
        let result=exporter.export([item])
        let parsed=parseJsonl(result)[0] as { conversations: { from: string }[] }
        expect(parsed.conversations).toHaveLength(2)
        expect(parsed.conversations.some(c=>c.from==="human")).toBe(true)
        expect(parsed.conversations.some(c=>c.from==="gpt")).toBe(true)
    })
    test("skips items without messages", ()=>{
        let exporter=new ShareGptExporter()
        let result=exporter.export([{ format: "instruction" }])
        expect(result.trim()).toBe("")
    })
})
describe("OpenAIFineTuneExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new OpenAIFineTuneExporter()
        expect(exporter.name).toBe("openai-finetune")
        expect(typeof exporter.export).toBe("function")
    })
    test("outputs messages array", ()=>{
        let exporter=new OpenAIFineTuneExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { messages: { role: string, content: string }[] }
        expect(parsed.messages).toHaveLength(2)
        expect(parsed.messages[0].role).toBe("user")
    })
    test("includes system message", ()=>{
        let exporter=new OpenAIFineTuneExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { messages: { role: string }[] }
        expect(parsed.messages[0].role).toBe("system")
    })
    test("skips invalid roles", ()=>{
        let exporter=new OpenAIFineTuneExporter()
        let item={ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "invalid", content: "bad" }] } as unknown as TrainingItem
        let result=exporter.export([item])
        let parsed=parseJsonl(result)[0] as { messages: { role: string }[] }
        expect(parsed.messages).toHaveLength(1)
        expect(parsed.messages[0].role).toBe("user")
    })
    test("produces valid JSONL", ()=>{
        let exporter=new OpenAIFineTuneExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let result=exporter.export(items)
        expect(parseJsonl(result)).toHaveLength(1)
    })
})
describe("applyLlama2Template", ()=>{
    test("includes system block", ()=>{
        let messages: ChatMessage[]=[{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyLlama2Template(messages)
        expect(result).toContain("<<SYS>>\nsys\n<</SYS>>")
    })
    test("wraps user and assistant turns", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyLlama2Template(messages)
        expect(result).toBe("[INST] hi [/INST] hello")
    })
    test("formats multi-turn conversation", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }]
        let result=applyLlama2Template(messages)
        expect(result).toBe("[INST] a [/INST] b[INST] c [/INST] d")
    })
})
describe("Llama2Exporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new Llama2Exporter()
        expect(exporter.name).toBe("llama2")
    })
    test("exports text field JSONL", ()=>{
        let exporter=new Llama2Exporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { text: string }
        expect(parsed.text).toBe("[INST] hi [/INST] hello")
    })
})
describe("applyLlama3Template", ()=>{
    test("includes begin_of_text token", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyLlama3Template(messages)
        expect(result.startsWith("<|begin_of_text|>")).toBe(true)
    })
    test("includes header ids", ()=>{
        let messages: ChatMessage[]=[{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyLlama3Template(messages)
        expect(result).toContain("<|start_header_id|>system<|end_header_id|>")
        expect(result).toContain("<|start_header_id|>user<|end_header_id|>")
        expect(result).toContain("<|start_header_id|>assistant<|end_header_id|>")
    })
    test("formats multi-turn conversation", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }]
        let result=applyLlama3Template(messages)
        expect(result).toContain("<|start_header_id|>user<|end_header_id|>\n\na<|eot_id|>")
        expect(result).toContain("<|start_header_id|>assistant<|end_header_id|>\n\nb<|eot_id|>")
        expect(result).toContain("<|start_header_id|>user<|end_header_id|>\n\nc<|eot_id|>")
        expect(result).toContain("<|start_header_id|>assistant<|end_header_id|>\n\nd<|eot_id|>")
    })
})
describe("Llama3Exporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new Llama3Exporter()
        expect(exporter.name).toBe("llama3")
    })
    test("exports text field JSONL", ()=>{
        let exporter=new Llama3Exporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { text: string }
        expect(parsed.text.startsWith("<|begin_of_text|>")).toBe(true)
    })
})
describe("applyMistralTemplate", ()=>{
    test("wraps turns in INST tags", ()=>{
        let messages: ChatMessage[]=[{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyMistralTemplate(messages)
        expect(result).toBe("[INST] hi [/INST] hello")
    })
    test("includes system in first INST block", ()=>{
        let messages: ChatMessage[]=[{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }]
        let result=applyMistralTemplate(messages)
        expect(result.startsWith("[INST] sys\n\nhi [/INST] hello")).toBe(true)
    })
    test("formats multi-turn conversation", ()=>{
        let messages: ChatMessage[]=[{ role: "system", content: "sys" }, { role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }]
        let result=applyMistralTemplate(messages)
        expect(result).toContain("[INST] sys\n\na [/INST] b")
        expect(result).toContain("[INST] c [/INST] d")
    })
})
describe("MistralExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new MistralExporter()
        expect(exporter.name).toBe("mistral")
    })
    test("exports text field JSONL", ()=>{
        let exporter=new MistralExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        let parsed=parseJsonl(result)[0] as { text: string }
        expect(parsed.text).toBe("[INST] hi [/INST] hello")
    })
})
describe("exporters handle empty items", ()=>{
    test("all exporters return empty string for empty array", ()=>{
        let exporters: Exporter[]=[new ShareGptExporter(), new OpenAIFineTuneExporter(), new Llama2Exporter(), new Llama3Exporter(), new MistralExporter()]
        for(let exporter of exporters){
            expect(exporter.export([])).toBe("")
        }
    })
    test("all exporters skip items with no content", ()=>{
        let item: TrainingItem={ format: "instruction" }
        let exporters: Exporter[]=[new ShareGptExporter(), new OpenAIFineTuneExporter(), new Llama2Exporter(), new Llama3Exporter(), new MistralExporter()]
        for(let exporter of exporters){
            expect((exporter.export([item]) as string).trim()).toBe("")
        }
    })
})
describe("exporters produce valid JSONL", ()=>{
    test("every line parses as JSON", ()=>{
        let items: TrainingItem[]=[
            { format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] },
            { format: "instruction", instruction: "a", output: "b" }
        ]
        let exporters: Exporter[]=[new ShareGptExporter(), new OpenAIFineTuneExporter(), new Llama2Exporter(), new Llama3Exporter(), new MistralExporter()]
        for(let exporter of exporters){
            let result=exporter.export(items) as string
            let lines=result.trim().split("\n")
            expect(lines.length).toBeGreaterThan(0)
            for(let line of lines){
                expect(()=>JSON.parse(line)).not.toThrow()
            }
        }
    })
})
