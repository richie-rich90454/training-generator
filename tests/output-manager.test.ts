// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import OutputManager from "../src/renderer/outputManager.js"
import type { TrainingItem } from "../src/types/index.js"
function makeApp(outputFormat: string="jsonl", exportFormat?: string): any {
    return {
        uiManager: {
            outputFormat: { value: outputFormat },
            exportFormat: exportFormat ? { value: exportFormat } : undefined,
        },
        addLog: vi.fn(),
    }
}
describe("OutputManager createTrainingItem", () => {
    let formats=["jsonl", "json", "csv", "text", "chatml"]
    let processingTypes=["instruction", "conversation", "chunking"]
    formats.forEach(format=>{
        processingTypes.forEach(type=>{
            it(`creates item for ${format}/${type}`, () => {
                let app=makeApp(format)
                let manager=new OutputManager(app)
                let items=manager.createTrainingItem("input text", "output text", type)
                expect(items.length).toBeGreaterThan(0)
            })
        })
    })
    it("creates chatml from instruction q/a pairs", () => {
        let app=makeApp("chatml")
        let manager=new OutputManager(app)
        let output="Question: What is 2+2?\nAnswer: 4"
        let items=manager.createTrainingItem("input", output, "instruction")
        expect(items[0].messages).toBeDefined()
    })
    it("creates csv from instruction q/a pairs", () => {
        let app=makeApp("csv")
        let manager=new OutputManager(app)
        let output="Question: What is 2+2?\nAnswer: 4"
        let items=manager.createTrainingItem("input", output, "instruction")
        expect(items[0].input).toBe("What is 2+2?")
        expect(items[0].output).toBe("4")
    })
    it("creates text from conversation turns", () => {
        let app=makeApp("text")
        let manager=new OutputManager(app)
        let output="User: Hello\nAssistant: Hi there"
        let items=manager.createTrainingItem("input", output, "conversation")
        expect(items[0].text).toBe("Hi there")
    })
    it("creates chatml conversation as single message array", () => {
        let app=makeApp("chatml")
        let manager=new OutputManager(app)
        let output="User: Hello\nAssistant: Hi"
        let items=manager.createTrainingItem("input", output, "conversation")
        expect(items[0].messages!.length).toBe(2)
    })
    it("falls back to direct input/output when no pairs parsed", () => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        let items=manager.createTrainingItem("in", "out", "instruction")
        expect(items[0].instruction).toBeDefined()
        expect(items[0].input).toBe("in")
        expect(items[0].output).toBe("out")
    })
})
describe("OutputManager parseQuestionAnswerPairs", () => {
    let manager: OutputManager
    beforeEach(()=>{
        manager=new OutputManager(makeApp())
    })
    it("parses Question/Answer format", () => {
        let text="Question: What is 2+2?\nAnswer: 4"
        let pairs=manager.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2?")
        expect(pairs[0].answer).toBe("4")
    })
    it("parses Q: A: format", () => {
        let text="Q: What is 2+2?\nA: 4"
        let pairs=manager.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
    })
    it("parses multiple pairs", () => {
        let text="Question: Q1\nAnswer: A1\nQuestion: Q2\nAnswer: A2"
        let pairs=manager.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
    })
    it("returns empty for non-string", () => {
        let pairs=manager.parseQuestionAnswerPairs(null as any)
        expect(pairs).toEqual([])
    })
    it("returns empty for unmatched text", () => {
        let pairs=manager.parseQuestionAnswerPairs("just some text")
        expect(pairs).toEqual([])
    })
    it("handles long text without regex fallback", () => {
        let text="Question: Q\nAnswer: A"+"x".repeat(200000)
        let pairs=manager.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
    })
})
describe("OutputManager parseConversationTurns", () => {
    let manager: OutputManager
    beforeEach(()=>{
        manager=new OutputManager(makeApp())
    })
    it("parses User/Assistant format", () => {
        let text="User: Hello\nAssistant: Hi"
        let turns=manager.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("Hello")
        expect(turns[0].assistant).toBe("Hi")
    })
    it("parses Human/Assistant format", () => {
        let text="Human: Hello\nAssistant: Hi"
        let turns=manager.parseConversationTurns(text)
        expect(turns.length).toBe(1)
    })
    it("parses multiple turns", () => {
        let text="User: Hi\nAssistant: Hello\nUser: Bye\nAssistant: Goodbye"
        let turns=manager.parseConversationTurns(text)
        expect(turns.length).toBe(2)
    })
    it("returns empty for non-string", () => {
        let turns=manager.parseConversationTurns(null as any)
        expect(turns).toEqual([])
    })
    it("returns empty for unmatched text", () => {
        let turns=manager.parseConversationTurns("no turns here")
        expect(turns).toEqual([])
    })
})
describe("OutputManager exportOutput", () => {
    beforeEach(()=>{
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: true })),
            },
        })
    })
    it("warns when no data", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        await manager.exportOutput("jsonl")
        expect(app.addLog).toHaveBeenCalledWith("No data to export", "warning")
    })
    it("exports jsonl", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports json", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.exportOutput("json")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports csv", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.exportOutput("csv")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports text", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "text", text: "hello" }]
        await manager.exportOutput("text")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("cancels when no save path", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async()=>null),
                saveFile: vi.fn(),
            },
        })
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "text", text: "hello" }]
        await manager.exportOutput("text")
        expect(app.addLog).toHaveBeenCalledWith("Export cancelled", "info")
    })
    it("logs error on save failure", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: false, error: "disk full" })),
            },
        })
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "text", text: "hello" }]
        await manager.exportOutput("text")
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("disk full"), "error")
    })
    it("splits large output", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: true })),
            },
        })
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=Array.from({ length: 100001 }, (_, i)=>({ format: "text", text: `item ${i}` }))
        await manager.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalledTimes(2)
    })
})
describe("OutputManager copyOutput", () => {
    let clipboard: any
    beforeEach(()=>{
        clipboard={ format: "text", text: "" }
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async(t: string)=>{ clipboard.text=t }),
            },
        })
    })
    it("warns when no data", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        await manager.copyOutput()
        expect(app.addLog).toHaveBeenCalledWith("No data to copy", "warning")
    })
    it("copies jsonl", async() => {
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.copyOutput()
        expect(clipboard.text).toContain("instruction")
    })
    it("copies json", async() => {
        let app=makeApp("jsonl", "json")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.copyOutput()
        expect(JSON.parse(clipboard.text)[0].input).toBe("in")
    })
    it("copies csv", async() => {
        let app=makeApp("jsonl", "csv")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "instruction", instruction: "test", input: "in", output: "out" }]
        await manager.copyOutput()
        expect(clipboard.text).toContain("instruction,input,output")
    })
    it("copies text", async() => {
        let app=makeApp("jsonl", "text")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "text", text: "hello" }]
        await manager.copyOutput()
        expect(clipboard.text).toBe("hello")
    })
    it("logs error on clipboard failure", async() => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async()=>{ throw new Error("clipboard denied") }),
            },
        })
        let app=makeApp("jsonl")
        let manager=new OutputManager(app)
        manager.outputData=[{ format: "text", text: "hello" }]
        await manager.copyOutput()
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("clipboard denied"), "error")
    })
})
