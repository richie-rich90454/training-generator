// @vitest-environment node
import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { Exporter } from "../../src/renderer/exportFormats.js"
import { AutoMLCsvExporter, AutoMLJsonlExporter, VertexAiExporter, extractLabel, extractText, convertToAutomlRow } from "../../src/renderer/exporters/automlExporter.js"
describe("AutoMLCsvExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new AutoMLCsvExporter()
        expect(exporter.name).toBe("automl-csv")
        expect(exporter.mimeType).toBe("text/csv")
        expect(exporter.extension).toBe(".csv")
        expect(typeof exporter.export).toBe("function")
    })
    test("exports text/label items", ()=>{
        let exporter=new AutoMLCsvExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello world", label: "greeting" } as unknown as TrainingItem]
        let result=exporter.export(items)
        expect(result).toBe("\uFEFFtext,label\nhello world,greeting\n")
    })
    test("maps instruction/output", ()=>{
        let exporter=new AutoMLCsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "what is 2+2", output: "4" }]
        let result=exporter.export(items)
        expect(result).toBe("\uFEFFtext,label\nwhat is 2+2,4\n")
    })
    test("escapes values", ()=>{
        let exporter=new AutoMLCsvExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello, world", label: 'say "hi"' } as unknown as TrainingItem]
        let result=exporter.export(items)
        expect(result).toBe('\uFEFFtext,label\n"hello, world","say ""hi"""\n')
    })
    test("respects custom columns", ()=>{
        let exporter=new AutoMLCsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let result=exporter.export(items, { columns: ["instruction", "output"] })
        expect(result).toBe("\uFEFFinstruction,output\nq,a\n")
    })
    test("empty items returns default header", ()=>{
        let exporter=new AutoMLCsvExporter()
        let result=exporter.export([])
        expect(result).toBe("\uFEFFtext,label\n")
    })
})
describe("AutoMLJsonlExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new AutoMLJsonlExporter()
        expect(exporter.name).toBe("automl-jsonl")
        expect(exporter.mimeType).toBe("application/jsonl")
        expect(exporter.extension).toBe(".jsonl")
        expect(typeof exporter.export).toBe("function")
    })
    test("classification format", ()=>{
        let exporter=new AutoMLJsonlExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "buy now", output: "spam" }]
        let result=exporter.export(items)
        expect(result).toBe(JSON.stringify({ textContent: "buy now", classificationAnnotation: { displayName: "spam" } })+"\n")
    })
    test("regression format", ()=>{
        let exporter=new AutoMLJsonlExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "score", output: "0.75" }]
        let result=exporter.export(items, { task: "regression" })
        expect(result).toBe(JSON.stringify({ textContent: "score", regressionAnnotation: { value: 0.75 } })+"\n")
    })
    test("ignores items without label", ()=>{
        let exporter=new AutoMLJsonlExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "no label" }]
        let result=exporter.export(items)
        expect(result).toBe("")
    })
    test("ignores NaN regression labels", ()=>{
        let exporter=new AutoMLJsonlExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "x", output: "not a number" }]
        let result=exporter.export(items, { task: "regression" })
        expect(result).toBe("")
    })
})
describe("VertexAiExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new VertexAiExporter()
        expect(exporter.name).toBe("vertex-ai")
        expect(exporter.mimeType).toBe("application/jsonl")
        expect(exporter.extension).toBe(".jsonl")
        expect(typeof exporter.export).toBe("function")
    })
    test("exports messages", ()=>{
        let exporter=new VertexAiExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items)
        expect(result).toBe(JSON.stringify({ messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] })+"\n")
    })
    test("includes system instruction", ()=>{
        let exporter=new VertexAiExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "hi", output: "hello" }]
        let result=exporter.export(items, { systemInstruction: "be helpful" })
        expect(result).toBe(JSON.stringify({ messages: [{ role: "system", content: "be helpful" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] })+"\n")
    })
    test("converts instruction/output to messages", ()=>{
        let exporter=new VertexAiExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let result=exporter.export(items)
        expect(result).toBe(JSON.stringify({ messages: [{ role: "user", content: "q" }, { role: "assistant", content: "a" }] })+"\n")
    })
    test("skips duplicate system message when option provided", ()=>{
        let exporter=new VertexAiExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "system", content: "sys1" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]
        let result=exporter.export(items, { systemInstruction: "sys2" })
        expect(result).toBe(JSON.stringify({ messages: [{ role: "system", content: "sys2" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }] })+"\n")
    })
})
describe("extractLabel", ()=>{
    test("gets output", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "a" }
        expect(extractLabel(item)).toBe("a")
    })
    test("gets text", ()=>{
        let item: TrainingItem={ format: "text", text: "sample" }
        expect(extractLabel(item)).toBe("sample")
    })
    test("gets label property", ()=>{
        let item={ format: "text", text: "sample", label: "cat" } as unknown as TrainingItem
        expect(extractLabel(item)).toBe("cat")
    })
    test("prefers output over text", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "a", text: "b" }
        expect(extractLabel(item)).toBe("a")
    })
    test("returns empty string when nothing found", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q" }
        expect(extractLabel(item)).toBe("")
    })
})
describe("extractText", ()=>{
    test("gets instruction", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "a" }
        expect(extractText(item)).toBe("q")
    })
    test("gets input", ()=>{
        let item: TrainingItem={ format: "instruction", input: "context", output: "a" }
        expect(extractText(item)).toBe("context")
    })
    test("gets text", ()=>{
        let item: TrainingItem={ format: "text", text: "sample" }
        expect(extractText(item)).toBe("sample")
    })
    test("prefers instruction over text", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", text: "b" }
        expect(extractText(item)).toBe("q")
    })
})
describe("convertToAutomlRow", ()=>{
    test("classification", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "a" }
        expect(convertToAutomlRow(item)).toEqual({ textContent: "q", label: "a" })
    })
    test("classification with empty label", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q" }
        expect(convertToAutomlRow(item)).toEqual({ textContent: "q", label: "" })
    })
    test("regression", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "3.14" }
        expect(convertToAutomlRow(item, "regression")).toEqual({ textContent: "q", value: 3.14 })
    })
    test("returns undefined value for NaN regression", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "q", output: "nope" }
        expect(convertToAutomlRow(item, "regression")).toEqual({ textContent: "q" })
    })
})
