// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createOutputStore, type OutputStore } from "../src/renderer/stores/outputStore.js"
import { withRoot } from "./setup.js"
import type { TrainingItem } from "../src/types/index.js"
let store: OutputStore
let dispose: () => void
function item(props: Partial<TrainingItem> & { format: string }): TrainingItem {
    return props as TrainingItem
}
beforeEach(() => {
    store = withRoot((d) => {
        dispose = d
        return createOutputStore()
    })
})
afterEach(() => {
    dispose()
    vi.restoreAllMocks()
})
describe("OutputStore export format", () => {
    it("defaults to jsonl", () => {
        expect(store.exportFormat()).toBe("jsonl")
    })
    it("sets csv format", () => {
        store.setExportFormat("csv")
        expect(store.exportFormat()).toBe("csv")
    })
    it("sets chatml format", () => {
        store.setExportFormat("chatml")
        expect(store.exportFormat()).toBe("chatml")
    })
    it("sets text format", () => {
        store.setExportFormat("text")
        expect(store.exportFormat()).toBe("text")
    })
    it("sets json array format", () => {
        store.setExportFormat("json")
        expect(store.exportFormat()).toBe("json")
    })
})
describe("OutputStore hasOutput and itemCount", () => {
    it("has no output initially", () => {
        expect(store.hasOutput()).toBe(false)
        expect(store.itemCount()).toBe(0)
    })
    it("has output after append", () => {
        store.appendOutput([item({ format: "text", text: "hello" })])
        expect(store.hasOutput()).toBe(true)
        expect(store.itemCount()).toBe(1)
    })
    it("counts multiple items", () => {
        store.appendOutput([
            item({ format: "text", text: "a" }),
            item({ format: "text", text: "b" })
        ])
        expect(store.itemCount()).toBe(2)
    })
    it("clears output", () => {
        store.appendOutput([item({ format: "text", text: "hello" })])
        store.clearOutput()
        expect(store.hasOutput()).toBe(false)
        expect(store.itemCount()).toBe(0)
    })
})
describe("OutputStore previewText", () => {
    it("shows empty placeholder", () => {
        expect(store.previewText()).toContain("No output data")
    })
    it("shows total count", () => {
        store.appendOutput([item({ format: "text", text: "a" })])
        expect(store.previewText()).toContain("Total items: 1")
    })
    it("shows all items", () => {
        store.appendOutput([
            item({ format: "text", text: "1" }),
            item({ format: "text", text: "2" }),
            item({ format: "text", text: "3" }),
            item({ format: "text", text: "4" })
        ])
        let preview = store.previewText()
        expect(preview).toContain("4")
        expect(preview).toContain("1")
    })
})
describe("OutputStore parseQuestionAnswerPairs", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("returns empty for non-string", () => {
        expect(store.parseQuestionAnswerPairs(null as unknown as string)).toEqual([])
        expect(store.parseQuestionAnswerPairs(123 as unknown as string)).toEqual([])
    })
    it("parses Question/Answer continuation lines", () => {
        let text = "Question: What is 2+2?\nMore detail\nAnswer: 4\nIndeed"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2? More detail")
        expect(pairs[0].answer).toBe("4 Indeed")
    })
    it("parses Q/A regex fallback", () => {
        let text = "Q: one\nA: two"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("one")
        expect(pairs[0].answer).toBe("two")
    })
    it("skips regex for very long text", () => {
        let text = "Q: one\nA: two" + "x".repeat(100000)
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(0)
    })
})
describe("OutputStore parseConversationTurns", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("returns empty for non-string", () => {
        expect(store.parseConversationTurns(undefined as unknown as string)).toEqual([])
    })
    it("parses User/Assistant continuation", () => {
        let text = "User: hello\nworld\nAssistant: hi\nthere"
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("hello world")
        expect(turns[0].assistant).toBe("hi there")
    })
    it("parses Human/AI regex fallback", () => {
        let text = "Human: q\nAI: a"
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
    })
    it("skips regex for very long text", () => {
        let text = "Human: q\nAI: a" + "x".repeat(100000)
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(0)
    })
})
describe("OutputStore createTrainingItem instruction", () => {
    it("creates jsonl instruction item", () => {
        let items = store.createTrainingItem("in", "out", "instruction", "jsonl")
        expect(items[0].format).toBe("instruction")
        expect(items[0].input).toBe("in")
        expect(items[0].output).toBe("out")
    })
    it("creates chatml from q/a pairs", () => {
        let output = "Question: q\nAnswer: a"
        let items = store.createTrainingItem("in", output, "instruction", "chatml")
        expect(items[0].format).toBe("chatml")
        expect(items[0].messages!.length).toBe(2)
    })
    it("creates csv from q/a pairs", () => {
        let output = "Question: q\nAnswer: a"
        let items = store.createTrainingItem("in", output, "instruction", "csv")
        expect(items[0].format).toBe("instruction")
        expect(items[0].input).toBe("q")
        expect(items[0].output).toBe("a")
    })
    it("creates text from q/a pairs", () => {
        let output = "Question: q\nAnswer: a"
        let items = store.createTrainingItem("in", output, "instruction", "text")
        expect(items[0].format).toBe("text")
        expect(items[0].text).toBe("a")
    })
})
describe("OutputStore createTrainingItem conversation", () => {
    it("creates jsonl conversation items", () => {
        let output = "User: hello\nAssistant: hi"
        let items = store.createTrainingItem("in", output, "conversation", "jsonl")
        expect(items[0].input).toBe("hello")
        expect(items[0].output).toBe("hi")
    })
    it("creates chatml conversation messages", () => {
        let output = "User: hello\nAssistant: hi"
        let items = store.createTrainingItem("in", output, "conversation", "chatml")
        expect(items[0].messages!.length).toBe(2)
    })
    it("creates text from conversation", () => {
        let output = "User: hello\nAssistant: hi"
        let items = store.createTrainingItem("in", output, "conversation", "text")
        expect(items[0].text).toBe("hi")
    })
    it("creates csv from conversation", () => {
        let output = "User: hello\nAssistant: hi"
        let items = store.createTrainingItem("in", output, "conversation", "csv")
        expect(items[0].input).toBe("hello")
        expect(items[0].output).toBe("hi")
    })
})
describe("OutputStore createTrainingItem fallback", () => {
    it("falls back for chunking type", () => {
        let items = store.createTrainingItem("in", "out", "chunking", "jsonl")
        expect(items[0].input).toBe("in")
        expect(items[0].output).toBe("out")
    })
    it("falls back for custom type to chatml", () => {
        let items = store.createTrainingItem("in", "out", "custom", "chatml")
        expect(items[0].format).toBe("chatml")
    })
    it("falls back for custom type to text", () => {
        let items = store.createTrainingItem("in", "out", "custom", "text")
        expect(items[0].format).toBe("text")
        expect(items[0].text).toBe("out")
    })
    it("falls back for custom type to csv", () => {
        let items = store.createTrainingItem("in", "out", "custom", "csv")
        expect(items[0].format).toBe("instruction")
    })
})
describe("OutputStore formatData", () => {
    it("formats jsonl", () => {
        store.appendOutput([item({ format: "instruction", input: "in", output: "out" })])
        expect(store.formatData(store.outputData, "jsonl")).toContain('"input":"in"')
    })
    it("formats json array", () => {
        store.appendOutput([item({ format: "instruction", input: "in", output: "out" })])
        expect(store.formatData(store.outputData, "json")).toContain("[")
    })
    it("formats csv", () => {
        store.appendOutput([item({ format: "instruction", input: "in", output: "out" })])
        expect(store.formatData(store.outputData, "csv")).toContain("instruction")
    })
    it("formats text", () => {
        store.appendOutput([item({ format: "text", text: "hello" })])
        expect(store.formatData(store.outputData, "text")).toContain("hello")
    })
    it("formats chatml filtered", () => {
        store.appendOutput([
            item({ format: "chatml", messages: [{ role: "user", content: "hi" }] }),
            item({ format: "instruction", input: "in", output: "out" })
        ])
        expect(store.formatData(store.outputData, "chatml")).toContain("messages")
    })
    it("defaults to jsonl for unknown format", () => {
        store.appendOutput([item({ format: "instruction", input: "in", output: "out" })])
        expect(store.formatData(store.outputData, "unknown")).toContain('"input":"in"')
    })
})
describe("OutputStore getItemText", () => {
    it("returns output", () => {
        expect(store.getItemText(item({ format: "instruction", output: "out" }))).toBe("out")
    })
    it("returns instruction", () => {
        expect(store.getItemText(item({ format: "instruction", instruction: "inst", input: "in" }))).toBe("inst")
    })
    it("returns input", () => {
        expect(store.getItemText(item({ format: "instruction", input: "in" }))).toBe("in")
    })
    it("returns messages joined", () => {
        expect(store.getItemText(item({ format: "chatml", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }))).toBe("a b")
    })
    it("returns text", () => {
        expect(store.getItemText(item({ format: "text", text: "txt" }))).toBe("txt")
    })
    it("returns empty for empty item", () => {
        expect(store.getItemText(item({ format: "instruction" }))).toBe("")
    })
})
describe("OutputStore exportOutput", () => {
    beforeEach(() => {
        vi.stubGlobal("window", {
            electronAPI: {
                saveFileDialog: vi.fn(async(name: string) => `/path/${name}`),
                saveFile: vi.fn(async() => ({ success: true }))
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("does nothing when no output", async() => {
        await store.exportOutput()
        expect(window.electronAPI!.saveFile).not.toHaveBeenCalled()
    })
    it("exports single file", async() => {
        store.appendOutput([item({ format: "text", text: "hello" })])
        await store.exportOutput("jsonl")
        expect(window.electronAPI!.saveFileDialog).toHaveBeenCalled()
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
    })
    it("splits large output", async() => {
        let items: TrainingItem[] = []
        for (let i = 0; i < 100001; i++) {
            items.push(item({ format: "text", text: String(i) }))
        }
        store.appendOutput(items)
        await store.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalledTimes(2)
    })
})
describe("OutputStore copyOutput", () => {
    beforeEach(() => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async() => {})
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("does nothing when no output", async() => {
        await store.copyOutput()
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })
    it("copies jsonl", async() => {
        store.setExportFormat("jsonl")
        store.appendOutput([item({ format: "text", text: "hello" })])
        await store.copyOutput()
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
    it("skips when clipboard too large", async() => {
        store.appendOutput([item({ format: "text", text: "x".repeat(6 * 1024 * 1024) })])
        await store.copyOutput()
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })
})
describe("OutputStore parseQuestionAnswerPairs filler stripping", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("does not append filler between pairs to the first answer", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nThe output does not explicitly describe a follow-up here.\n\nQuestion: What is 3+3?\nAnswer: 6"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].question).toBe("What is 2+2?")
        expect(pairs[0].answer).toBe("4")
        expect(pairs[0].answer).not.toContain("explicitly describe")
        expect(pairs[1].question).toBe("What is 3+3?")
        expect(pairs[1].answer).toBe("6")
    })
    it("ignores preamble before the first pair", () => {
        let text = "This is a preamble that should be ignored.\nLet's begin.\n\nQuestion: What is 2+2?\nAnswer: 4"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2?")
        expect(pairs[0].answer).toBe("4")
    })
    it("ignores postamble after the last pair", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nThis is a postamble that should be ignored."
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2?")
        expect(pairs[0].answer).toBe("4")
    })
    it("strips multi-line filler between pairs", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nFiller line one.\nFiller line two.\nFiller line three.\n\nQuestion: What is 3+3?\nAnswer: 6"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].answer).toBe("4")
        expect(pairs[0].answer).not.toContain("Filler")
        expect(pairs[1].answer).toBe("6")
    })
    it("strips prose-like filler that mimics meta-commentary", () => {
        let text = "Question: What is the capital of France?\nAnswer: Paris\n\nThe output does not explicitly describe the Eiffel Tower's height in this pair.\n\nQuestion: What is 2+2?\nAnswer: 4"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].answer).toBe("Paris")
        expect(pairs[0].answer).not.toContain("Eiffel Tower")
        expect(pairs[1].answer).toBe("4")
    })
})
describe("OutputStore parseConversationTurns filler stripping", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("does not append filler between turns to the first assistant reply", () => {
        let text = "User: Hello\nAssistant: Hi there!\n\nThis is filler between turns.\n\nUser: How are you?\nAssistant: I'm fine."
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(2)
        expect(turns[0].user).toBe("Hello")
        expect(turns[0].assistant).toBe("Hi there!")
        expect(turns[0].assistant).not.toContain("filler")
        expect(turns[1].user).toBe("How are you?")
        expect(turns[1].assistant).toBe("I'm fine.")
    })
    it("ignores preamble before the first turn", () => {
        let text = "This is a preamble.\nAnother preamble line.\n\nUser: Hello\nAssistant: Hi there!"
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("Hello")
        expect(turns[0].assistant).toBe("Hi there!")
    })
})
describe("Parser normalization and deduplication", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("splits same-line Question/Answer into two lines", () => {
        const text = "Question: What is X? Answer: X is a library.\n\nQuestion: What is Y? Answer: Y is a framework."
        const pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].question).toBe("What is X?")
        expect(pairs[0].answer).toBe("X is a library.")
        expect(pairs[1].question).toBe("What is Y?")
        expect(pairs[1].answer).toBe("Y is a framework.")
    })
    it("splits same-line User/Assistant into two lines for conversation", () => {
        const text = "User: Hello Assistant: Hi there"
        const turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("Hello")
        expect(turns[0].assistant).toBe("Hi there")
    })
    it("deduplicates consecutive duplicate Q&A pairs", () => {
        const text = "Question: What is X?\nAnswer: X is a library.\n\nQuestion: What is X?\nAnswer: X is a library."
        const pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is X?")
    })
    it("deduplicates non-consecutive duplicate Q&A pairs", () => {
        const text = "Question: What is X?\nAnswer: X is a library.\n\nQuestion: What is Y?\nAnswer: Y is a framework.\n\nQuestion: What is X?\nAnswer: X is a library."
        const pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].question).toBe("What is X?")
        expect(pairs[1].question).toBe("What is Y?")
    })
    it("deduplicates conversation turns with same user text", () => {
        const text = "User: Hello\nAssistant: Hi\n\nUser: Hello\nAssistant: Hey"
        const turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(1)
        expect(turns[0].user).toBe("Hello")
    })
})
