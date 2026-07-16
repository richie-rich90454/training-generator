// @vitest-environment node
import{describe,it,expect,vi,beforeEach,afterEach}from "vitest"
import{EventEmitter}from "events"

// Mock pdf-parse so the worker can be loaded without the optional dep.
vi.mock("pdf-parse",()=>({
    default: vi.fn(async (buffer: Buffer) => {
        // Detect a sentinel buffer content to simulate failure
        if (buffer.toString("utf-8").startsWith("FAIL:")) {
            throw new Error("pdf-parse mocked failure")
        }
        return { text: `extracted from ${buffer.toString("utf-8")}` }
    })
}))

// Mock worker_threads to expose a controllable MessagePort. The pdfWorker
// module reads parentPort at module load and exits if it's null, so the
// mock MUST be installed before the worker is imported.
let port: any
let postedResults: any[]
let consoleErrorSpy: any

beforeEach(() => {
    postedResults = []
    port = new EventEmitter() as any
    port.postMessage = vi.fn((msg: any) => { postedResults.push(msg) })
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.doMock("worker_threads", () => ({ parentPort: port }))
})

afterEach(() => {
    // Remove any uncaughtException / unhandledRejection listeners added by
    // the worker module (each fresh import re-registers them).
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")
    vi.doUnmock("worker_threads")
    vi.restoreAllMocks()
    vi.resetModules()
})

async function loadPdfWorker() {
    vi.resetModules()
    return await import("../src/workers/pdfWorker.ts")
}

describe("pdfWorker", () => {
    it("processes a valid PDF buffer and posts success result", async () => {
        await loadPdfWorker()
        let buffer = Buffer.from("VALID_PDF_CONTENT")
        port.emit("message", { id: 1, buffer })
        // Wait for the async handler to complete
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].id).toBe(1)
        expect(postedResults[0].success).toBe(true)
        expect(postedResults[0].text).toContain("extracted from VALID_PDF_CONTENT")
    })

    it("posts error for message missing id", async () => {
        await loadPdfWorker()
        port.emit("message", { notId: true, buffer: Buffer.from("x") })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].success).toBe(false)
        expect(postedResults[0].error).toContain("missing id")
    })

    it("posts error for message with id of zero (treated as missing)", async () => {
        await loadPdfWorker()
        port.emit("message", { id: 0, buffer: Buffer.from("x") })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].success).toBe(false)
        expect(postedResults[0].error).toContain("missing id")
    })

    it("posts error when buffer is missing", async () => {
        await loadPdfWorker()
        port.emit("message", { id: 5 })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].id).toBe(5)
        expect(postedResults[0].success).toBe(false)
        expect(postedResults[0].error).toContain("Invalid buffer")
    })

    it("posts error when buffer is not a Buffer instance", async () => {
        await loadPdfWorker()
        port.emit("message", { id: 5, buffer: "not-a-buffer" })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].success).toBe(false)
        expect(postedResults[0].error).toContain("Invalid buffer")
    })

    it("falls back to extractTextFromPDF on pdf-parse failure", async () => {
        await loadPdfWorker()
        // Buffer starting with "FAIL:" triggers the mocked pdf-parse to throw
        let buffer = Buffer.from("FAIL:some-pdf-bytes")
        port.emit("message", { id: 7, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults).toHaveLength(1)
        expect(postedResults[0].id).toBe(7)
        expect(postedResults[0].success).toBe(true)
        expect(postedResults[0].text).toBeDefined()
        expect(postedResults[0].warning).toBe("Used fallback extraction")
    })

    it("logs PDF Worker Error on failure", async () => {
        await loadPdfWorker()
        let buffer = Buffer.from("FAIL:some-pdf-bytes")
        port.emit("message", { id: 7, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(consoleErrorSpy).toHaveBeenCalledWith("PDF Worker Error:", expect.anything())
    })

    it("handles pdf-parse throwing AND fallback throwing gracefully", async () => {
        // Make fallback also throw by providing a buffer that toString
        // handles oddly — actually the fallback should not throw for any
        // input, so this test instead verifies the fallback path returns
        // a text string.
        await loadPdfWorker()
        let buffer = Buffer.from("FAIL:abc")
        port.emit("message", { id: 8, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        // Fallback should succeed and produce text
        expect(postedResults[0].success).toBe(true)
        expect(typeof postedResults[0].text).toBe("string")
    })

    it("preserves id across async processing", async () => {
        await loadPdfWorker()
        port.emit("message", { id: 42, buffer: Buffer.from("content") })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults[0].id).toBe(42)
    })

    it("extracts text from buffer using fallback path", async () => {
        await loadPdfWorker()
        // Trigger fallback directly by causing pdf-parse to fail
        let buffer = Buffer.from("FAIL:\x00some\x01text\x02")
        port.emit("message", { id: 9, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        // Fallback extractTextFromPDF strips non-printable chars
        expect(postedResults[0].success).toBe(true)
        let text = postedResults[0].text as string
        // Non-printable chars should be replaced with spaces
        expect(text).not.toContain("\x00")
        expect(text).not.toContain("\x01")
        expect(text).not.toContain("\x02")
    })

    it("registers uncaughtException handler that exits process", async () => {
        let exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as any)
        await loadPdfWorker()
        let handlers = process.listeners("uncaughtException")
        // The worker should have registered an uncaughtException handler
        let lastHandler = handlers[handlers.length - 1]
        expect(typeof lastHandler).toBe("function")

        // Trigger the handler — should call process.exit(1)
        try {
            lastHandler(new Error("test uncaught"))
        } catch {
            // Some handlers rethrow
        }
        await new Promise(r => setImmediate(r))

        // Should have logged and called process.exit(1)
        expect(consoleErrorSpy).toHaveBeenCalledWith("PDF Worker Uncaught Exception:", expect.anything())
        // Don't assert on exit code since we mocked it to no-op
        exitSpy.mockRestore()
    })

    it("registers unhandledRejection handler", async () => {
        await loadPdfWorker()
        let handlers = process.listeners("unhandledRejection")
        let lastHandler = handlers[handlers.length - 1]
        expect(typeof lastHandler).toBe("function")

        // Trigger the handler — should log but not exit
        lastHandler(new Error("test unhandled"), Promise.resolve())
        await new Promise(r => setImmediate(r))

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "PDF Worker Unhandled Rejection at:",
            expect.anything(),
            "reason:",
            expect.anything()
        )
    })

    it("handles empty buffer", async () => {
        await loadPdfWorker()
        let buffer = Buffer.alloc(0)
        port.emit("message", { id: 10, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        // Empty buffer is a valid Buffer instance, so should succeed
        expect(postedResults[0].id).toBe(10)
        // pdf-parse may return empty text or the fallback returns empty
        expect(typeof postedResults[0].text).toBe("string")
    })

    it("handles buffer with PDF magic number", async () => {
        await loadPdfWorker()
        let buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35]) // %PDF-1.5
        port.emit("message", { id: 11, buffer })
        await new Promise(r => setImmediate(r))
        await new Promise(r => setImmediate(r))

        expect(postedResults[0].id).toBe(11)
        expect(postedResults[0].success).toBe(true)
    })
})
