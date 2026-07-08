import { describe, it, expect } from "vitest"
import { validateItems } from "../src/renderer/qualityValidator.js"
import type { TrainingItem } from "../src/types/index.js"
function instructionItem(overrides: Partial<TrainingItem> = {}): TrainingItem {
    return {
        format: "instruction",
        instruction: "What is machine learning?",
        input: "",
        output: "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        ...overrides
    }
}
function chatItem(overrides: Partial<TrainingItem> = {}): TrainingItem {
    return {
        format: "chatml",
        messages: [
            { role: "user", content: "Explain neural networks." },
            { role: "assistant", content: "Neural networks are computational models inspired by biological neurons and are widely used in deep learning tasks." }
        ],
        ...overrides
    }
}
function textItem(overrides: Partial<TrainingItem> = {}): TrainingItem {
    return {
        format: "text",
        text: "This is a long enough text sample that meets the minimum length requirement for validation.",
        ...overrides
    }
}
describe("validateItems baseline", () => {
    it("returns 100% pass rate for empty items", () => {
        let report = validateItems([])
        expect(report.totalItems).toBe(0)
        expect(report.flaggedItems).toBe(0)
        expect(report.passRate).toBe(100)
    })
    it("passes valid instruction item", () => {
        let report = validateItems([instructionItem()])
        expect(report.flaggedItems).toBe(0)
        expect(report.passRate).toBe(100)
    })
    it("passes valid chat item", () => {
        let report = validateItems([chatItem()])
        expect(report.flaggedItems).toBe(0)
        expect(report.passRate).toBe(100)
    })
    it("passes valid text item", () => {
        let report = validateItems([textItem()])
        expect(report.flaggedItems).toBe(0)
        expect(report.passRate).toBe(100)
    })
    it("counts total items correctly", () => {
        let report = validateItems([instructionItem(), chatItem(), textItem()])
        expect(report.totalItems).toBe(3)
    })
})
describe("validateItems instruction format", () => {
    it("flags missing answer", () => {
        let report = validateItems([instructionItem({ output: "" })])
        expect(report.flags[0].reasons).toContain("missing_answer")
    })
    it("flags missing question", () => {
        let report = validateItems([instructionItem({ instruction: "", input: "", output: "An answer." })])
        expect(report.flags[0].reasons).toContain("missing_question")
    })
    it("flags answer too short", () => {
        let report = validateItems([instructionItem({ output: "short" })])
        expect(report.flags[0].reasons).toContain("answer_too_short")
    })
    it("flags language mismatch between instruction and output", () => {
        let report = validateItems([instructionItem({ instruction: "什么是机器学习？", output: "Machine learning is a subset of AI." })])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
    it("does not flag same-language CJK pairs", () => {
        let report = validateItems([instructionItem({ instruction: "什么是机器学习？", output: "机器学习是人工智能的一个子集，它使系统能够从数据中学习。" })])
        expect(report.flaggedItems).toBe(0)
    })
    it("uses input as question fallback", () => {
        let report = validateItems([instructionItem({ instruction: "", input: "Context here", output: "Answer that is long enough to pass the minimum length rule." })])
        expect(report.flaggedItems).toBe(0)
    })
    it("flags mismatch using input fallback", () => {
        let report = validateItems([instructionItem({ instruction: "", input: "什么是机器学习？", output: "Machine learning is a subset of AI." })])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
})
describe("validateItems chat format", () => {
    it("flags empty messages array", () => {
        let report = validateItems([chatItem({ messages: [] })])
        expect(report.flags[0].reasons).toContain("missing_answer")
    })
    it("flags missing role or content", () => {
        let report = validateItems([chatItem({ messages: [{ role: "user" as const, content: "Hi" }, { role: "assistant" as const, content: "" }] })])
        expect(report.flags[0].reasons).toContain("missing_answer")
    })
    it("flags assistant answer too short", () => {
        let report = validateItems([chatItem({ messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hi." }] })])
        expect(report.flags[0].reasons).toContain("answer_too_short")
    })
    it("flags language mismatch between user and assistant", () => {
        let report = validateItems([chatItem({ messages: [{ role: "user", content: "解释神经网络。" }, { role: "assistant", content: "Neural networks are computational models inspired by biological neurons." }] })])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
    it("passes multi-turn conversation", () => {
        let report = validateItems([chatItem({ messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hello! How can I help you today with machine learning questions?" },
            { role: "user", content: "Explain neural networks." },
            { role: "assistant", content: "Neural networks are computational models inspired by biological neurons and are widely used in deep learning tasks." }
        ] })])
        expect(report.flaggedItems).toBe(0)
    })
    it("concatenates assistant answers for length check", () => {
        let report = validateItems([chatItem({ messages: [
            { role: "user", content: "Hi" },
            { role: "assistant", content: "First part. " },
            { role: "assistant", content: "Second part that makes the total assistant response long enough to pass validation." }
        ] })])
        expect(report.flaggedItems).toBe(0)
    })
})
describe("validateItems text format", () => {
    it("flags text too short", () => {
        let report = validateItems([textItem({ text: "short" })])
        expect(report.flags[0].reasons).toContain("answer_too_short")
    })
    it("flags language mismatch with paired instruction", () => {
        let report = validateItems([{ format: "text", text: "Machine learning is AI.", instruction: "什么是机器学习？" }])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
    it("passes long text without paired content", () => {
        let report = validateItems([textItem({ instruction: undefined, input: undefined })])
        expect(report.flaggedItems).toBe(0)
    })
    it("uses input as paired text fallback", () => {
        let report = validateItems([{ format: "text", text: "English summary text that is long enough.", input: "中文输入" }])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
})
describe("validateItems report breakdown", () => {
    it("reports multiple reasons per item", () => {
        let report = validateItems([instructionItem({ instruction: "什么是机器学习？", output: "short" })])
        expect(report.flags[0].reasons.length).toBeGreaterThan(1)
    })
    it("aggregates breakdown counts", () => {
        let items = [
            instructionItem({ output: "" }),
            instructionItem({ output: "short" }),
            instructionItem({ instruction: "什么是机器学习？", output: "Machine learning is AI." })
        ]
        let report = validateItems(items)
        expect(report.breakdown["missing_answer"]).toBe(1)
        expect(report.breakdown["answer_too_short"]).toBe(1)
        expect(report.breakdown["language_mismatch"]).toBe(1)
    })
    it("calculates pass rate correctly", () => {
        let report = validateItems([instructionItem(), instructionItem({ output: "" })])
        expect(report.passRate).toBe(50)
    })
    it("includes item index in flags", () => {
        let report = validateItems([instructionItem(), instructionItem({ output: "" })])
        expect(report.flags[0].itemIndex).toBe(1)
    })
    it("includes item data in flags", () => {
        let report = validateItems([instructionItem({ output: "" })])
        expect(report.flags[0].item.output).toBe("")
    })
    it("rounds pass rate to integer", () => {
        let report = validateItems([instructionItem(), instructionItem(), instructionItem({ output: "" })])
        expect(report.passRate).toBe(67)
    })
})
describe("validateItems edge cases", () => {
    it("handles unknown format without messages or text", () => {
        let item: TrainingItem = { format: "unknown" as any, instruction: "Q", input: "", output: "A".repeat(30) }
        let report = validateItems([item])
        expect(report.flaggedItems).toBe(0)
    })
    it("flags unknown format with short output", () => {
        let item: TrainingItem = { format: "unknown" as any, instruction: "Q", input: "", output: "short" }
        let report = validateItems([item])
        expect(report.flags[0].reasons).toContain("answer_too_short")
    })
    it("flags answer too short when both question and answer are empty", () => {
        let report = validateItems([instructionItem({ instruction: "", input: "", output: "" })])
        expect(report.flags[0].reasons).toContain("answer_too_short")
    })
    it("detects CJK in output", () => {
        let report = validateItems([instructionItem({ instruction: "What is AI?", output: "人工智能是计算机科学的一个分支。" })])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
    it("detects CJK in question", () => {
        let report = validateItems([instructionItem({ instruction: "什么是人工智能？", output: "AI is a branch of computer science." })])
        expect(report.flags[0].reasons).toContain("language_mismatch")
    })
    it("handles items with undefined paired text", () => {
        let report = validateItems([textItem({ text: "A".repeat(25) })])
        expect(report.flaggedItems).toBe(0)
    })
})
