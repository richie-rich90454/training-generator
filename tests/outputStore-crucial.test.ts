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
        // Continuation lines after Answer: are preserved with their original
        // line breaks (joined with \n, not space) to support multi-line answers.
        expect(pairs[0].answer).toBe("4\nIndeed")
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
        // Continuation lines after Assistant: are preserved with their original
        // line breaks (joined with \n, not space) to support multi-line replies.
        expect(turns[0].assistant).toBe("hi\nthere")
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
    it("creates jsonl instruction item from Q&A pairs", () => {
        let output = "Question: q\nAnswer: a"
        let items = store.createTrainingItem("in", output, "instruction", "jsonl")
        expect(items[0].format).toBe("instruction")
        expect(items[0].input).toBe("q")
        expect(items[0].output).toBe("a")
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
    it("returns empty array for instruction when output has no Q&A pairs", () => {
        // When the model outputs trash (meta-commentary, preamble) instead of
        // Q&A pairs, createTrainingItem should return an empty array — not a
        // fallback item with raw garbage stuffed into the input field.
        let trashOutput = "I cannot generate Q&A from this text because it contains no questions or answers."
        let items = store.createTrainingItem("input text", trashOutput, "instruction", "jsonl")
        expect(items.length).toBe(0)
    })
    it("returns empty array for conversation when output has no turns", () => {
        let trashOutput = "This text does not contain a conversation. Please provide a different input."
        let items = store.createTrainingItem("input text", trashOutput, "conversation", "jsonl")
        expect(items.length).toBe(0)
    })
    it("returns empty array for instruction when output is preamble only", () => {
        let preambleOnly = "Based on my analysis of the provided text, I will now generate questions. However, the text does not contain enough information."
        let items = store.createTrainingItem("input text", preambleOnly, "instruction", "jsonl")
        expect(items.length).toBe(0)
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
describe("OutputStore parseQuestionAnswerPairs multi-line preservation", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("preserves multi-line answer content after Answer: label", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nThe output does not explicitly describe a follow-up here.\n\nQuestion: What is 3+3?\nAnswer: 6"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].question).toBe("What is 2+2?")
        // After the parser fix, all content between Answer: and the next Question:
        // is preserved as part of the answer (multi-line answers are no longer
        // truncated at the first blank line). Prompt-side ANSWER CONTENT RULES
        // are the primary defense against unwanted filler content.
        expect(pairs[0].answer).toContain("4")
        expect(pairs[0].answer).toContain("explicitly describe")
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
    it("preserves postamble content after last Answer: label", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nThis is a postamble that should be ignored."
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(1)
        expect(pairs[0].question).toBe("What is 2+2?")
        // After the parser fix, content after the last Answer: is preserved as
        // part of the answer. Prompt rules forbid postamble.
        expect(pairs[0].answer).toContain("4")
        expect(pairs[0].answer).toContain("postamble")
    })
    it("preserves multi-line content between Answer: and next Question:", () => {
        let text = "Question: What is 2+2?\nAnswer: 4\n\nFiller line one.\nFiller line two.\nFiller line three.\n\nQuestion: What is 3+3?\nAnswer: 6"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].answer).toContain("4")
        expect(pairs[0].answer).toContain("Filler line one")
        expect(pairs[0].answer).toContain("Filler line three")
        expect(pairs[1].answer).toBe("6")
    })
    it("preserves prose-like content after Answer: label", () => {
        let text = "Question: What is the capital of France?\nAnswer: Paris\n\nThe output does not explicitly describe the Eiffel Tower's height in this pair.\n\nQuestion: What is 2+2?\nAnswer: 4"
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].answer).toContain("Paris")
        expect(pairs[0].answer).toContain("Eiffel Tower")
        expect(pairs[1].answer).toBe("4")
    })
    it("preserves multi-line answer with blank lines (e.g., multi-paragraph answer)", () => {
        let text = "Question: Explain photosynthesis.\nAnswer: Photosynthesis is the process by which plants convert light energy into chemical energy.\n\nIt occurs in two stages: light-dependent reactions and the Calvin cycle.\n\nThe overall equation is: 6CO2 + 6H2O -> C6H12O6 + 6O2.\n\nQuestion: What is respiration?\nAnswer: The process of breaking down glucose to release energy."
        let pairs = store.parseQuestionAnswerPairs(text)
        expect(pairs.length).toBe(2)
        expect(pairs[0].question).toBe("Explain photosynthesis.")
        // Multi-paragraph answer with blank lines should be preserved
        expect(pairs[0].answer).toContain("Photosynthesis is the process")
        expect(pairs[0].answer).toContain("light-dependent reactions")
        expect(pairs[0].answer).toContain("overall equation")
        expect(pairs[1].question).toBe("What is respiration?")
        expect(pairs[1].answer).toBe("The process of breaking down glucose to release energy.")
    })
})
describe("OutputStore parseConversationTurns multi-line preservation", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })
    it("preserves multi-line assistant content after Assistant: label", () => {
        let text = "User: Hello\nAssistant: Hi there!\n\nThis is filler between turns.\n\nUser: How are you?\nAssistant: I'm fine."
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(2)
        expect(turns[0].user).toBe("Hello")
        // After the parser fix, all content between Assistant: and the next User:
        // is preserved as part of the assistant turn.
        expect(turns[0].assistant).toContain("Hi there!")
        expect(turns[0].assistant).toContain("filler")
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
    it("preserves multi-line assistant turn with blank lines (e.g., multi-paragraph reply)", () => {
        let text = "User: Explain recursion.\nAssistant: Recursion is when a function calls itself.\n\nIt needs a base case to stop.\n\nEach recursive call should move closer to the base case.\n\nUser: Give an example.\nAssistant: factorial(n) = n * factorial(n-1), factorial(0) = 1."
        let turns = store.parseConversationTurns(text)
        expect(turns.length).toBe(2)
        expect(turns[0].user).toBe("Explain recursion.")
        expect(turns[0].assistant).toContain("Recursion is when")
        expect(turns[0].assistant).toContain("base case")
        expect(turns[0].assistant).toContain("recursive call")
        expect(turns[1].user).toBe("Give an example.")
        expect(turns[1].assistant).toContain("factorial")
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
describe("OutputStore appendOutput clears staging", () => {
    it("clears staging data after appending items", () => {
        store.stageItems([item({ format: "text", text: "staged" })])
        expect(store.stagingData.length).toBe(1)
        store.appendOutput([item({ format: "text", text: "appended" })])
        expect(store.stagingData).toEqual([])
        expect(store.outputData.length).toBe(1)
        expect(store.outputData[0].text).toBe("appended")
    })
    it("clears staging even with multiple staged items", () => {
        store.stageItems([
            item({ format: "text", text: "staged1" }),
            item({ format: "text", text: "staged2" })
        ])
        expect(store.stagingData.length).toBe(2)
        store.appendOutput([item({ format: "text", text: "appended" })])
        expect(store.stagingData).toEqual([])
        expect(store.outputData.length).toBe(1)
    })
    it("does not clear staging when appending empty items array (early return)", () => {
        store.stageItems([item({ format: "text", text: "staged" })])
        store.appendOutput([])
        // Early-return branch: empty items does not clear staging
        expect(store.stagingData.length).toBe(1)
        expect(store.outputData).toEqual([])
    })
})
// NOTE: "stageItems dedup" branch does NOT exist in the source. stageItems()
// (outputStore.ts lines 394-397) simply appends items to staging without any
// deduplication logic. Deduplication only happens inside the parsers
// (parseQuestionAnswerPairs / parseConversationTurns), not in stageItems.
// Skipped per task instructions ("If a branch doesn't exist, skip and note it").
describe("OutputStore stageItems accumulates without dedup", () => {
    it("appends duplicate items without deduplicating (documents actual behavior)", () => {
        const dup = item({ format: "text", text: "same" })
        store.stageItems([dup, dup])
        // stageItems does not dedup — both duplicates are kept
        expect(store.stagingData.length).toBe(2)
    })
    it("does nothing for empty items array (early return)", () => {
        store.stageItems([])
        expect(store.stagingData).toEqual([])
    })
})
describe("OutputStore exportOutput format dispatch", () => {
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
    it("dispatches to jsonl exporter", async() => {
        store.appendOutput([item({ format: "instruction", input: "q", output: "a" })])
        await store.exportOutput("jsonl")
        const content = (window.electronAPI!.saveFile as unknown as { mock: { calls: string[][] } }).mock.calls[0][1]
        // jsonl: each line is a compact JSON object, no leading '[', trailing newline
        expect(content).toContain('"input":"q"')
        expect(content.startsWith("[")).toBe(false)
        expect(content.endsWith("\n")).toBe(true)
    })
    it("dispatches to json array exporter", async() => {
        store.appendOutput([item({ format: "instruction", input: "q", output: "a" })])
        await store.exportOutput("json")
        const content = (window.electronAPI!.saveFile as unknown as { mock: { calls: string[][] } }).mock.calls[0][1]
        // json: pretty-printed JSON array starting with '['
        expect(content.startsWith("[")).toBe(true)
        expect(content).toContain('"input": "q"')
    })
    it("dispatches to csv exporter", async() => {
        store.appendOutput([item({ format: "instruction", instruction: "inst", input: "q", output: "a" })])
        await store.exportOutput("csv")
        const content = (window.electronAPI!.saveFile as unknown as { mock: { calls: string[][] } }).mock.calls[0][1]
        // csv: BOM prefix + instruction,input,output header
        expect(content.startsWith("\uFEFF")).toBe(true)
        expect(content).toContain("instruction,input,output")
    })
    it("dispatches to chatml exporter and filters to chatml items", async() => {
        store.appendOutput([
            item({ format: "chatml", messages: [{ role: "user", content: "hi" }] }),
            item({ format: "instruction", input: "in", output: "out" })
        ])
        await store.exportOutput("chatml")
        const content = (window.electronAPI!.saveFile as unknown as { mock: { calls: string[][] } }).mock.calls[0][1]
        // chatml: JSON array filtered to chatml-format items only
        expect(content.startsWith("[")).toBe(true)
        expect(content).toContain('"messages"')
        expect(content).not.toContain('"input"')
    })
    it("dispatches to text exporter", async() => {
        store.appendOutput([item({ format: "text", text: "hello world" })])
        await store.exportOutput("text")
        const content = (window.electronAPI!.saveFile as unknown as { mock: { calls: string[][] } }).mock.calls[0][1]
        // text: raw item text joined by '\n\n'
        expect(content).toBe("hello world")
    })
})
// NOTE: copyOutput() does NOT handle clipboard failures gracefully — there is
// no try/catch around navigator.clipboard.writeText. When the clipboard API
// rejects, the error propagates to the caller. The test below documents this
// actual behavior (error propagates) since the "graceful handling" branch
// does not exist in the source.
describe("OutputStore copyOutput clipboard failure", () => {
    beforeEach(() => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async() => { throw new Error("clipboard denied") })
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("propagates clipboard error (no graceful handling in source)", async() => {
        store.appendOutput([item({ format: "text", text: "hello" })])
        await expect(store.copyOutput()).rejects.toThrow("clipboard denied")
        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    })
})
