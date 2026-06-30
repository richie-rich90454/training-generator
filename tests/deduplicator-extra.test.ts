// @vitest-environment node
import { describe, it, expect } from "vitest"
import { deduplicate } from "../src/renderer/deduplicator.js"
import type { TrainingItem } from "../src/types/index.js"
function makeItem(output: string): TrainingItem {
    return { instruction: "test", input: "", output }
}
describe("deduplicate exact duplicates", () => {
    let formats: [string, TrainingItem, TrainingItem][]=[
        ["instruction", makeItem("same"), makeItem("same")],
        ["messages", { messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }, { messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }],
        ["text", { text: "same text" }, { text: "same text" }],
        ["output only", { output: "same output" } as TrainingItem, { output: "same output" } as TrainingItem],
    ]
    formats.forEach(([label, a, b])=>{
        it(`removes exact ${label} duplicates`, () => {
            let result=deduplicate([a, b])
            expect(result.removed).toBe(1)
            expect(result.items.length).toBe(1)
        })
    })
    it("removes multiple identical items", () => {
        let items=[makeItem("dup"), makeItem("dup"), makeItem("dup"), makeItem("dup")]
        let result=deduplicate(items)
        expect(result.items.length).toBe(1)
        expect(result.removed).toBe(3)
    })
    it("keeps first occurrence", () => {
        let items=[makeItem("dup"), makeItem("dup")]
        let result=deduplicate(items)
        expect(result.items[0].output).toBe("dup")
    })
})
describe("deduplicate near duplicates", () => {
    it("removes near-duplicates at high threshold", () => {
        let items=[
            makeItem("The quick brown fox jumps over the lazy dog"),
            makeItem("The quick brown fox jumps over the lazy dog"),
            makeItem("Totally different content here"),
        ]
        let result=deduplicate(items, 0.99)
        expect(result.removed).toBeGreaterThanOrEqual(1)
    })
    it("keeps distinct items at default threshold", () => {
        let items=[
            makeItem("The quick brown fox jumps over the lazy dog"),
            makeItem("A quick brown fox jumps over a lazy dog"),
            makeItem("Completely unrelated sentence here"),
        ]
        let result=deduplicate(items, 0.9)
        expect(result.items.length).toBeGreaterThanOrEqual(2)
    })
    it("keeps items below threshold", () => {
        let items=[
            makeItem("aaaaaaa"),
            makeItem("bbbbbbb"),
        ]
        let result=deduplicate(items, 0.5)
        expect(result.removed).toBe(0)
    })
    it("handles threshold 1.0 as exact", () => {
        let items=[makeItem("same"), makeItem("same")]
        let result=deduplicate(items, 1.0)
        expect(result.removed).toBe(1)
    })
    it("handles threshold 0.0 as remove all", () => {
        let items=[makeItem("a"), makeItem("b"), makeItem("c")]
        let result=deduplicate(items, 0.0)
        expect(result.items.length).toBe(1)
    })
})
describe("deduplicate edge cases", () => {
    it("returns same array for empty input", () => {
        let result=deduplicate([])
        expect(result.items).toEqual([])
        expect(result.removed).toBe(0)
    })
    it("returns same array for single item", () => {
        let item=makeItem("only")
        let result=deduplicate([item])
        expect(result.items).toEqual([item])
        expect(result.removed).toBe(0)
    })
    it("handles all unique items", () => {
        let items: TrainingItem[]=[]
        for(let i=0;i<10;i++){
            items.push(makeItem(`unique item ${i} with enough length to avoid collisions`))
        }
        let result=deduplicate(items)
        expect(result.removed).toBe(0)
        expect(result.items.length).toBe(10)
    })
    it("handles items with empty text", () => {
        let items=[{ text: "" } as TrainingItem, { text: "" } as TrainingItem]
        let result=deduplicate(items)
        expect(result.removed).toBe(1)
    })
    it("handles mixed format items", () => {
        let items: TrainingItem[]=[
            { text: "hello" },
            { messages: [{ role: "user", content: "hello" }] },
            { output: "hello" } as TrainingItem,
        ]
        let result=deduplicate(items)
        expect(result.items.length).toBeGreaterThan(0)
    })
    it("merges provenance on duplicates", () => {
        let a={ ...makeItem("same"), _provenance: { sourceFile: "a.txt", chunkIndex: 0, model: "m", promptType: "p", timestamp: "t" } }
        let b={ ...makeItem("same"), _provenance: { sourceFile: "b.txt", chunkIndex: 1, model: "m", promptType: "p", timestamp: "t" } }
        let result=deduplicate([a, b])
        expect(result.removed).toBe(1)
        let merged=result.items[0]._provenance as any
        expect(merged._mergedFrom).toContain("b.txt")
    })
})
describe("deduplicate script and length prefilter", () => {
    it("does not deduplicate cjk vs latin by default prefilter", () => {
        let items=[{ text: "你好世界" } as TrainingItem, { text: "hello world" } as TrainingItem]
        let result=deduplicate(items, 0.9)
        expect(result.removed).toBe(0)
        expect(result.items.length).toBe(2)
    })
    it("does not deduplicate very different lengths", () => {
        let items=[makeItem("short"), makeItem("this is a much longer piece of text content")]
        let result=deduplicate(items, 0.9)
        expect(result.removed).toBe(0)
    })
    it("handles arabic script", () => {
        let items=[{ text: "مرحبا" } as TrainingItem, { text: "مرحبا" } as TrainingItem]
        let result=deduplicate(items, 0.9)
        expect(result.removed).toBe(1)
    })
    it("handles mixed script", () => {
        let items=[{ text: "hello 你好" } as TrainingItem, { text: "hello 你好" } as TrainingItem]
        let result=deduplicate(items, 0.9)
        expect(result.removed).toBe(1)
    })
})
describe("deduplicate threshold sweep", () => {
    let thresholds=[0.0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0]
    thresholds.forEach(threshold=>{
        it(`runs without error at threshold ${threshold}`, () => {
            let items=[
                makeItem("identical content here"),
                makeItem("identical content here"),
                makeItem("different content entirely"),
            ]
            let result=deduplicate(items, threshold)
            expect(result.items.length).toBeGreaterThanOrEqual(1)
            expect(result.items.length).toBeLessThanOrEqual(3)
        })
    })
})
