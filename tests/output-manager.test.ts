// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createOutputStore, type OutputStore, type ExportFormat } from "../src/renderer/stores/outputStore.js"
import { withRoot } from "./setup.js"
import type { TrainingItem } from "../src/types/index.js"
let disposes: (() => void)[] = []
function makeStore(): OutputStore {
    return withRoot((dispose) => {
        disposes.push(dispose)
        return createOutputStore()
    })
}
function setOutputData(store: OutputStore, items: TrainingItem[]): void {
    store.clearOutput()
    store.appendOutput(items)
}
beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
    for (let dispose of disposes) dispose()
    disposes = []
    vi.restoreAllMocks()
})
describe("OutputStore createTrainingItem", () => {
    let formats=["jsonl", "json", "csv", "text", "chatml"]
    let processingTypes=["instruction", "conversation", "chunking"]
    formats.forEach(format=>{
        processingTypes.forEach(type=>{
            it(`creates item for ${format}/${type}`, () => {
                let store: OutputStore=makeStore()
                // Use format-appropriate output so instruction/conversation parse correctly
                let output: string
                if (type === "instruction") {
                    output = "Question: What is 2+2?\nAnswer: 4"
                } else if (type === "conversation") {
                    output = "User: Hello\nAssistant: Hi there"
                } else {
                    output = "output text"
                }
                let items=store.createTrainingItem("input text", output, type, format)
                expect(items.length).toBeGreaterThan(0)
            })
        })
    })
    it("creates chatml from instruction q/a pairs", () => {
        let store: OutputStore=makeStore()
        let output="Question: What is 2+2?\nAnswer: 4"
        let items=store.createTrainingItem("input", output, "instruction", "chatml")
        expect(items[0].messages).toBeDefined()
    })
    it("creates csv from instruction q/a pairs", () => {
        let store: OutputStore=makeStore()
        let output="Question: What is 2+2?\nAnswer: 4"
        let items=store.createTrainingItem("input", output, "instruction", "csv")
        expect(items[0].input).toBe("What is 2+2?")
        expect(items[0].output).toBe("4")
    })
    it("creates text from conversation turns", () => {
        let store: OutputStore=makeStore()
        let output="User: Hello\nAssistant: Hi there"
        let items=store.createTrainingItem("input", output, "conversation", "text")
        expect(items[0].text).toBe("Hi there")
    })
    it("creates chatml conversation as single message array", () => {
        let store: OutputStore=makeStore()
        let output="User: Hello\nAssistant: Hi"
        let items=store.createTrainingItem("input", output, "conversation", "chatml")
        expect(items[0].messages!.length).toBe(2)
    })
    it("returns empty array when no pairs parsed for instruction", () => {
        let store: OutputStore=makeStore()
        // Non-Q&A output for instruction type should return empty array
        // (no fallback to prevent trash in the dataset)
        let items=store.createTrainingItem("in", "out", "instruction", "jsonl")
        expect(items.length).toBe(0)
    })
})
describe("OutputStore parseQuestionAnswerPairs", () => {
    let store: OutputStore
    beforeEach(()=>{
        store=makeStore()
    })
    it("parses Question/Answer format", () => {
        let text="Question: What is 2+2?\nAnswer: 4"
        let pairs=store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2?")
        expect(pairs[0].answer).toBe("4")
    })
    it("parses Q: A: format", () => {
        let text="Q: What is 2+2?\nA: 4"
        let pairs=store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
    })
    it("parses multiple pairs", () => {
        let text="Question: Q1\nAnswer: A1\nQuestion: Q2\nAnswer: A2"
        let pairs=store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
    })
    it("returns empty for non-string", () => {
        let pairs=store.parseQuestionAnswerPairs(null as unknown as string)
        expect(pairs).toEqual([])
    })
    it("returns empty for unmatched text", () => {
        let pairs=store.parseQuestionAnswerPairs("just some text")
        expect(pairs).toEqual([])
    })
    it("handles long text without regex fallback", () => {
        let text="Question: Q\nAnswer: A"+"x".repeat(200000)
        let pairs=store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
    })
})
describe("OutputStore parseConversationTurns", () => {
    let store: OutputStore
    beforeEach(()=>{
        store=makeStore()
    })
    it("parses User/Assistant format", () => {
        let text="User: Hello\nAssistant: Hi"
        let turns=store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("Hello")
        expect(turns[0].assistant).toBe("Hi")
    })
    it("parses Human/Assistant format", () => {
        let text="Human: Hello\nAssistant: Hi"
        let turns=store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
    })
    it("parses multiple turns", () => {
        let text="User: Hi\nAssistant: Hello\nUser: Bye\nAssistant: Goodbye"
        let turns=store.parseConversationTurns(text)
        expect(turns.length).toBe(2)
    })
    it("returns empty for non-string", () => {
        let turns=store.parseConversationTurns(null as unknown as string)
        expect(turns).toEqual([])
    })
    it("returns empty for unmatched text", () => {
        let turns=store.parseConversationTurns("no turns here")
        expect(turns).toEqual([])
    })
})
describe("OutputStore exportOutput", () => {
    beforeEach(()=>{
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: true })),
            },
        })
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("returns early when no data", async() => {
        let store: OutputStore=makeStore()
        await store.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).not.toHaveBeenCalled()
    })
    it("exports jsonl", async() => {
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports json", async() => {
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.exportOutput("json")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports csv", async() => {
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.exportOutput("csv")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("exports text", async() => {
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "text", text: "hello" }])
        await store.exportOutput("text")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("cancels when no save path", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async()=>null),
                saveFile: vi.fn(),
            },
        })
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "text", text: "hello" }])
        await store.exportOutput("text")
        expect(window.electronAPI!.saveFile).not.toHaveBeenCalled()
    })
    it("handles save failure result", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: false, error: "disk full" })),
            },
        })
        let store: OutputStore=makeStore()
        setOutputData(store, [{ format: "text", text: "hello" }])
        await expect(store.exportOutput("text")).resolves.not.toThrow()
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("splits large output", async() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string)=>`/path/${name}`),
                saveFile: vi.fn(async()=>({ success: true })),
            },
        })
        let store: OutputStore=makeStore()
        setOutputData(store, Array.from({ length: 100001 }, (_, i)=>({ format: "text" as const, text: `item ${i}` })))
        await store.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalledTimes(2)
    })
})
describe("OutputStore copyOutput", () => {
    let clipboard: { text: string }
    beforeEach(()=>{
        clipboard={ text: "" }
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async(t: string)=>{ clipboard.text=t }),
            },
        })
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("returns early when no data", async() => {
        let store: OutputStore=makeStore()
        await store.copyOutput()
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })
    it("copies jsonl", async() => {
        let store: OutputStore=makeStore()
        store.setExportFormat("jsonl")
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.copyOutput()
        expect(clipboard.text).toContain("instruction")
    })
    it("copies json", async() => {
        let store: OutputStore=makeStore()
        store.setExportFormat("json")
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.copyOutput()
        expect(JSON.parse(clipboard.text)[0].input).toBe("in")
    })
    it("copies csv", async() => {
        let store: OutputStore=makeStore()
        store.setExportFormat("csv")
        setOutputData(store, [{ format: "instruction", instruction: "test", input: "in", output: "out" }])
        await store.copyOutput()
        expect(clipboard.text).toContain("instruction,input,output")
    })
    it("copies text", async() => {
        let store: OutputStore=makeStore()
        store.setExportFormat("text")
        setOutputData(store, [{ format: "text", text: "hello" }])
        await store.copyOutput()
        expect(clipboard.text).toBe("hello")
    })
    it("rejects on clipboard failure", async() => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async()=>{ throw new Error("clipboard denied") }),
            },
        })
        let store: OutputStore=makeStore()
        store.setExportFormat("jsonl")
        setOutputData(store, [{ format: "text", text: "hello" }])
        await expect(store.copyOutput()).rejects.toThrow("clipboard denied")
    })
})
