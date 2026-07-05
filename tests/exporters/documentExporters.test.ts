// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest"
const pdfState=vi.hoisted(()=>({
    installed: false,
    PdfDocument: vi.fn()
}))
vi.mock("pdfkit", ()=>{
    return {
        get default(){
            return pdfState.installed?pdfState.PdfDocument:undefined
        }
    }
})
import type { TrainingItem } from "../../src/types/index.js"
import { Exporter } from "../../src/renderer/exportFormats.js"
import {
    escapeHtml,
    escapeMarkdown,
    itemToMarkdown,
    itemToHtml,
    MarkdownExporter,
    HtmlExporter,
    PdfExporter
} from "../../src/renderer/exporters/documentExporters.js"
beforeEach(()=>{
    vi.clearAllMocks()
    pdfState.installed=false
})
describe("escapeHtml", ()=>{
    test("escapes ampersand", ()=>{
        expect(escapeHtml("a & b")).toBe("a &amp; b")
    })
    test("escapes less than", ()=>{
        expect(escapeHtml("a < b")).toBe("a &lt; b")
    })
    test("escapes greater than", ()=>{
        expect(escapeHtml("a > b")).toBe("a &gt; b")
    })
    test("escapes double quote", ()=>{
        expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c")
    })
    test("escapes all special chars", ()=>{
        expect(escapeHtml("<&>\"\"")).toBe("&lt;&amp;&gt;&quot;&quot;")
    })
})
describe("escapeMarkdown", ()=>{
    test("escapes asterisk", ()=>{
        expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*")
    })
    test("escapes underscore", ()=>{
        expect(escapeMarkdown("_italic_")).toBe("\\_italic\\_")
    })
    test("escapes backtick", ()=>{
        expect(escapeMarkdown("`code`")).toBe("\\`code\\`")
    })
})
describe("itemToMarkdown", ()=>{
    test("includes index", ()=>{
        let item: TrainingItem={ format: "text", text: "hello" }
        let result=itemToMarkdown(item, 4)
        expect(result.startsWith("## Item 5")).toBe(true)
    })
    test("renders instruction item", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "inst", input: "in", output: "out" }
        let result=itemToMarkdown(item, 0)
        expect(result).toContain("**Instruction:** inst")
        expect(result).toContain("**Input:** in")
        expect(result).toContain("**Output:** out")
    })
    test("renders messages item", ()=>{
        let item: TrainingItem={ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hello" }, { role: "assistant", content: "hi" }] }
        let result=itemToMarkdown(item, 0)
        expect(result).toContain("### system\nsys")
        expect(result).toContain("### user\nhello")
        expect(result).toContain("### assistant\nhi")
    })
    test("renders text item", ()=>{
        let item: TrainingItem={ format: "text", text: "content" }
        let result=itemToMarkdown(item, 0)
        expect(result).toContain("## Item 1\n\ncontent")
    })
    test("escapes markdown characters", ()=>{
        let item: TrainingItem={ format: "text", text: "*bold* and _italic_" }
        let result=itemToMarkdown(item, 0)
        expect(result).toContain("\\*bold\\* and \\_italic\\_")
    })
})
describe("itemToHtml", ()=>{
    test("includes index", ()=>{
        let item: TrainingItem={ format: "text", text: "hello" }
        let result=itemToHtml(item, 2)
        expect(result).toContain("<h2>Item 3</h2>")
    })
    test("renders instruction item", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "inst", input: "in", output: "out" }
        let result=itemToHtml(item, 0)
        expect(result).toContain("<strong>Instruction:</strong> inst")
        expect(result).toContain("<strong>Input:</strong> in")
        expect(result).toContain("<strong>Output:</strong> out")
    })
    test("renders messages", ()=>{
        let item: TrainingItem={ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hello" }] }
        let result=itemToHtml(item, 0)
        expect(result).toContain("<h3>system</h3>")
        expect(result).toContain("<p>sys</p>")
        expect(result).toContain("<h3>user</h3>")
        expect(result).toContain("<p>hello</p>")
    })
    test("escapes html entities", ()=>{
        let item: TrainingItem={ format: "text", text: "<script>alert('x')</script>" }
        let result=itemToHtml(item, 0)
        expect(result).toContain("&lt;script&gt;")
        expect(result).not.toContain("<script>")
    })
})
describe("MarkdownExporter", ()=>{
    test("name and extension correct", ()=>{
        let exporter: Exporter=new MarkdownExporter()
        expect(exporter.name).toBe("markdown")
        expect(exporter.mimeType).toBe("text/markdown")
        expect(exporter.extension).toBe(".md")
        expect(typeof exporter.export).toBe("function")
    })
    test("renders instruction item", ()=>{
        let exporter=new MarkdownExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let result=exporter.export(items)
        expect(result).toContain("## Item 1")
        expect(result).toContain("**Instruction:** q")
        expect(result).toContain("**Input:** i")
        expect(result).toContain("**Output:** a")
    })
    test("renders messages item", ()=>{
        let exporter=new MarkdownExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }] }]
        let result=exporter.export(items)
        expect(result).toContain("### user")
        expect(result).toContain("hi")
    })
    test("renders text item", ()=>{
        let exporter=new MarkdownExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello" }]
        let result=exporter.export(items)
        expect(result).toContain("## Item 1\n\nhello")
    })
    test("escapes markdown characters", ()=>{
        let exporter=new MarkdownExporter()
        let items: TrainingItem[]=[{ format: "text", text: "*bold*" }]
        let result=exporter.export(items)
        expect(result).toContain("\\*bold\\*")
    })
    test("handles multiple items", ()=>{
        let exporter=new MarkdownExporter()
        let items: TrainingItem[]=[
            { format: "text", text: "one" },
            { format: "text", text: "two" }
        ]
        let result=exporter.export(items)
        expect(result).toContain("## Item 1")
        expect(result).toContain("## Item 2")
        expect(result).toContain("one")
        expect(result).toContain("two")
    })
    test("handles empty items", ()=>{
        let exporter=new MarkdownExporter()
        let result=exporter.export([])
        expect(result).toBe("")
    })
})
describe("HtmlExporter", ()=>{
    test("name and extension correct", ()=>{
        let exporter: Exporter=new HtmlExporter()
        expect(exporter.name).toBe("html")
        expect(exporter.mimeType).toBe("text/html")
        expect(exporter.extension).toBe(".html")
        expect(typeof exporter.export).toBe("function")
    })
    test("renders valid html structure", ()=>{
        let exporter=new HtmlExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello" }]
        let result=exporter.export(items)
        expect(result.startsWith("<html><head><meta charset=\"UTF-8\"><title>Training Data</title></head><body>")).toBe(true)
        expect(result.endsWith("</body></html>")).toBe(true)
        expect(result).toContain("<section>")
        expect(result).toContain("</section>")
    })
    test("renders messages", ()=>{
        let exporter=new HtmlExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "system", content: "sys" }, { role: "assistant", content: "a" }] }]
        let result=exporter.export(items)
        expect(result).toContain("<h3>system</h3>")
        expect(result).toContain("<h3>assistant</h3>")
        expect(result).toContain("<p>sys</p>")
        expect(result).toContain("<p>a</p>")
    })
    test("escapes html entities", ()=>{
        let exporter=new HtmlExporter()
        let items: TrainingItem[]=[{ format: "text", text: "<tag>" }]
        let result=exporter.export(items)
        expect(result).toContain("&lt;tag&gt;")
        expect(result).not.toContain("<tag>")
    })
    test("handles multiple items", ()=>{
        let exporter=new HtmlExporter()
        let items: TrainingItem[]=[
            { format: "text", text: "one" },
            { format: "text", text: "two" }
        ]
        let result=exporter.export(items)
        expect(result).toContain("<h2>Item 1</h2>")
        expect(result).toContain("<h2>Item 2</h2>")
    })
    test("handles empty items", ()=>{
        let exporter=new HtmlExporter()
        let result=exporter.export([])
        expect(result).toContain("<body></body>")
    })
})
describe("PdfExporter", ()=>{
    test("name and extension correct", ()=>{
        let exporter: Exporter=new PdfExporter()
        expect(exporter.name).toBe("pdf")
        expect(exporter.mimeType).toBe("application/pdf")
        expect(exporter.extension).toBe(".pdf")
        expect(typeof exporter.export).toBe("function")
    })
    test("throws when library missing", async()=>{
        let exporter=new PdfExporter()
        await expect(exporter.export([])).rejects.toThrow("PDF library not installed")
    })
    test("returns buffer when library available", async()=>{
        pdfState.installed=true
        let exporter=new PdfExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello" }]
        let result=await exporter.export(items)
        expect(Buffer.isBuffer(result)).toBe(true)
    })
    test("buffer contains html content when library available", async()=>{
        pdfState.installed=true
        let exporter=new PdfExporter()
        let items: TrainingItem[]=[{ format: "text", text: "hello" }]
        let result=await exporter.export(items)
        expect(result.toString()).toContain("<html>")
        expect(result.toString()).toContain("hello")
    })
})
