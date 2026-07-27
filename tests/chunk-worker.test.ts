// @vitest-environment node
import{describe,it,expect,vi,beforeEach,afterEach}from "vitest"

// Mock the chunker dependency so we can verify the worker invokes it
// correctly without running the real chunker logic.
vi.mock("../src/renderer/chunker.ts",()=>({
    semanticChunk: vi.fn((text: string, chunkSize: number) => {
        // Simple stub: split text into chunks of chunkSize chars
        let chunks: string[] = []
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize))
        }
        return chunks
    })
}))

// Set up a global self object that the worker expects. We capture postMessage
// calls so assertions can inspect them.
let postedMessages: any[] = []
let globalSelf: any
let originalSelf: any

beforeEach(() => {
    postedMessages = []
    globalSelf = {
        postMessage: vi.fn((msg: any) => { postedMessages.push(msg) }),
        onmessage: null as any
    }
    // Preserve original self if present (happy-dom may define it)
    originalSelf = (globalThis as any).self
    ;(globalThis as any).self = globalSelf
})

afterEach(() => {
    if (originalSelf === undefined) delete (globalThis as any).self
    else (globalThis as any).self = originalSelf
    vi.restoreAllMocks()
})

// Import the worker AFTER self is set up. The worker assigns to
// self.onmessage at module load time.
async function loadWorker() {
    vi.resetModules()
    return await import("../src/renderer/workers/chunk.worker.ts")
}

describe("chunk.worker", () => {
    it("posts chunks back on valid message", async () => {
        await loadWorker()
        // Simulate a message
        let handler = globalSelf.onmessage
        expect(handler).toBeDefined()
        handler({ data: { id: 42, text: "hello world this is text", chunkSize: 5, overlap: 0, smartSizing: false } })

        expect(postedMessages).toHaveLength(1)
        expect(postedMessages[0].id).toBe(42)
        expect(Array.isArray(postedMessages[0].chunks)).toBe(true)
        expect(postedMessages[0].chunks.length).toBeGreaterThan(0)
    })

    it("posts error for missing data payload", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: null })
        expect(postedMessages).toHaveLength(1)
        expect(postedMessages[0].id).toBe(-1)
        expect(postedMessages[0].chunks).toEqual([])
        expect(postedMessages[0].error).toContain("missing data payload")
    })

    it("posts error for non-object data", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: "string-not-object" })
        expect(postedMessages).toHaveLength(1)
        expect(postedMessages[0].id).toBe(-1)
        expect(postedMessages[0].error).toContain("missing data payload")
    })

    it("uses sentinel id -1 when data.id is not a number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: "not-a-number", text: "t", chunkSize: 10, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].id).toBe(-1)
    })

    it("posts error when text is not a string", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: 123, chunkSize: 10, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'text' must be a string")
        expect(postedMessages[0].chunks).toEqual([])
    })

    it("posts error when chunkSize is not a positive number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: -5, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'chunkSize' must be a positive finite number")
    })

    it("posts error when chunkSize is zero", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: 0, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'chunkSize' must be a positive finite number")
    })

    it("posts error when chunkSize is NaN", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: NaN, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'chunkSize' must be a positive finite number")
    })

    it("posts error when chunkSize is Infinity", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: Infinity, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'chunkSize' must be a positive finite number")
    })

    it("posts error when overlap is negative", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: 10, overlap: -1, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'overlap' must be a non-negative finite number")
    })

    it("posts error when overlap is NaN", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: 10, overlap: NaN, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'overlap' must be a non-negative finite number")
    })

    it("posts error when overlap is Infinity", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: 10, overlap: Infinity, smartSizing: false } })
        expect(postedMessages[0].error).toContain("'overlap' must be a non-negative finite number")
    })

    it("posts error when smartSizing is not a boolean", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "t", chunkSize: 10, overlap: 0, smartSizing: "yes" } })
        expect(postedMessages[0].error).toContain("'smartSizing' must be a boolean")
    })

    it("passes args through to semanticChunk", async () => {
        let chunker = await import("../src/renderer/chunker.ts")
        vi.mocked(chunker.semanticChunk).mockClear()
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "hello", chunkSize: 5, overlap: 2, smartSizing: true } })
        expect(chunker.semanticChunk).toHaveBeenCalledWith("hello", 5, 2, true)
    })

    it("allows overlap of zero", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "hello", chunkSize: 5, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].error).toBeUndefined()
    })

    it("returns empty chunks array for empty text", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 1, text: "", chunkSize: 10, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].id).toBe(1)
        expect(postedMessages[0].chunks).toEqual([])
        expect(postedMessages[0].error).toBeUndefined()
    })

    it("catches errors thrown by semanticChunk and posts them back", async () => {
        let chunker = await import("../src/renderer/chunker.ts")
        vi.mocked(chunker.semanticChunk).mockImplementationOnce(() => { throw new Error("chunker exploded") })
        await loadWorker()
        globalSelf.onmessage({ data: { id: 7, text: "hello", chunkSize: 5, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].id).toBe(7)
        expect(postedMessages[0].error).toBe("chunker exploded")
        expect(postedMessages[0].chunks).toEqual([])
    })

    it("handles valid message with all fields set correctly", async () => {
        await loadWorker()
        let longText = "a".repeat(100)
        globalSelf.onmessage({ data: { id: 99, text: longText, chunkSize: 25, overlap: 5, smartSizing: true } })
        expect(postedMessages[0].id).toBe(99)
        expect(postedMessages[0].chunks.length).toBeGreaterThan(0)
        // Each chunk should be at most chunkSize characters
        for (let chunk of postedMessages[0].chunks) {
            expect(chunk.length).toBeLessThanOrEqual(25)
        }
    })

    it("uses id from data when id is a valid number", async () => {
        await loadWorker()
        globalSelf.onmessage({ data: { id: 12345, text: "t", chunkSize: 10, overlap: 0, smartSizing: false } })
        expect(postedMessages[0].id).toBe(12345)
    })
})
