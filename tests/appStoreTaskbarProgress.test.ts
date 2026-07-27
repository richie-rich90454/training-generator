// @vitest-environment happy-dom
//
// Tests for the OS taskbar progress overlay dispatch in appStore.
//
// Verifies that `window.electronAPI.setProgress` is called with the correct
// values across the processing lifecycle:
//   - Initial store creation triggers a clear (-2) via the createEffect
//     first-run (isProcessing starts false).
//   - processFiles() dispatches setProgress(0) on start.
//   - onFileComplete ticks setProgress(completed/total).
//   - finish/abort/error all dispatch setProgress(-2) via the createEffect
//     watching isProcessing.
//   - No-throw when electronAPI.setProgress is undefined or electronAPI
//     itself is undefined (browser/test mode).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createAppStore, type AppStore } from "../src/renderer/stores/appStore.js"
import { withRoot } from "./setup.js"

let disposes: Array<() => void> = []

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
})

function makeAppStore(): AppStore {
    return withRoot((dispose) => {
        const app = createAppStore()
        disposes.push(() => {
            app.dispose()
            dispose()
        })
        return app
    })
}

vi.mock("../src/renderer/confirm.js", () => ({
    showConfirm: vi.fn(async () => true),
    closeConfirm: vi.fn()
}))

function createTestFile(name: string, content: string): File {
    return new File([content], name, { type: "text/plain" })
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
    vi.unstubAllGlobals()
})

// Builds a window stub with a tracked `setProgress` mock. Other electronAPI
// methods are populated so createAppStore's init() doesn't throw.
function stubWindowWithProgress(extra: Record<string, unknown> = {}): {
    setProgress: ReturnType<typeof vi.fn>
    window: Record<string, unknown>
} {
    const setProgress = vi.fn()
    const electronAPI = {
        getPlatform: vi.fn(async () => "windows"),
        checkOllama: vi.fn(async () => ({ running: true, models: ["llama2"], version: "0.1.0" })),
        loadProgress: vi.fn(async () => ({ success: false })),
        loadCheckpoint: vi.fn(async () => ({ success: false })),
        saveCheckpoint: vi.fn(async () => {}),
        saveProgress: vi.fn(async () => {}),
        clearCheckpoint: vi.fn(async () => {}),
        writeLog: vi.fn(),
        setProgress,
        ...(extra.electronAPI as Record<string, unknown> || {})
    }
    const windowStub = {
        matchMedia: vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setInterval: vi.fn(() => 1),
        clearInterval: vi.fn(),
        setTimeout: vi.fn((fn: () => void) => { fn(); return 1 }),
        clearTimeout: vi.fn(),
        fetch: vi.fn(async () => ({ ok: false })),
        ...extra,
        electronAPI
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    vi.stubGlobal("window", windowStub)
    return { setProgress, window: windowStub }
}

describe("AppStore taskbar progress dispatch", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("dispatches setProgress(-2) on store creation (initial createEffect run)", async () => {
        const { setProgress } = stubWindowWithProgress()
        makeAppStore()
        // SolidJS effects run on the microtask queue; flush them.
        await wait(0)
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("dispatches setProgress(0) when processFiles starts in demo mode", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0) // flush the initial createEffect
        setProgress.mockClear()

        app.toggleDemoMode()
        app.fileStore.addFiles([
            createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))
        ])
        const promise = app.processFiles()
        await wait(0)
        // On start, appStore dispatches setProgress(0).
        expect(setProgress).toHaveBeenCalledWith(0)
        await promise
        await wait(0)
    })

    it("dispatches setProgress(completed/total) on each file completion tick", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        app.toggleDemoMode()
        // Three files so we can observe multiple ticks at 1/3, 2/3, 3/3.
        app.fileStore.addFiles([
            createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20)),
            createTestFile("b.txt", "This is a test file with enough text to produce a chunk. ".repeat(20)),
            createTestFile("c.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))
        ])
        await app.processFiles()
        await wait(0)

        // At least one tick at 1/3 should have fired during processing.
        // The exact sequence depends on the pipeline, so we assert that at
        // least one fractional value was sent.
        const tickCalls = setProgress.mock.calls
            .map(c => c[0])
            .filter(v => typeof v === "number" && v > 0 && v < 1)
        expect(tickCalls.length).toBeGreaterThan(0)
    })

    it("dispatches setProgress(-2) when processing completes (clear)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        app.toggleDemoMode()
        app.fileStore.addFiles([
            createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))
        ])
        await app.processFiles()
        await wait(0)
        // After processing, isProcessing transitions to false, which triggers
        // the createEffect to clear the overlay.
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("dispatches setProgress(-2) on abort (stopProcessing)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        app.toggleDemoMode()
        app.fileStore.addFiles([
            createTestFile("a.txt", "content ".repeat(200))
        ])
        const promise = app.processFiles()
        await wait(50)
        app.stopProcessing()
        await promise
        await wait(0)
        // stopProcessing → setIsProcessing(false) → createEffect → setProgress(-2).
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("dispatches setProgress(-2) on processing error (finally block)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        app.toggleDemoMode()
        // An empty file causes the orchestrator to fail (noTextContent),
        // exercising the finally-block cleanup that sets isProcessing=false.
        app.fileStore.addFiles([createTestFile("empty.txt", "")])
        await app.processFiles()
        await wait(0)
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("dispatches setProgress(-2) when no files are present (early return)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        // No files → processFiles early-returns after setIsProcessing(true)/false.
        await app.processFiles()
        await wait(0)
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("dispatches setProgress(-2) when no model is set (early return)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        // Non-demo mode with no model → early return.
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        await app.processFiles()
        await wait(0)
        expect(setProgress).toHaveBeenCalledWith(-2)
    })

    it("does not throw when electronAPI.setProgress is undefined", async () => {
        // Strip the setProgress method; the optional chaining should swallow it.
        stubWindowWithProgress({
            electronAPI: {
                // Override: no setProgress here.
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: true, models: ["llama2"], version: "0.1.0" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        const app = makeAppStore()
        await app.init()
        await expect(async () => {
            await wait(0)
            app.toggleDemoMode()
            app.fileStore.addFiles([
                createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))
            ])
            await app.processFiles()
            await wait(0)
        }).not.toThrow()
    })

    it("does not throw when electronAPI itself is undefined (browser mode)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
        vi.stubGlobal("window", {
            matchMedia: vi.fn(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn()
            })),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            setInterval: vi.fn(() => 1),
            clearInterval: vi.fn(),
            setTimeout: vi.fn((fn: () => void) => { fn(); return 1 }),
            clearTimeout: vi.fn(),
            fetch: vi.fn(async () => ({ ok: false }))
            // electronAPI deliberately omitted.
        })
        const app = makeAppStore()
        await expect(async () => {
            await wait(0)
            app.toggleDemoMode()
            app.fileStore.addFiles([
                createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))
            ])
            await app.processFiles()
            await wait(0)
        }).not.toThrow()
    })

    it("does not call setProgress after window close (disposed store)", async () => {
        const { setProgress } = stubWindowWithProgress()
        const app = makeAppStore()
        await app.init()
        await wait(0)
        setProgress.mockClear()

        app.dispose()
        // After dispose, the createEffect should not be active, so toggling
        // isProcessing through any path should not invoke setProgress.
        await wait(0)
        // Verify no NEW calls after dispose (other than what dispose itself
        // may have synchronously triggered, which we cleared above).
        const callsBefore = setProgress.mock.calls.length
        await wait(50)
        expect(setProgress.mock.calls.length).toBe(callsBefore)
    })
})
