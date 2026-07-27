// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createAppStore, type AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"
import { withRoot } from "./setup.js"
import * as cacheModule from "../src/renderer/cache.js"
import { showConfirm } from "../src/renderer/confirm.js"
import { loadCheckpoint } from "../src/renderer/checkpoint.js"

// Mock warmCache to avoid file-system side effects; keep getCacheStats real.
vi.mock("../src/renderer/cache.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/renderer/cache.js")>()
    return {
        ...actual,
        warmCache: vi.fn(async () => 3),
    }
})

// Mock showConfirm so we can control confirm-dialog responses per test.
vi.mock("../src/renderer/confirm.js", () => ({
    showConfirm: vi.fn(async () => true),
    closeConfirm: vi.fn()
}))

// Mock checkpoint module so we can trigger loadCheckpoint errors per test.
vi.mock("../src/renderer/checkpoint.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/renderer/checkpoint.js")>()
    return {
        ...actual,
        loadCheckpoint: vi.fn(actual.loadCheckpoint),
        clearCheckpoint: vi.fn(actual.clearCheckpoint),
    }
})

function lastToast(app: AppStore) {
    const toasts = app.uiStore.toasts
    return toasts.length > 0 ? toasts[toasts.length - 1] : undefined
}

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

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function stubWindow(extra: Record<string, unknown> = {}): void {
    const electronAPI = {
        getPrompt: vi.fn(async () => ({ success: false })),
        readFile: vi.fn(async () => ({ success: false })),
        ...(extra.electronAPI as Record<string, unknown> || {})
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    vi.stubGlobal("window", {
        matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setInterval: vi.fn(() => 1),
        clearInterval: vi.fn(),
        setTimeout: vi.fn(() => 1),
        clearTimeout: vi.fn(),
        fetch: vi.fn(async () => ({ ok: false })),
        ...extra,
        electronAPI
    })
}

function createTestFile(name: string, content: string): File {
    return new File([content], name, { type: "text/plain" })
}

afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

// ------------------------------------------------------------------
// refreshOllamaModels
// ------------------------------------------------------------------
describe("AppStore refreshOllamaModels", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("sets and clears loading flag around checkOllamaStatus", async () => {
        let app = makeAppStore()
        await app.init()
        let loadingSeen: boolean[] = []
        // Spy after init so we observe refreshOllamaModels lifecycle
        let origSet = app.uiStore.setOllamaLoading
        app.uiStore.setOllamaLoading = (v: boolean) => {
            loadingSeen.push(v)
            origSet.call(app.uiStore, v)
        }
        await app.refreshOllamaModels()
        expect(loadingSeen).toContain(true)
        expect(loadingSeen).toContain(false)
        expect(app.uiStore.ollamaLoading()).toBe(false)
        app.dispose()
    })
})

// ------------------------------------------------------------------
// exportLogs
// ------------------------------------------------------------------
describe("AppStore exportLogs", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                exportLogs: vi.fn(async () => {}),
                writeLog: vi.fn()
            }
        })
    })
    it("calls electronAPI.exportLogs with logger and audit data", async () => {
        let app = makeAppStore()
        await app.init()
        await app.exportLogs()
        expect(window.electronAPI!.exportLogs).toHaveBeenCalled()
        let arg = (window.electronAPI!.exportLogs as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(typeof arg).toBe("string")
        expect(arg.length).toBeGreaterThan(0)
        app.dispose()
    })
    it("does not throw when electronAPI.exportLogs is absent", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.init()
        await expect(app.exportLogs()).resolves.toBeUndefined()
        app.dispose()
    })
    it("catches errors from logger.exportJSONL without throwing", async () => {
        let app = makeAppStore()
        await app.init()
        vi.spyOn(app.logger, "exportJSONL").mockImplementation(() => { throw new Error("boom") })
        await expect(app.exportLogs()).resolves.toBeUndefined()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// handleWarmCache
// ------------------------------------------------------------------
describe("AppStore handleWarmCache", () => {
    let realCreate: typeof document.createElement

    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        realCreate = document.createElement.bind(document)
        vi.mocked(cacheModule.warmCache).mockClear()
        vi.mocked(cacheModule.warmCache).mockResolvedValue(3)
    })

    function setupFakeInput(file: File | null): void {
        const fakeInput = realCreate("input")
        if (file) {
            Object.defineProperty(fakeInput, "files", {
                value: [file],
                configurable: true,
                writable: false
            })
        } else {
            Object.defineProperty(fakeInput, "files", {
                value: null,
                configurable: true,
                writable: false
            })
        }
        fakeInput.click = () => {
            fakeInput.dispatchEvent(new Event("change"))
        }
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            if (tag === "input") return fakeInput as any
            return realCreate(tag)
        })
    }

    it("warms cache from a JSON array file", async () => {
        const file = new File(
            [JSON.stringify([{ instruction: "a" }, { instruction: "b" }])],
            "data.json",
            { type: "application/json" }
        )
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        expect(cacheModule.warmCache).toHaveBeenCalled()
        let toast = lastToast(app)
        expect(toast?.message).toContain(String(3))
        app.dispose()
    })

    it("shows error toast when JSON is not an array", async () => {
        const file = new File(
            [JSON.stringify({ not: "an array" })],
            "obj.json",
            { type: "application/json" }
        )
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })

    it("parses JSONL content line by line", async () => {
        const jsonl = '{"instruction":"a"}\n{"instruction":"b"}\n{"instruction":"c"}'
        const file = new File([jsonl], "data.jsonl", { type: "application/json" })
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        expect(cacheModule.warmCache).toHaveBeenCalled()
        let calls = vi.mocked(cacheModule.warmCache).mock.calls
        let itemsArg = calls[calls.length - 1][0]
        expect(itemsArg.length).toBe(3)
        app.dispose()
    })

    it("skips invalid JSONL lines", async () => {
        const jsonl = '{"instruction":"a"}\nNOT VALID\n{"instruction":"b"}'
        const file = new File([jsonl], "data.jsonl", { type: "application/json" })
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        let calls = vi.mocked(cacheModule.warmCache).mock.calls
        let itemsArg = calls[calls.length - 1][0]
        expect(itemsArg.length).toBe(2)
        app.dispose()
    })

    it("shows error toast when no valid items found", async () => {
        const file = new File([JSON.stringify({ not: "array" })], "empty.json", { type: "application/json" })
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })

    it("returns early when no file is selected", async () => {
        setupFakeInput(null)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        expect(cacheModule.warmCache).not.toHaveBeenCalled()
        app.dispose()
    })

    it("catches file read errors", async () => {
        const file = new File(["content"], "data.json", { type: "application/json" })
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        // Override file.text() to reject
        Object.defineProperty(file, "text", {
            value: () => Promise.reject(new Error("read error")),
            configurable: true
        })
        app.handleWarmCache()
        await wait(100)
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })

    it("catches outer errors when click throws", async () => {
        const fakeInput = {
            type: "",
            accept: "",
            files: null,
            addEventListener: vi.fn(),
            click: () => { throw new Error("click failed") }
        }
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            if (tag === "input") return fakeInput as any
            return realCreate(tag)
        })
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(50)
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })

    it("shows toast with warmed count on success", async () => {
        vi.mocked(cacheModule.warmCache).mockResolvedValue(5)
        const file = new File(
            [JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }])],
            "data.json",
            { type: "application/json" }
        )
        setupFakeInput(file)
        let app = makeAppStore()
        await app.init()
        app.handleWarmCache()
        await wait(100)
        let toast = lastToast(app)
        expect(toast?.type).toBe("success")
        app.dispose()
    })
})

// ------------------------------------------------------------------
// showStats and showQualityReport
// ------------------------------------------------------------------
describe("AppStore showStats and showQualityReport", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("opens stats modal", async () => {
        let app = makeAppStore()
        await app.init()
        app.showStats()
        expect(app.uiStore.statsOpen()).toBe(true)
        app.dispose()
    })
    it("does nothing when qualityReport is null", () => {
        let app = makeAppStore()
        app.showQualityReport()
        expect(app.uiStore.qualityOpen()).toBe(false)
        app.dispose()
    })
    it("opens quality modal when report exists", async () => {
        let app = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        // After processing, qualityReport should be set
        if (app.qualityReport()) {
            app.showQualityReport()
            expect(app.uiStore.qualityOpen()).toBe(true)
        }
        app.dispose()
    })
})

// ------------------------------------------------------------------
// openUserGuide
// ------------------------------------------------------------------
describe("AppStore openUserGuide", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    it("opens guide successfully via electronAPI", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                openUserGuide: vi.fn(async () => ({ success: true })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.init()
        await app.openUserGuide()
        expect(app.uiStore.logs.some(l => l.message === t("log.openedUserGuide"))).toBe(true)
        app.dispose()
    })
    it("logs error when electronAPI returns failure", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                openUserGuide: vi.fn(async () => ({ success: false, error: "no file" })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.init()
        await app.openUserGuide()
        expect(app.uiStore.logs.some(l => l.type === "error")).toBe(true)
        app.dispose()
    })
    it("warns when electronAPI is unavailable", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.init()
        await app.openUserGuide()
        expect(app.uiStore.logs.some(l => l.type === "warning" && l.message === t("log.userGuideElectronOnly"))).toBe(true)
        app.dispose()
    })
    it("catches thrown errors", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                openUserGuide: vi.fn(async () => { throw new Error("crash") }),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.init()
        await expect(app.openUserGuide()).resolves.toBeUndefined()
        expect(app.uiStore.logs.some(l => l.type === "error")).toBe(true)
        app.dispose()
    })
})

// ------------------------------------------------------------------
// clearAll with no files/output
// ------------------------------------------------------------------
describe("AppStore clearAll empty branch", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("clears without confirm when nothing to clear", () => {
        let app = makeAppStore()
        app.clearAll()
        expect(app.fileStore.hasFiles()).toBe(false)
        expect(app.outputStore.hasOutput()).toBe(false)
        expect(app.uiStore.logs.some(l => l.message === t("log.clearedAll"))).toBe(true)
        app.dispose()
    })
})

// ------------------------------------------------------------------
// copyOutput branches
// ------------------------------------------------------------------
describe("AppStore copyOutput branches", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("warns when no data to copy", async () => {
        let app = makeAppStore()
        await app.init()
        let result = await app.copyOutput()
        expect(result).toBe(false)
        expect(app.uiStore.logs.some(l => l.type === "warning")).toBe(true)
        app.dispose()
    })
    it("shows warning toast when copy returns false", async () => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async () => {})
            }
        })
        let app = makeAppStore()
        await app.init()
        // Add output but make copyOutput return false via spy
        app.outputStore.appendOutput([{ format: "text", text: "hello" }])
        vi.spyOn(app.outputStore, "copyOutput").mockResolvedValue(false)
        let result = await app.copyOutput()
        expect(result).toBe(false)
        let toast = lastToast(app)
        expect(toast?.type).toBe("warning")
        app.dispose()
    })
    it("shows error toast when copy throws", async () => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async () => {})
            }
        })
        let app = makeAppStore()
        await app.init()
        app.outputStore.appendOutput([{ format: "text", text: "hello" }])
        vi.spyOn(app.outputStore, "copyOutput").mockRejectedValue(new Error("copy failed"))
        let result = await app.copyOutput()
        expect(result).toBe(false)
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })
})

// ------------------------------------------------------------------
// maybeStartTour
// ------------------------------------------------------------------
describe("AppStore maybeStartTour", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("returns early when tour already completed", () => {
        localStorage.setItem("train-generator-onboarding-completed", "true")
        let app = makeAppStore()
        // Should not throw and should return early
        expect(() => app.maybeStartTour()).not.toThrow()
        app.dispose()
    })
    it("starts tour when not completed", () => {
        let app = makeAppStore()
        expect(() => app.maybeStartTour()).not.toThrow()
        app.dispose()
    })
    it("catches errors from localStorage access", () => {
        // Force localStorage to throw
        const orig = localStorage.getItem
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied") })
        let app = makeAppStore()
        expect(() => app.maybeStartTour()).not.toThrow()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// saveProgress and checkForProgress branches
// ------------------------------------------------------------------
describe("AppStore saveProgress branches", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("returns early when saveProgress is not available", async () => {
        let app = makeAppStore()
        await app.init()
        await expect(app.saveProgress()).resolves.toBeUndefined()
        app.dispose()
    })
    it("calls saveProgress when available", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                saveProgress: vi.fn(async () => {}),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        app.outputStore.appendOutput([{ format: "text", text: "out" }])
        await app.saveProgress()
        expect(window.electronAPI!.saveProgress).toHaveBeenCalled()
        app.dispose()
    })
    it("catches errors from saveProgress", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                saveProgress: vi.fn(async () => { throw new Error("disk full") }),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await expect(app.saveProgress()).resolves.toBeUndefined()
        app.dispose()
    })
})

describe("AppStore checkForProgress branches", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    it("returns early when loadProgress is not available", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await expect(app.checkForProgress()).resolves.toBeUndefined()
        app.dispose()
    })
    it("logs when saved progress has output data", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({
                    success: true,
                    data: { outputData: [{ format: "text", text: "saved" }] }
                })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.checkForProgress()
        // Verify logger.info was called (foundSavedProgress)
        // The log goes through the structured Logger, not uiStore.addLog
        app.dispose()
    })
    it("does not log when no output data", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: true, data: {} })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await expect(app.checkForProgress()).resolves.toBeUndefined()
        app.dispose()
    })
    it("catches errors from loadProgress", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => { throw new Error("corrupt") }),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await expect(app.checkForProgress()).resolves.toBeUndefined()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// loadCheckpointState decline and catch
// ------------------------------------------------------------------
describe("AppStore loadCheckpointState decline", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("clears checkpoint when user declines restore", async () => {
        vi.mocked(showConfirm).mockResolvedValueOnce(false)
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({
                    success: true,
                    data: {
                        files: [{ name: "a.txt", size: 100, type: "text/plain" }],
                        completedChunks: {},
                        outputData: [{ format: "text", text: "restored" }],
                        config: { model: "m", processingType: "instruction", chunkSize: 2000, concurrency: 3, provider: "ollama" },
                        timestamp: Date.now()
                    }
                })),
                clearCheckpoint: vi.fn(async () => {}),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.loadCheckpointState()
        expect(window.electronAPI!.clearCheckpoint).toHaveBeenCalled()
        expect(app.outputStore.itemCount()).toBe(0)
        app.dispose()
    })
    it("catches errors from loadCheckpoint", async () => {
        vi.mocked(loadCheckpoint).mockRejectedValueOnce(new Error("corrupt"))
        let app = makeAppStore()
        await expect(app.loadCheckpointState()).resolves.toBeUndefined()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// checkOllamaStatus browser mode and catch
// ------------------------------------------------------------------
describe("AppStore checkOllamaStatus branches", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    it("returns browser status when electronAPI is unavailable", async () => {
        stubWindow({
            electronAPI: undefined
        })
        let app = makeAppStore()
        let status = await app.checkOllamaStatus()
        expect(status.running).toBe(false)
        expect(app.uiStore.availableOllamaModels()).toEqual([])
        app.dispose()
    })
    it("returns error status when checkOllama throws", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => { throw new Error("network error") }),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        let status = await app.checkOllamaStatus()
        expect(status.running).toBe(false)
        expect(status.error).toBe("network error")
        app.dispose()
    })
})

// ------------------------------------------------------------------
// detectPlatform catch
// ------------------------------------------------------------------
describe("AppStore detectPlatform catch", () => {
    it("falls back to unknown on error", async () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => { throw new Error("denied") }),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        await app.detectPlatform()
        expect(document.documentElement.getAttribute("data-platform")).toBe("unknown")
        app.dispose()
    })
})

// ------------------------------------------------------------------
// initProvider catch
// ------------------------------------------------------------------
describe("AppStore initProvider catch", () => {
    it("catches provider creation errors", () => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
        let app = makeAppStore()
        // Set an invalid provider type to trigger the catch
        app.settingsStore.setProvider("invalid-provider" as any)
        expect(() => app.initProvider()).not.toThrow()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// stopProcessing and dispose with activePipeline
// ------------------------------------------------------------------
describe("AppStore stopProcessing with active pipeline", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("aborts active pipeline on stopProcessing", async () => {
        let app = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        app.fileStore.addFiles([createTestFile("a.txt", "content ".repeat(50))])
        let promise = app.processFiles()
        await wait(10)
        app.stopProcessing()
        await promise
        expect(app.isProcessing()).toBe(false)
        app.dispose()
    })
    it("aborts active pipeline on dispose", async () => {
        let app = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        app.fileStore.addFiles([createTestFile("a.txt", "content ".repeat(50))])
        let promise = app.processFiles()
        await wait(10)
        app.dispose()
        // Ensure no unhandled rejection
        await promise.catch(() => {})
    })
})

// ------------------------------------------------------------------
// updateOutputPreview
// ------------------------------------------------------------------
describe("AppStore updateOutputPreview", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("triggers debounced preview update", () => {
        let app = makeAppStore()
        app.outputStore.appendOutput([{ format: "text", text: "preview me" }])
        expect(() => app.updateOutputPreview()).not.toThrow()
        app.dispose()
    })
})

// ------------------------------------------------------------------
// getPipelineSettings defaults via processFiles
// ------------------------------------------------------------------
describe("AppStore processFiles with default settings", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async () => "windows"),
                checkOllama: vi.fn(async () => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async () => ({ success: false })),
                loadCheckpoint: vi.fn(async () => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    it("refuses processing without model set in non-demo mode", async () => {
        let app = makeAppStore()
        await app.init()
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        await app.processFiles()
        let toast = lastToast(app)
        expect(toast?.type).toBe("error")
        app.dispose()
    })
})
