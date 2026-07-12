// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { exportJSONL, exportJSONArray, exportCSV, csvEscape, ExporterRegistry, JSONLExporter, JSONArrayExporter, CSVExporter, TextExporter, createDefaultExporterRegistry } from "../src/renderer/exportFormats.js"
import type { TrainingItem } from "../src/types/index.js"
function item(props: Partial<TrainingItem> & { format: string }): TrainingItem {
    return props as TrainingItem
}
describe("ExportFormats csvEscape", () => {
    it("does not quote simple text", () => {
        expect(csvEscape("hello")).toBe("hello")
    })
    it("doubles quotes", () => {
        expect(csvEscape('say "hello"')).toBe('"say ""hello"""')
    })
    it("quotes commas", () => {
        expect(csvEscape("a,b")).toBe('"a,b"')
    })
    it("quotes newlines", () => {
        expect(csvEscape("a\nb")).toBe('"a\nb"')
    })
    it("prefixes formula characters", () => {
        expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)")
        expect(csvEscape("+123")).toBe("'+123")
        expect(csvEscape("-123")).toBe("'-123")
        expect(csvEscape("@user")).toBe("'@user")
    })
    it("quotes tab prefix", () => {
        expect(csvEscape("\thello")).toBe("'\thello")
    })
})
describe("ExportFormats exportJSONL", () => {
    it("exports empty array", () => {
        expect(exportJSONL([])).toBe("")
    })
    it("exports one item per line", () => {
        let result = exportJSONL([item({ format: "instruction", input: "in", output: "out" })])
        expect(result.trim()).toContain('"input":"in"')
        expect(result.trim()).toContain('"output":"out"')
    })
    it("ends with newline", () => {
        expect(exportJSONL([item({ format: "text", text: "a" })])).toMatch(/\n$/)
    })
})
describe("ExportFormats exportJSONArray", () => {
    it("exports empty array pretty", () => {
        expect(exportJSONArray([])).toBe("[]")
    })
    it("exports items as array", () => {
        let result = exportJSONArray([item({ format: "text", text: "a" })])
        expect(result).toContain("[")
        expect(result).toContain("]")
        expect(result).toContain('"text": "a"')
    })
})
describe("ExportFormats exportCSV", () => {
    it("exports empty list with default header", () => {
        expect(exportCSV([])).toContain("instruction,input,output")
    })
    it("exports instruction items", () => {
        let result = exportCSV([item({ format: "instruction", instruction: "q", input: "i", output: "o" })])
        expect(result).toContain("q")
        expect(result).toContain("i")
        expect(result).toContain("o")
    })
    it("exports messages when majority chatml", () => {
        let result = exportCSV([
            item({ format: "chatml", messages: [{ role: "user", content: "hi" }] }),
            item({ format: "chatml", messages: [{ role: "user", content: "bye" }] })
        ])
        expect(result).toContain("messages")
        expect(result).toContain('"hi"')
    })
    it("exports text when majority text", () => {
        let result = exportCSV([
            item({ format: "text", text: "hello" }),
            item({ format: "text", text: "world" }),
            item({ format: "instruction", input: "in", output: "out" })
        ])
        expect(result).toContain("text")
        expect(result).toContain("hello")
        expect(result).toContain("world")
    })
    it("includes bom", () => {
        expect(exportCSV([]).charCodeAt(0)).toBe(0xFEFF)
    })
})
describe("ExportFormats ExporterRegistry", () => {
    let registry: ExporterRegistry
    beforeEach(() => {
        registry = new ExporterRegistry()
    })
    it("starts empty", () => {
        expect(registry.list().length).toBe(0)
        expect(registry.getSupportedFormats()).toEqual([])
    })
    it("registers and retrieves exporter", () => {
        registry.register(new JSONLExporter())
        expect(registry.get("jsonl")).toBeDefined()
        expect(registry.list().length).toBe(1)
    })
    it("unregisters exporter", () => {
        registry.register(new JSONLExporter())
        registry.unregister("jsonl")
        expect(registry.get("jsonl")).toBeUndefined()
    })
    it("exports via registered exporter", () => {
        registry.register(new JSONLExporter())
        let result = registry.export("jsonl", [item({ format: "text", text: "a" })])
        expect(result).toContain('"text":"a"')
    })
    it("throws for unsupported format", () => {
        expect(() => registry.export("missing", [])).toThrow("Unsupported export format")
    })
})
describe("ExportFormats exporters", () => {
    it("JSONLExporter exports jsonl", () => {
        let exporter = new JSONLExporter()
        expect(exporter.name).toBe("jsonl")
        expect(exporter.extension).toBe(".jsonl")
        let result = exporter.export([item({ format: "text", text: "a" })])
        expect(result).toContain('"text":"a"')
    })
    it("JSONArrayExporter exports pretty json", () => {
        let exporter = new JSONArrayExporter()
        expect(exporter.name).toBe("json")
        let result = exporter.export([item({ format: "text", text: "a" })])
        expect(result).toContain("[")
    })
    it("CSVExporter includes metadata when requested", () => {
        let exporter = new CSVExporter()
        let result = exporter.export([item({ format: "instruction", instruction: "q", input: "i", output: "o", metadata: { topic: "x" } })], { includeMetadata: true })
        expect(result).toContain("metadata")
        expect(result).toContain('""topic"":""x""')
    })
    it("TextExporter joins text items", () => {
        let exporter = new TextExporter()
        let result = exporter.export([
            item({ format: "text", text: "hello" }),
            item({ format: "text", text: "world" })
        ])
        expect(result).toBe("hello\nworld")
    })
    it("TextExporter falls back to output", () => {
        let exporter = new TextExporter()
        let result = exporter.export([item({ format: "instruction", output: "out" })])
        expect(result).toBe("out")
    })
})
describe("ExportFormats createDefaultExporterRegistry", () => {
    it("registers default exporters", () => {
        let registry = createDefaultExporterRegistry()
        expect(registry.getSupportedFormats()).toContain("jsonl")
        expect(registry.getSupportedFormats()).toContain("json")
        expect(registry.getSupportedFormats()).toContain("csv")
    })
})
