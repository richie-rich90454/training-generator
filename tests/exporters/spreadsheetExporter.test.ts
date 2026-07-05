// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest"
const xlsxState=vi.hoisted(()=>({
    installed: true,
    capturedAoa: null as any[][]|null,
    utils: {
        book_new: vi.fn(()=>({})),
        aoa_to_sheet: vi.fn((aoa: any[][])=>{
            xlsxState.capturedAoa=aoa
            return {}
        }),
        book_append_sheet: vi.fn()
    },
    write: vi.fn(()=>Buffer.from("xlsx"))
}))
vi.mock("xlsx", ()=>{
    return {
        get utils(){
            return xlsxState.installed?xlsxState.utils:undefined
        },
        get write(){
            return xlsxState.installed?xlsxState.write:undefined
        }
    }
})
import type { TrainingItem } from "../../src/types/index.js"
import { Exporter } from "../../src/renderer/exportFormats.js"
import { CsvExporter, TsvExporter, XlsxExporter, itemsToRows, flattenItem } from "../../src/renderer/exporters/spreadsheetExporter.js"
beforeEach(()=>{
    vi.clearAllMocks()
    xlsxState.installed=true
    xlsxState.capturedAoa=null
})
describe("CsvExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new CsvExporter()
        expect(exporter.name).toBe("csv")
        expect(exporter.mimeType).toBe("text/csv")
        expect(exporter.extension).toBe(".csv")
        expect(typeof exporter.export).toBe("function")
    })
    test("exports instruction format", ()=>{
        let exporter=new CsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let result=exporter.export(items)
        expect(result).toBe("\uFEFFinstruction,input,output\nq,i,a\n")
    })
    test("exports messages format", ()=>{
        let exporter=new CsvExporter()
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }] }]
        let result=exporter.export(items)
        let lines=result.trim().split("\n")
        expect(lines[0]).toBe("messages")
        expect(lines[1].startsWith('"')).toBe(true)
        expect(lines[1]).toContain("role")
        expect(lines[1]).toContain("user")
    })
    test("respects custom columns", ()=>{
        let exporter=new CsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", input: "b", output: "c" }]
        let result=exporter.export(items, { columns: ["output", "instruction"] })
        expect(result).toBe("\uFEFFoutput,instruction\nc,a\n")
    })
    test("escapes commas and quotes", ()=>{
        let exporter=new CsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a, b", input: 'say "hi"', output: "c" }]
        let result=exporter.export(items)
        expect(result).toBe('\uFEFFinstruction,input,output\n"a, b","say ""hi""",c\n')
    })
    test("BOM present", ()=>{
        let exporter=new CsvExporter()
        let result=exporter.export([])
        expect(result.startsWith("\uFEFF")).toBe(true)
    })
    test("empty items returns default header", ()=>{
        let exporter=new CsvExporter()
        let result=exporter.export([])
        expect(result).toBe("\uFEFFinstruction,input,output\n")
    })
})
describe("TsvExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new TsvExporter()
        expect(exporter.name).toBe("tsv")
        expect(exporter.mimeType).toBe("text/tab-separated-values")
        expect(exporter.extension).toBe(".tsv")
        expect(typeof exporter.export).toBe("function")
    })
    test("tab-delimits", ()=>{
        let exporter=new TsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let result=exporter.export(items)
        expect(result).toBe("instruction\tinput\toutput\nq\ti\ta\n")
    })
    test("escapes tabs", ()=>{
        let exporter=new TsvExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a\tb", input: "c", output: "d" }]
        let result=exporter.export(items)
        expect(result).toBe('instruction\tinput\toutput\n"a\tb"\tc\td\n')
    })
    test("no BOM by default", ()=>{
        let exporter=new TsvExporter()
        let result=exporter.export([])
        expect(result.startsWith("\uFEFF")).toBe(false)
    })
    test("empty items returns default header", ()=>{
        let exporter=new TsvExporter()
        let result=exporter.export([])
        expect(result).toBe("instruction\tinput\toutput\n")
    })
})
describe("XlsxExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new XlsxExporter()
        expect(exporter.name).toBe("xlsx")
        expect(exporter.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        expect(exporter.extension).toBe(".xlsx")
        expect(typeof exporter.export).toBe("function")
    })
    test("throws when xlsx not installed", async()=>{
        xlsxState.installed=false
        let exporter=new XlsxExporter()
        await expect(exporter.export([])).rejects.toThrow("xlsx not installed")
        xlsxState.installed=true
    })
    test("returns buffer when xlsx available", async()=>{
        let exporter=new XlsxExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let result=await exporter.export(items)
        expect(Buffer.isBuffer(result)).toBe(true)
        expect(result.toString()).toBe("xlsx")
    })
    test("builds worksheet from rows", async()=>{
        let exporter=new XlsxExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        await exporter.export(items)
        expect(xlsxState.capturedAoa).not.toBeNull()
        expect(xlsxState.capturedAoa![0]).toEqual(["instruction","input","output"])
        expect(xlsxState.capturedAoa![1]).toEqual(["q","i","a"])
    })
})
describe("itemsToRows", ()=>{
    test("flattens instruction items", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let rows=itemsToRows(items)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toEqual({ instruction: "q", input: "i", output: "a" })
    })
    test("flattens messages items", ()=>{
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }] }]
        let rows=itemsToRows(items)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toEqual({ messages: '[{"role":"user","content":"hi"}]' })
    })
    test("uses custom columns", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }]
        let rows=itemsToRows(items, ["output"])
        expect(rows[0]).toEqual({ output: "b" })
    })
    test("returns empty array for empty items", ()=>{
        expect(itemsToRows([])).toEqual([])
    })
})
describe("flattenItem", ()=>{
    test("stringifies messages", ()=>{
        let item: TrainingItem={ format: "chatml", messages: [{ role: "user", content: "hi" }] }
        let result=flattenItem(item, ["messages"])
        expect(result.messages).toBe('[{"role":"user","content":"hi"}]')
    })
    test("stringifies non-string values", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "a", output: "b", metadata: { topic: "x" } }
        let result=flattenItem(item, ["metadata"])
        expect(result.metadata).toBe('{"topic":"x"}')
    })
    test("returns empty string for missing fields", ()=>{
        let item: TrainingItem={ format: "instruction", instruction: "a" }
        let result=flattenItem(item, ["input"])
        expect(result.input).toBe("")
    })
})
