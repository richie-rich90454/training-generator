// @vitest-environment node
import{describe,it,expect,vi,beforeEach,afterEach}from "vitest"
import type{TrainingItem}from "../src/types/index.ts"

// Mock the deduplicator dependency so we can verify the worker invokes it
// correctly without running the real deduplicator logic.
vi.mock("../src/renderer/deduplicator.ts",()=>({
    deduplicate: vi.fn((items: TrainingItem[], threshold?: number) => {
        // Simple stub: filter out duplicate outputs above threshold
        let seen = new Set<string>()
        let unique: TrainingItem[] = []
        let removed = 0
        for (let item of items) {
            let key = `${item.instruction || ""}|${item.input || ""}|${item.output || ""}`.toLowerCase()
            if (seen.has(key)) {
                removed++
                continue
            }
            seen.add(key)
            unique.push(item)
        }
        return { items: unique, removed }
    })
}))

let postedMessages: any[] = []
let globalSelf: any
let originalSelf: any

beforeEach(() => {
    postedMessages = []
    globalSelf = {
        postMessage: vi.fn((msg: any) => { postedMessages.push(msg) }),
        onmessage: null as any
    }
    originalSelf = (globalThis as any).self
    ;(globalThis as any).self = globalSelf
})

afterEach(() => {
    if (originalSelf === undefined) delete (globalThis as any).self
    else (globalThis as any).self = originalSelf
    vi.restoreAllMocks()
})

async function loadWorker() {
    vi.resetModules()
    return await import("../src/renderer/workers/dedup.worker.ts")
}

function makeItem(output: string, instruction = "Q?", input = ""): TrainingItem {
    return { format: "instruction", instruction, input, output }
}

describe("dedup.worker", () => {
    it("posts deduplication result back on valid message", async () => {
        await loadWorker()
        let items = [makeItem("a"), makeItem("b"), makeItem("a")]
        globalSelf.onmessage({ data: { id: 5, items, threshold: 0.85 } })

        expect(postedMessages).toHaveLength(1)
        expect(postedMessages[0].id).toBe(5)
        expect(Array.isArray(postedMessages[0].items)).toBe(true)
        expect(postedMessages[0].items.length).toBe(2)
        expect(postedMessages[0].removed).toBe(1)
    })

    it("posts error for missing data payload", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: null })
        expect(postedMessages).toHaveLength(1)
        expect(postedMessages[0].id).toBe(-1)
        expect(postedMessages[0].items).toEqual([])
        expect(postedMessages[0].removed).toBe(0)
        expect(postedMessages[0].error).toContain("missing data payload")
    })

    it("posts error for non-object data", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: 42 })
        expect(postedMessages[0].id).toBe(-1)
        expect(postedMessages[0].error).toContain("missing data payload")
    })

    it("uses sentinel id -1 when data.id is not a number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: "str", items: [], threshold: 0.5 } })
        expect(postedMessages[0].id).toBe(-1)
    })

    it("posts error when items is not an array", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: "not-array", threshold: 0.5 } })
        expect(postedMessages[0].error).toContain("'items' must be an array")
        expect(postedMessages[0].items).toEqual([])
        expect(postedMessages[0].removed).toBe(0)
    })

    it("posts error when items is null", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: null, threshold: 0.5 } })
        expect(postedMessages[0].error).toContain("'items' must be an array")
    })

    it("posts error when threshold is not a number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [], threshold: "high" } })
        expect(postedMessages[0].error).toContain("'threshold' must be a finite number")
    })

    it("posts error when threshold is NaN", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [], threshold: NaN } })
        expect(postedMessages[0].error).toContain("'threshold' must be a finite number")
    })

    it("posts error when threshold is Infinity", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [], threshold: Infinity } })
        expect(postedMessages[0].error).toContain("'threshold' must be a finite number")
    })

    it("allows threshold of zero", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [makeItem("a")], threshold: 0 } })
        expect(postedMessages[0].error).toBeUndefined()
        expect(postedMessages[0].items.length).toBe(1)
    })

    it("allows negative threshold", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [makeItem("a")], threshold: -1 } })
        expect(postedMessages[0].error).toBeUndefined()
    })

    it("passes args through to deduplicate", async () => {
        let dedup = await import("../src/renderer/deduplicator.ts")
        vi.mocked(dedup.deduplicate).mockClear()
        await loadWorker()
        let items = [makeItem("a")]
        globalSelf.onmessage({ data: { id: 1, items, threshold: 0.9 } })
        expect(dedup.deduplicate).toHaveBeenCalledWith(items, 0.9)
    })

    it("returns empty items array and removed 0 for empty input", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, items: [], threshold: 0.5 } })
        expect(postedMessages[0].items).toEqual([])
        expect(postedMessages[0].removed).toBe(0)
        expect(postedMessages[0].error).toBeUndefined()
    })

    it("handles large item array", async () => {
        await loadWorker()
        let items: TrainingItem[] = []
        for (let i = 0; i < 1000; i++) items.push(makeItem(`item-${i}`))
        globalSelf.onmessage({ data: { id: 1, items, threshold: 0.5 } })
        expect(postedMessages[0].items.length).toBe(1000)
        expect(postedMessages[0].removed).toBe(0)
    })

    it("catches errors thrown by deduplicate and posts them back", async () => {
        let dedup = await import("../src/renderer/deduplicator.ts")
        vi.mocked(dedup.deduplicate).mockImplementationOnce(() => { throw new Error("dedup exploded") })
        await loadWorker()
        globalSelf.onmessage({ data: { id: 9, items: [makeItem("a")], threshold: 0.5 } })
        expect(postedMessages[0].id).toBe(9)
        expect(postedMessages[0].error).toBe("dedup exploded")
        expect(postedMessages[0].items).toEqual([])
        expect(postedMessages[0].removed).toBe(0)
    })

    it("handles items with various formats", async () => {
        await loadWorker()
        let items: TrainingItem[] = [
            { format: "instruction", instruction: "Q1", input: "", output: "A1" },
            { format: "instruction", instruction: "Q2", input: "context", output: "A2" },
            { format: "conversation", input: "msg", output: "reply" } as any
        ]
        globalSelf.onmessage({ data: { id: 1, items, threshold: 0.5 } })
        expect(postedMessages[0].items.length).toBe(3)
        expect(postedMessages[0].removed).toBe(0)
    })

    it("removes exact duplicate items", async () => {
        await loadWorker()
        let items: TrainingItem[] = [
            makeItem("same"),
            makeItem("same"),
            makeItem("same")
        ]
        globalSelf.onmessage({ data: { id: 1, items, threshold: 0.5 } })
        expect(postedMessages[0].items.length).toBe(1)
        expect(postedMessages[0].removed).toBe(2)
    })

    it("uses id from data when id is a valid number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 999, items: [], threshold: 0.5 } })
        expect(postedMessages[0].id).toBe(999)
    })
})
