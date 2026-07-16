// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createAppStore, type AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"
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
    showConfirm: vi.fn(async() => true),
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
function stubWindow(extra: Record<string, unknown> = {}): void {
    let electronAPI = {
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
        setTimeout: vi.fn((fn: () => void) => { fn(); return 1 }),
        clearTimeout: vi.fn(),
        fetch: vi.fn(async () => ({ ok: false })),
        ...extra,
        electronAPI
    })
}
describe("AppStore initialization", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: ["llama2"], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("creates all sub-stores", () => {
        let app: AppStore = makeAppStore()
        expect(app.fileStore).toBeDefined()
        expect(app.outputStore).toBeDefined()
        expect(app.settingsStore).toBeDefined()
        expect(app.uiStore).toBeDefined()
        expect(app.processor).toBeDefined()
        expect(app.promptManager).toBeDefined()
    })
    it("starts not processing", () => {
        let app: AppStore = makeAppStore()
        expect(app.isProcessing()).toBe(false)
    })
    it("initializes provider as ollama by default", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        expect(app.providerManager).not.toBeNull()
    })
    it("detects platform from electron", async() => {
        let app: AppStore = makeAppStore()
        await app.detectPlatform()
        expect(document.documentElement.getAttribute("data-platform")).toBe("windows")
    })
    it("falls back to user agent for platform", async() => {
        stubWindow({ electronAPI: undefined })
        let app: AppStore = makeAppStore()
        await app.detectPlatform()
        expect(["windows", "macos", "linux", "unknown"]).toContain(document.documentElement.getAttribute("data-platform"))
    })
    it("starts ollama monitor on init", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        expect(app.uiStore.ollamaStatus().running).toBe(true)
        app.dispose()
    })
    it("loads settings on init", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ model: "test-model", provider: "ollama" }))
        let app: AppStore = makeAppStore()
        await app.init()
        expect(app.settingsStore.settings.model).toBe("test-model")
        app.dispose()
    })
    it("applies output format from settings on init", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ outputFormat: "csv", provider: "ollama" }))
        let app: AppStore = makeAppStore()
        await app.init()
        expect(app.outputStore.exportFormat()).toBe("csv")
        app.dispose()
    })
    it("disposes without throwing", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        expect(() => app.dispose()).not.toThrow()
    })
    it("stops ollama monitor on dispose", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.dispose()
        expect(() => app.stopOllamaMonitor()).not.toThrow()
    })
})
describe("AppStore demo mode", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("toggles demo mode on", () => {
        let app: AppStore = makeAppStore()
        app.toggleDemoMode()
        expect(app.processor.demoMode).toBe(true)
        expect(app.fileStore.demoActive()).toBe(true)
    })
    it("toggles demo mode off", () => {
        let app: AppStore = makeAppStore()
        app.toggleDemoMode()
        app.toggleDemoMode()
        expect(app.processor.demoMode).toBe(false)
        expect(app.fileStore.demoActive()).toBe(false)
    })
    it("logs demoModeEnabled when toggled on and demoModeDisabled when toggled off", () => {
        let app: AppStore = makeAppStore()
        let enabledMsg = t("log.demoModeEnabled")
        let disabledMsg = t("log.demoModeDisabled")

        app.toggleDemoMode()
        expect(app.processor.demoMode).toBe(true)
        expect(app.uiStore.logs.some(l => l.message === enabledMsg && l.type === "info")).toBe(true)

        app.toggleDemoMode()
        expect(app.processor.demoMode).toBe(false)
        expect(app.uiStore.logs.some(l => l.message === disabledMsg && l.type === "info")).toBe(true)

        app.dispose()
    })
    it("allows processing in demo mode without ollama", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        app.fileStore.addFiles([createTestFile("demo.txt", "This is a demo file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        expect(app.outputStore.itemCount()).toBeGreaterThan(0)
        app.dispose()
    })
})
describe("AppStore processing guardrails", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: ["llama2"], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("refuses to process without files", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        await app.processFiles()
        expect(app.isProcessing()).toBe(false)
        expect(app.uiStore.logs.some(l => l.message.includes("No files"))).toBe(true)
        app.dispose()
    })
    it("refuses to process when ollama offline and not demo", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: false, models: [], version: "" })),
                writeLog: vi.fn()
            }
        })
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        app.fileStore.setOllamaReady(false)
        app.uiStore.setOllamaStatus({ running: false, models: [] })
        await app.processFiles()
        expect(app.isProcessing()).toBe(false)
        app.dispose()
    })
    it("prevents concurrent processing", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.fileStore.addFiles([createTestFile("a.txt", "content content content content content content content content content content")])
        app.settingsStore.setModel("llama2")
        // Enable demo mode so processing doesn't need real API calls
        app.toggleDemoMode()
        let p1 = app.processFiles()
        // isProcessing should be true while p1 is running
        expect(app.isProcessing()).toBe(true)
        let p2 = app.processFiles()
        // p2 should be rejected because processing is already in progress
        expect(app.uiStore.logs.some(l => l.message.includes("already in progress"))).toBe(true)
        await Promise.all([p1, p2])
        app.dispose()
    })
    it("stops processing on demand", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.fileStore.addFiles([createTestFile("a.txt", "content content content content content content content content content content")])
        let promise = app.processFiles()
        await wait(50)
        app.stopProcessing()
        await promise
        expect(app.isProcessing()).toBe(false)
        app.dispose()
    })
    it("updates progress during processing", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        let promise = app.processFiles()
        await wait(100)
        expect(app.uiStore.progressPercent()).toBeGreaterThanOrEqual(0)
        await promise
        app.dispose()
    })
})
describe("AppStore clear and export", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: ["llama2"], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                saveFileDialog: vi.fn(async(name: string) => `/path/${name}`),
                saveFile: vi.fn(async() => ({ success: true })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("clears files and output", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        app.outputStore.appendOutput([{ format: "instruction", instruction: "test", input: "", output: "out" }])
        app.clearAll()
        await wait(50)
        expect(app.fileStore.hasFiles()).toBe(false)
        expect(app.outputStore.hasOutput()).toBe(false)
        app.dispose()
    })
    it("exports output when data exists", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.outputStore.appendOutput([{ format: "instruction", instruction: "test", input: "", output: "out" }])
        await app.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).toHaveBeenCalled()
        app.dispose()
    })
    it("skips export when no data", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        await app.exportOutput("jsonl")
        expect(window.electronAPI!.saveFile).not.toHaveBeenCalled()
        app.dispose()
    })
    it("copies output", async() => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: vi.fn(async() => {})
            }
        })
        let app: AppStore = makeAppStore()
        await app.init()
        app.outputStore.appendOutput([{ format: "text", text: "hello" }])
        await app.copyOutput()
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
        app.dispose()
    })
})
describe("AppStore settings integration", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: ["llama2"], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("saves preset and reinitializes provider", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.settingsStore.setModel("new-model")
        await app.savePreset()
        expect(localStorage.getItem("train-generator-settings")).toContain("new-model")
        expect(app.providerManager).not.toBeNull()
        app.dispose()
    })
    it("opens and closes settings modal", async() => {
        let app: AppStore = makeAppStore()
        app.showSettings()
        expect(app.uiStore.settingsOpen()).toBe(true)
        app.hideSettings()
        expect(app.uiStore.settingsOpen()).toBe(false)
        app.dispose()
    })
    it("showHelp starts the onboarding tour", async() => {
        let app: AppStore = makeAppStore()
        const timeoutSpy = vi.spyOn(window, "setTimeout")
        app.showHelp()
        expect(timeoutSpy).toHaveBeenCalled()
        app.dispose()
        timeoutSpy.mockRestore()
    })
    it("opens shortcuts modal", async() => {
        let app: AppStore = makeAppStore()
        app.showShortcutsHelp()
        expect(app.uiStore.shortcutsOpen()).toBe(true)
        app.dispose()
    })
})
describe("AppStore logging", () => {
    beforeEach(() => {
        stubWindow({
            electronAPI: {
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("adds info log", () => {
        let app: AppStore = makeAppStore()
        app.addLog("test message", "info")
        expect(app.uiStore.logs.length).toBeGreaterThan(0)
        expect(app.uiStore.logs[0].message).toBe("test message")
        expect(app.uiStore.logs[0].type).toBe("info")
        app.dispose()
    })
    it("adds error log", () => {
        let app: AppStore = makeAppStore()
        app.addLog("error message", "error")
        expect(app.uiStore.logs[0].type).toBe("error")
        app.dispose()
    })
    it("sets progress", () => {
        let app: AppStore = makeAppStore()
        app.setProgress(42, "working")
        expect(app.uiStore.progressPercent()).toBe(42)
        expect(app.uiStore.progressText()).toBe("working")
        app.dispose()
    })
})
describe("AppStore checkpoint", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [], version: "" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                saveCheckpoint: vi.fn(async() => {}),
                saveProgress: vi.fn(async() => {}),
                clearCheckpoint: vi.fn(async() => {}),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("saves progress through electron", async() => {
        let app: AppStore = makeAppStore()
        app.fileStore.addFiles([createTestFile("a.txt", "content")])
        app.outputStore.appendOutput([{ format: "text", text: "output" }])
        await app.saveProgress()
        expect(window.electronAPI!.saveProgress).toHaveBeenCalled()
        app.dispose()
    })
    it("loads checkpoint state when confirmed", async() => {
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [], version: "" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({
                    success: true,
                    data: {
                        files: [{ name: "a.txt", size: 100, type: "text/plain" }],
                        completedChunks: {},
                        outputData: [{ format: "text", text: "restored" }],
                        config: { model: "m", processingType: "instruction", chunkSize: 2000, concurrency: 3, provider: "ollama" },
                        timestamp: Date.now()
                    }
                })),
                clearCheckpoint: vi.fn(async() => {}),
                writeLog: vi.fn()
            }
        })
        let app: AppStore = makeAppStore()
        await app.loadCheckpointState()
        expect(app.outputStore.itemCount()).toBe(1)
        app.dispose()
    })
})
describe("AppStore reset between runs", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("resets processor state before processing starts", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        let resetSpy = vi.spyOn(app.processor, 'reset')
        let resetStatsSpy = vi.spyOn(app.processor, 'resetStats')
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        expect(resetSpy).toHaveBeenCalled()
        expect(resetStatsSpy).toHaveBeenCalled()
        app.dispose()
    })
    it("clears previous output when processing restarts", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        app.outputStore.appendOutput([{ format: "text", text: "PREVIOUS_OUTPUT_MARKER" }])
        expect(app.outputStore.outputData.some(i => i.text === "PREVIOUS_OUTPUT_MARKER")).toBe(true)
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        expect(app.outputStore.outputData.some(i => i.text === "PREVIOUS_OUTPUT_MARKER")).toBe(false)
        app.dispose()
    })
})
describe("AppStore ollama offline warning (non-blocking)", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: false, models: [], version: "" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("warns but does not block processing when ollama is offline", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.settingsStore.setModel("some-model")
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        let warnMsg = t("log.cannotProcessOllamaOffline")
        let startMsg = t("log.startingProcessing", undefined, { count: "1" })
        expect(app.uiStore.logs.some(l => l.message === warnMsg && l.type === "warning")).toBe(true)
        expect(app.uiStore.logs.some(l => l.message === startMsg && l.type === "info")).toBe(true)
        app.dispose()
    })
})
describe("AppStore custom model allowed", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("accepts a custom model not in the ollama model list", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.settingsStore.setModel("custom-model")
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        let warnMsg = t("log.modelNotAvailable", undefined, { model: "custom-model" })
        let startMsg = t("log.startingProcessing", undefined, { count: "1" })
        expect(app.uiStore.logs.some(l => l.message === warnMsg && l.type === "warning")).toBe(true)
        expect(app.uiStore.logs.some(l => l.message === startMsg && l.type === "info")).toBe(true)
        app.dispose()
    })
})
describe("AppStore staging clear", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [{ name: "llama2" }], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("clears staging after processing completes", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        app.toggleDemoMode()
        let clearStagingSpy = vi.spyOn(app.outputStore, 'clearStaging')
        app.fileStore.addFiles([createTestFile("a.txt", "This is a test file with enough text to produce a chunk. ".repeat(20))])
        await app.processFiles()
        expect(clearStagingSpy).toHaveBeenCalled()
        expect(app.outputStore.stagingData.length).toBe(0)
        app.dispose()
    })
})
describe("AppStore abort in finally", () => {
    beforeEach(() => {
        localStorage.clear()
        stubWindow({
            electronAPI: {
                getPlatform: vi.fn(async() => "windows"),
                checkOllama: vi.fn(async() => ({ running: true, models: [], version: "0.1.0" })),
                loadProgress: vi.fn(async() => ({ success: false })),
                loadCheckpoint: vi.fn(async() => ({ success: false })),
                writeLog: vi.fn()
            }
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })
    it("runs finally cleanup when processing fails", async() => {
        let app: AppStore = makeAppStore()
        await app.init()
        let abortSpy = vi.spyOn(app.processor, 'abort')
        app.settingsStore.setModel("some-model")
        // Empty file causes orchestrator to fail (noTextContent), so
        // runSucceeded stays false and the finally block calls processor.abort()
        app.fileStore.addFiles([createTestFile("empty.txt", "")])
        await app.processFiles()
        expect(app.isProcessing()).toBe(false)
        expect(app.uiStore.dashboardOpen()).toBe(false)
        expect(app.outputStore.stagingData.length).toBe(0)
        expect(abortSpy).toHaveBeenCalled()
        app.dispose()
    })
})
