// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

interface TrainingItem{
    instruction?:string
    input?:string
    output?:string
    text?:string
    messages?:Array<{role:string;content:string}>
}

function formatAsJsonl(items:TrainingItem[]):string{
    return items.map(item=>JSON.stringify(item)).join("\n")
}

function formatAsJson(items:TrainingItem[]):string{
    return JSON.stringify(items,null,2)
}

function formatAsCsv(items:TrainingItem[]):string{
    let header="instruction,input,output"
    let rows=items.map(item=>{
        let instruction=(item.instruction||"").replace(/"/g,'""')
        let input=(item.input||"").replace(/"/g,'""')
        let output=(item.output||"").replace(/"/g,'""')
        return `"${instruction}","${input}","${output}"`
    })
    return [header,...rows].join("\n")
}

function formatAsText(items:TrainingItem[]):string{
    return items.map(item=>{
        if(item.text) return item.text
        let parts:string[]=[]
        if(item.instruction) parts.push(`Instruction: ${item.instruction}`)
        if(item.input) parts.push(`Input: ${item.input}`)
        if(item.output) parts.push(`Output: ${item.output}`)
        return parts.join("\n")
    }).join("\n\n---\n\n")
}

describe("formatAsJsonl",()=>{
    test("formats single item as JSONL",()=>{
        let items:TrainingItem[]=[{instruction:"test",input:"hello",output:"world"}]
        let result=formatAsJsonl(items)
        expect(result).toBe('{"instruction":"test","input":"hello","output":"world"}')
    })

    test("formats multiple items with newline separator",()=>{
        let items:TrainingItem[]=[
            {instruction:"q1",input:"i1",output:"o1"},
            {instruction:"q2",input:"i2",output:"o2"}
        ]
        let result=formatAsJsonl(items)
        let lines=result.split("\n")
        expect(lines).toHaveLength(2)
        expect(JSON.parse(lines[0])).toEqual({instruction:"q1",input:"i1",output:"o1"})
    })

    test("handles empty array",()=>{
        expect(formatAsJsonl([])).toBe("")
    })

    test("handles text format items",()=>{
        let items:TrainingItem[]=[{text:"raw text content"}]
        let result=formatAsJsonl(items)
        expect(JSON.parse(result)).toEqual({text:"raw text content"})
    })

    test("handles chatml format items",()=>{
        let items:TrainingItem[]=[{messages:[{role:"user",content:"hi"}]}]
        let result=formatAsJsonl(items)
        let parsed=JSON.parse(result)
        expect(parsed.messages).toHaveLength(1)
    })

    test("handles special characters in content",()=>{
        let items:TrainingItem[]=[{instruction:'He said "hello"',input:"test",output:"done"}]
        let result=formatAsJsonl(items)
        let parsed=JSON.parse(result)
        expect(parsed.instruction).toBe('He said "hello"')
    })

    test("handles unicode content",()=>{
        let items:TrainingItem[]=[{instruction:"こんにちは",input:"世界",output:"你好"}]
        let result=formatAsJsonl(items)
        let parsed=JSON.parse(result)
        expect(parsed.instruction).toBe("こんにちは")
    })
})

describe("formatAsJson",()=>{
    test("formats as pretty-printed JSON array",()=>{
        let items:TrainingItem[]=[{instruction:"test",input:"hello",output:"world"}]
        let result=formatAsJson(items)
        let parsed=JSON.parse(result)
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed).toHaveLength(1)
    })

    test("handles empty array",()=>{
        let result=formatAsJson([])
        expect(JSON.parse(result)).toEqual([])
    })

    test("preserves all fields",()=>{
        let items:TrainingItem[]=[{instruction:"q",input:"i",output:"o",text:"t"}]
        let result=formatAsJson(items)
        let parsed=JSON.parse(result)
        expect(parsed[0].instruction).toBe("q")
        expect(parsed[0].text).toBe("t")
    })
})

describe("formatAsCsv",()=>{
    test("includes header row",()=>{
        let result=formatAsCsv([])
        expect(result.startsWith("instruction,input,output")).toBe(true)
    })

    test("formats items as CSV rows",()=>{
        let items:TrainingItem[]=[{instruction:"test",input:"hello",output:"world"}]
        let result=formatAsCsv(items)
        let lines=result.split("\n")
        expect(lines).toHaveLength(2)
        expect(lines[1]).toContain("test")
        expect(lines[1]).toContain("hello")
        expect(lines[1]).toContain("world")
    })

    test("escapes double quotes in content",()=>{
        let items:TrainingItem[]=[{instruction:'He said "hi"',input:"test",output:"done"}]
        let result=formatAsCsv(items)
        expect(result).toContain('""hi""')
    })

    test("handles empty fields",()=>{
        let items:TrainingItem[]=[{instruction:"",input:"",output:""}]
        let result=formatAsCsv(items)
        let lines=result.split("\n")
        expect(lines[1]).toBe('"","",""')
    })

    test("handles missing fields",()=>{
        let items:TrainingItem[]=[{}]
        let result=formatAsCsv(items)
        let lines=result.split("\n")
        expect(lines[1]).toBe('"","",""')
    })
})

describe("formatAsText",()=>{
    test("formats instruction items with labels",()=>{
        let items:TrainingItem[]=[{instruction:"Be helpful",input:"Hello",output:"Hi there"}]
        let result=formatAsText(items)
        expect(result).toContain("Instruction: Be helpful")
        expect(result).toContain("Input: Hello")
        expect(result).toContain("Output: Hi there")
    })

    test("formats text items directly",()=>{
        let items:TrainingItem[]=[{text:"Raw content here"}]
        let result=formatAsText(items)
        expect(result).toContain("Raw content here")
        expect(result).not.toContain("Instruction:")
    })

    test("separates items with divider",()=>{
        let items:TrainingItem[]=[
            {instruction:"q1",input:"i1",output:"o1"},
            {instruction:"q2",input:"i2",output:"o2"}
        ]
        let result=formatAsText(items)
        expect(result).toContain("---")
    })

    test("handles items with partial fields",()=>{
        let items:TrainingItem[]=[{instruction:"Just instruction"}]
        let result=formatAsText(items)
        expect(result).toContain("Instruction: Just instruction")
        expect(result).not.toContain("Input:")
    })

    test("handles empty array",()=>{
        expect(formatAsText([])).toBe("")
    })
})
