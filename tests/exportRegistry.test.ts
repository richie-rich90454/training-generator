import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../src/types/index.js"
import {
    ExportOptions,
    Exporter,
    ExporterRegistry,
    JSONLExporter,
    JSONArrayExporter,
    CSVExporter,
    TextExporter,
    createDefaultExporterRegistry,
    exportFormat,
    exportJSONL,
    exportJSONArray,
    exportCSV,
    csvEscape
} from "../src/renderer/exportFormats.js"
describe("ExporterRegistry", ()=>{
    test("registers exporter", ()=>{
        let registry=new ExporterRegistry()
        let exporter=new JSONLExporter()
        registry.register(exporter)
        expect(registry.get("jsonl")).toBe(exporter)
    })
    test("unregisters exporter", ()=>{
        let registry=new ExporterRegistry()
        registry.register(new JSONLExporter())
        registry.unregister("jsonl")
        expect(registry.get("jsonl")).toBeUndefined()
    })
    test("get returns exporter", ()=>{
        let registry=new ExporterRegistry()
        let exporter=new CSVExporter()
        registry.register(exporter)
        expect(registry.get("csv")).toBe(exporter)
    })
    test("list returns all", ()=>{
        let registry=new ExporterRegistry()
        registry.register(new JSONLExporter())
        registry.register(new CSVExporter())
        expect(registry.list().length).toBe(2)
    })
    test("export delegates", ()=>{
        let registry=new ExporterRegistry()
        registry.register(new JSONLExporter())
        let items: TrainingItem[]=[{ format: "instruction", instruction: "hi", output: "hello" }]
        let result=registry.export("jsonl", items)
        expect(result).toContain("hi")
    })
    test("getSupportedFormats", ()=>{
        let registry=new ExporterRegistry()
        registry.register(new JSONLExporter())
        registry.register(new JSONArrayExporter())
        expect(registry.getSupportedFormats()).toContain("jsonl")
        expect(registry.getSupportedFormats()).toContain("json")
    })
    test("unregistering unknown name is no-op", ()=>{
        let registry=new ExporterRegistry()
        registry.unregister("missing")
        expect(registry.list()).toEqual([])
    })
    test("throws for unsupported format", ()=>{
        let registry=new ExporterRegistry()
        expect(()=>registry.export("missing", [])).toThrow("Unsupported export format")
    })
})
describe("JSONLExporter", ()=>{
    test("exports items as JSONL", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let exporter=new JSONLExporter()
        let result=exporter.export(items)
        expect(result.trim()).toBe(JSON.stringify(items[0]))
    })
    test("pretty option not applicable", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let exporter=new JSONLExporter()
        let plain=exporter.export(items)
        let pretty=exporter.export(items, { pretty: true })
        expect(plain).toBe(pretty)
    })
})
describe("JSONArrayExporter", ()=>{
    test("exports pretty JSON", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let exporter=new JSONArrayExporter()
        let result=exporter.export(items)
        expect(JSON.parse(result)).toEqual(items)
        expect(result.includes("\n")).toBe(true)
    })
})
describe("CSVExporter", ()=>{
    test("exports CSV", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", input: "b", output: "c" }]
        let exporter=new CSVExporter()
        let result=exporter.export(items)
        expect(result).toContain("instruction,input,output")
        expect(result).toContain("a")
        expect(result).toContain("b")
        expect(result).toContain("c")
    })
    test("includes metadata option", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b", metadata: { topic: "test" } }]
        let exporter=new CSVExporter()
        let result=exporter.export(items, { includeMetadata: true })
        expect(result).toContain("metadata")
        expect(result).toContain("topic")
    })
})
describe("TextExporter", ()=>{
    test("exports text", ()=>{
        let items: TrainingItem[]=[{ format: "text", text: "hello world" }]
        let exporter=new TextExporter()
        let result=exporter.export(items)
        expect(result).toBe("hello world")
    })
    test("uses output when no text", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let exporter=new TextExporter()
        let result=exporter.export(items)
        expect(result).toBe("b")
    })
    test("uses messages when available", ()=>{
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }] }]
        let exporter=new TextExporter()
        let result=exporter.export(items)
        expect(result).toBe("hi")
    })
})
describe("createDefaultExporterRegistry", ()=>{
    test("has jsonl, json, csv, text", ()=>{
        let registry=createDefaultExporterRegistry()
        let formats=registry.getSupportedFormats()
        expect(formats).toContain("jsonl")
        expect(formats).toContain("json")
        expect(formats).toContain("csv")
        expect(formats).toContain("text")
    })
})
describe("exportFormat convenience", ()=>{
    test("works", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let result=exportFormat("jsonl", items)
        expect(result).toContain("a")
    })
})
describe("backward compatibility", ()=>{
    test("exportJSONL still works", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        expect(exportJSONL(items)).toContain('"instruction":"a"')
    })
    test("exportJSONArray still works", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let result=exportJSONArray(items)
        expect(JSON.parse(result)).toEqual(items)
    })
    test("exportCSV still works", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", input: "b", output: "c" }]
        let result=exportCSV(items)
        expect(result).toContain("instruction,input,output")
    })
    test("csvEscape still works", ()=>{
        expect(csvEscape('a"b')).toBe('"a""b"')
    })
})
