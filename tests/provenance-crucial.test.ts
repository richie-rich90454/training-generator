import { describe, it, expect } from "vitest"
import { tagItem, mergeProvenance, ProvenanceData } from "../src/renderer/provenance.js"
import type { TrainingItem } from "../src/types/index.js"
function baseProv(overrides: Partial<ProvenanceData> = {}): ProvenanceData {
    return {
        sourceFile: "doc.txt",
        chunkIndex: 0,
        model: "llama2",
        promptType: "instruction",
        timestamp: "2024-01-01T00:00:00Z",
        ...overrides
    }
}
function baseItem(overrides: Partial<TrainingItem> = {}): TrainingItem {
    return {
        format: "instruction",
        instruction: "What is AI?",
        input: "",
        output: "AI is artificial intelligence.",
        ...overrides
    }
}
function prov(item: TrainingItem): ProvenanceData {
    return item._provenance as ProvenanceData
}
describe("tagItem", () => {
    it("adds provenance to an item", () => {
        let item = baseItem()
        let p = baseProv()
        let tagged = tagItem(item, p)
        expect(prov(tagged)).toEqual(p)
    })
    it("preserves original item fields", () => {
        let item = baseItem()
        let tagged = tagItem(item, baseProv())
        expect(tagged.instruction).toBe("What is AI?")
        expect(tagged.output).toBe("AI is artificial intelligence.")
    })
    it("returns same item when provenance already exists", () => {
        let item = baseItem({ _provenance: baseProv() })
        let tagged = tagItem(item, baseProv({ sourceFile: "other.txt" }))
        expect(prov(tagged).sourceFile).toBe("doc.txt")
    })
    it("does not mutate the input item", () => {
        let item = baseItem()
        tagItem(item, baseProv())
        expect(item._provenance).toBeUndefined()
    })
    it("adds provenance to text format items", () => {
        let item: TrainingItem = { format: "text", text: "Hello world" }
        let tagged = tagItem(item, baseProv())
        expect(prov(tagged)).toBeDefined()
    })
    it("adds provenance to message format items", () => {
        let item: TrainingItem = { format: "chatml", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] }
        let tagged = tagItem(item, baseProv())
        expect(prov(tagged)).toBeDefined()
    })
    it("stores chunk index in provenance", () => {
        let tagged = tagItem(baseItem(), baseProv({ chunkIndex: 5 }))
        expect(prov(tagged).chunkIndex).toBe(5)
    })
    it("stores model name in provenance", () => {
        let tagged = tagItem(baseItem(), baseProv({ model: "mistral" }))
        expect(prov(tagged).model).toBe("mistral")
    })
    it("stores prompt type in provenance", () => {
        let tagged = tagItem(baseItem(), baseProv({ promptType: "conversation" }))
        expect(prov(tagged).promptType).toBe("conversation")
    })
})
describe("mergeProvenance", () => {
    it("returns clone of surviving when removed has no provenance", () => {
        let surviving = baseItem({ _provenance: baseProv() })
        let removed = baseItem()
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)).toEqual(prov(surviving))
        expect(merged).not.toBe(surviving)
    })
    it("copies removed provenance when surviving has none", () => {
        let surviving = baseItem()
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "removed.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged).sourceFile).toBe("removed.txt")
    })
    it("uses survivingSource when provided", () => {
        let surviving = baseItem()
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "removed.txt" }) })
        let merged = mergeProvenance(surviving, removed, "surviving.txt")
        expect(prov(merged).sourceFile).toBe("surviving.txt")
    })
    it("appends removed source to mergedFrom list", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "keep.txt" }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "gone.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)._mergedFrom).toContain("gone.txt")
    })
    it("preserves existing mergedFrom entries", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "keep.txt", _mergedFrom: ["old.txt"] }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "gone.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)._mergedFrom).toContain("old.txt")
        expect(prov(merged)._mergedFrom).toContain("gone.txt")
    })
    it("deduplicates mergedFrom entries", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "keep.txt", _mergedFrom: ["dup.txt"] }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "dup.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        let count = prov(merged)._mergedFrom!.filter((f: string) => f === "dup.txt").length
        expect(count).toBe(1)
    })
    it("keeps surviving provenance timestamp", () => {
        let surviving = baseItem({ _provenance: baseProv({ timestamp: "2024-01-02T00:00:00Z" }) })
        let removed = baseItem({ _provenance: baseProv({ timestamp: "2024-01-03T00:00:00Z" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged).timestamp).toBe("2024-01-02T00:00:00Z")
    })
    it("keeps surviving model and promptType", () => {
        let surviving = baseItem({ _provenance: baseProv({ model: "keep-model", promptType: "custom" }) })
        let removed = baseItem({ _provenance: baseProv({ model: "removed-model", promptType: "instruction" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged).model).toBe("keep-model")
        expect(prov(merged).promptType).toBe("custom")
    })
    it("does not mutate surviving item", () => {
        let surviving = baseItem({ _provenance: baseProv() })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "other.txt" }) })
        mergeProvenance(surviving, removed)
        expect(prov(surviving)._mergedFrom).toBeUndefined()
    })
    it("does not mutate removed item", () => {
        let surviving = baseItem({ _provenance: baseProv() })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "other.txt" }) })
        mergeProvenance(surviving, removed)
        expect(prov(removed)._mergedFrom).toBeUndefined()
    })
    it("handles multiple merges sequentially", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "a.txt" }) })
        let removed1 = baseItem({ _provenance: baseProv({ sourceFile: "b.txt" }) })
        let removed2 = baseItem({ _provenance: baseProv({ sourceFile: "c.txt" }) })
        let first = mergeProvenance(surviving, removed1)
        let second = mergeProvenance(first, removed2)
        expect(prov(second)._mergedFrom).toContain("b.txt")
        expect(prov(second)._mergedFrom).toContain("c.txt")
    })
    it("sets mergedFrom when both have provenance", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "s.txt" }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "r.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)._mergedFrom).toEqual(["r.txt"])
    })
    it("preserves other training item fields during merge", () => {
        let surviving: TrainingItem = { format: "text", text: "keep this" }
        let removed = baseItem({ _provenance: baseProv() })
        let merged = mergeProvenance(surviving, removed)
        expect(merged.format).toBe("text")
        expect(merged.text).toBe("keep this")
    })
    it("uses removed sourceFile when no survivingSource provided", () => {
        let surviving = baseItem()
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "removed.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged).sourceFile).toBe("removed.txt")
    })
    it("keeps surviving chunkIndex", () => {
        let surviving = baseItem({ _provenance: baseProv({ chunkIndex: 7 }) })
        let removed = baseItem({ _provenance: baseProv({ chunkIndex: 3 }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged).chunkIndex).toBe(7)
    })
    it("creates new object for merged result", () => {
        let surviving = baseItem({ _provenance: baseProv() })
        let removed = baseItem({ _provenance: baseProv() })
        let merged = mergeProvenance(surviving, removed)
        expect(merged).not.toBe(surviving)
        expect(merged).not.toBe(removed)
    })
    it("handles empty mergedFrom array", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "s.txt", _mergedFrom: [] }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "r.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)._mergedFrom).toContain("r.txt")
    })
    it("does not add undefined to mergedFrom", () => {
        let surviving = baseItem({ _provenance: baseProv({ sourceFile: "s.txt" }) })
        let removed = baseItem({ _provenance: baseProv({ sourceFile: "r.txt" }) })
        let merged = mergeProvenance(surviving, removed)
        expect(prov(merged)._mergedFrom!.every((f: string) => typeof f === "string")).toBe(true)
    })
})
describe("provenance integration", () => {
    it("tags output then merges duplicates correctly", () => {
        let item1 = tagItem(baseItem(), baseProv({ sourceFile: "a.txt", chunkIndex: 0 }))
        let item2 = tagItem(baseItem(), baseProv({ sourceFile: "b.txt", chunkIndex: 1 }))
        let merged = mergeProvenance(item1, item2)
        expect(prov(merged).sourceFile).toBe("a.txt")
        expect(prov(merged)._mergedFrom).toContain("b.txt")
    })
    it("does not retag already tagged items", () => {
        let item = tagItem(baseItem(), baseProv({ sourceFile: "first.txt" }))
        let retagged = tagItem(item, baseProv({ sourceFile: "second.txt" }))
        expect(prov(retagged).sourceFile).toBe("first.txt")
    })
    it("maintains provenance through merge chain", () => {
        let a = tagItem(baseItem(), baseProv({ sourceFile: "a.txt" }))
        let b = tagItem(baseItem(), baseProv({ sourceFile: "b.txt" }))
        let c = tagItem(baseItem(), baseProv({ sourceFile: "c.txt" }))
        let ab = mergeProvenance(a, b)
        let abc = mergeProvenance(ab, c)
        expect(prov(abc)._mergedFrom).toContain("b.txt")
        expect(prov(abc)._mergedFrom).toContain("c.txt")
    })
})
