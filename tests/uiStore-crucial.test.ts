// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createUIStore, type UIStore } from "../src/renderer/stores/uiStore.js"
import { withRoot } from "./setup.js"
let store: UIStore
let dispose: () => void
let timeouts: Array<{ id: number; fn: () => void; ms: number }>
let intervals: Array<{ id: number; fn: () => void; ms: number }>
let nextTimerId: number
function stubTimers(): void {
    timeouts = []
    intervals = []
    nextTimerId = 1
    let setTimeoutFn = vi.fn((fn: () => void, ms?: number) => {
        let id = nextTimerId++
        timeouts.push({ id, fn, ms: ms ?? 0 })
        return id
    })
    let clearTimeoutFn = vi.fn((id: number) => {
        timeouts = timeouts.filter(t => t.id !== id)
    })
    let setIntervalFn = vi.fn((fn: () => void, ms?: number) => {
        let id = nextTimerId++
        intervals.push({ id, fn, ms: ms ?? 0 })
        return id
    })
    let clearIntervalFn = vi.fn((id: number) => {
        intervals = intervals.filter(i => i.id !== id)
    })
    vi.stubGlobal("setTimeout", setTimeoutFn)
    vi.stubGlobal("clearTimeout", clearTimeoutFn)
    vi.stubGlobal("setInterval", setIntervalFn)
    vi.stubGlobal("clearInterval", clearIntervalFn)
    vi.stubGlobal("window", {
        ...window,
        setTimeout: setTimeoutFn,
        clearTimeout: clearTimeoutFn,
        setInterval: setIntervalFn,
        clearInterval: clearIntervalFn
    })
}
function fireTimeout(id: number): void {
    let t = timeouts.find(x => x.id === id)
    if (t) t.fn()
}
beforeEach(() => {
    vi.useFakeTimers()
    stubTimers()
    store = withRoot((d) => {
        dispose = d
        return createUIStore()
    })
})
afterEach(() => {
    dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})
describe("UIStore progress", () => {
    it("starts at zero", () => {
        expect(store.progressPercent()).toBe(0)
        expect(store.progressText().length).toBeGreaterThan(0)
    })
    it("sets progress", () => {
        store.setProgress(50, "half")
        expect(store.progressPercent()).toBe(50)
        expect(store.progressText()).toBe("half")
    })
    it("clamps progress below zero", () => {
        store.setProgress(-10, "low")
        expect(store.progressPercent()).toBe(0)
    })
    it("clamps progress above 100", () => {
        store.setProgress(150, "high")
        expect(store.progressPercent()).toBe(100)
    })
    it("treats NaN as zero", () => {
        store.setProgress(NaN, "bad")
        expect(store.progressPercent()).toBe(0)
    })
    it("treats Infinity as zero", () => {
        store.setProgress(Infinity, "bad")
        expect(store.progressPercent()).toBe(0)
    })
})
describe("UIStore logs", () => {
    it("starts empty", () => {
        expect(store.logs.length).toBe(0)
    })
    it("adds info log", () => {
        store.addLog("hello")
        expect(store.logs.length).toBe(1)
        expect(store.logs[0].message).toBe("hello")
        expect(store.logs[0].type).toBe("info")
    })
    it("adds typed log", () => {
        store.addLog("err", "error")
        expect(store.logs[0].type).toBe("error")
    })
    it("assigns incrementing ids", () => {
        store.addLog("a")
        store.addLog("b")
        expect(store.logs[1].id).toBeGreaterThan(store.logs[0].id)
    })
    it("assigns timestamps", () => {
        store.addLog("a")
        expect(store.logs[0].timestamp).toBeGreaterThan(0)
    })
    it("sanitizes control characters", () => {
        store.addLog("hello\x00world")
        expect(store.logs[0].message).not.toContain("\x00")
    })
    it("sanitizes null input", () => {
        store.addLog(null as unknown as string)
        expect(store.logs[0].message).toBe("")
    })
    it("clears logs", () => {
        store.addLog("a")
        store.addLog("b")
        store.clearLogs()
        expect(store.logs.length).toBe(0)
    })
    it("caps log count at 50", () => {
        for (let i = 0; i < 55; i++) {
            store.addLog(`msg ${i}`)
        }
        expect(store.logs.length).toBe(50)
        expect(store.logs[0].message).toBe("msg 5")
    })
})
describe("UIStore toasts", () => {
    it("starts empty", () => {
        expect(store.toasts.length).toBe(0)
    })
    it("shows toast", () => {
        store.showToast("hello", "success")
        expect(store.toasts.length).toBe(1)
        expect(store.toasts[0].message).toBe("hello")
        expect(store.toasts[0].type).toBe("success")
    })
    it("defaults toast type to info", () => {
        store.showToast("hello")
        expect(store.toasts[0].type).toBe("info")
    })
    it("dismisses toast by id", () => {
        store.showToast("a")
        let id = store.toasts[0].id
        store.dismissToast(id)
        expect(store.toasts.length).toBe(0)
    })
    it("auto dismisses toast after duration", () => {
        store.showToast("a", "info", 100)
        expect(timeouts.length).toBe(1)
        fireTimeout(timeouts[0].id)
        expect(store.toasts.length).toBe(0)
    })
    it("uses default duration", () => {
        store.showToast("a")
        expect(timeouts[0].ms).toBe(4000)
    })
    it("assigns incrementing toast ids", () => {
        store.showToast("a")
        store.showToast("b")
        expect(store.toasts[1].id).toBeGreaterThan(store.toasts[0].id)
    })
})
describe("UIStore modals", () => {
    it("starts closed", () => {
        expect(store.modalOpen()).toBeNull()
        expect(store.settingsOpen()).toBe(false)
        expect(store.helpOpen()).toBe(false)
        expect(store.shortcutsOpen()).toBe(false)
    })
    it("opens settings modal", () => {
        store.openModal("settings")
        expect(store.modalOpen()).toBe("settings")
        expect(store.settingsOpen()).toBe(true)
    })
    it("opens help modal", () => {
        store.openModal("help")
        expect(store.helpOpen()).toBe(true)
    })
    it("opens shortcuts modal", () => {
        store.openModal("shortcuts")
        expect(store.shortcutsOpen()).toBe(true)
    })
    it("opens stats modal", () => {
        store.openModal("stats")
        expect(store.statsOpen()).toBe(true)
    })
    it("opens quality modal", () => {
        store.openModal("quality")
        expect(store.qualityOpen()).toBe(true)
    })
    it("closes modal", () => {
        store.openModal("settings")
        store.closeModal()
        expect(store.modalOpen()).toBeNull()
        expect(store.settingsOpen()).toBe(false)
    })
    it("template editor opens and closes", () => {
        store.openTemplateEditor()
        expect(store.templateOpen()).toBe(true)
        store.closeTemplateEditor()
        expect(store.templateOpen()).toBe(false)
    })
    it("prompt editor opens and closes", () => {
        store.openPromptEditor()
        expect(store.promptOpen()).toBe(true)
        store.closePromptEditor()
        expect(store.promptOpen()).toBe(false)
    })
    it("analytics opens and closes", () => {
        store.openAnalytics()
        expect(store.analyticsOpen()).toBe(true)
        store.closeAnalytics()
        expect(store.analyticsOpen()).toBe(false)
    })
    it("close analytics does nothing when other modal open", () => {
        store.openModal("settings")
        store.closeAnalytics()
        expect(store.modalOpen()).toBe("settings")
    })
})
describe("UIStore command palette", () => {
    it("starts closed", () => {
        expect(store.commandPaletteOpen()).toBe(false)
    })
    it("opens command palette", () => {
        store.openCommandPalette()
        expect(store.commandPaletteOpen()).toBe(true)
    })
    it("closes command palette", () => {
        store.openCommandPalette()
        store.closeCommandPalette()
        expect(store.commandPaletteOpen()).toBe(false)
    })
})
describe("UIStore ollama status", () => {
    it("starts offline", () => {
        expect(store.ollamaStatus().running).toBe(false)
        expect(store.ollamaStatus().models.length).toBe(0)
    })
    it("sets ollama status", () => {
        store.setOllamaStatus({ running: true, models: [{ name: "llama2" }], version: "1.0" })
        expect(store.ollamaStatus().running).toBe(true)
        expect(store.ollamaStatus().models[0].name).toBe("llama2")
    })
    it("sets ollama loading", () => {
        store.setOllamaLoading(true)
        expect(store.ollamaLoading()).toBe(true)
    })
})
describe("UIStore dashboard", () => {
    it("starts closed", () => {
        expect(store.dashboardOpen()).toBe(false)
    })
    it("starts dashboard", () => {
        store.startDashboard()
        expect(store.dashboardOpen()).toBe(true)
        expect(intervals.length).toBe(1)
    })
    it("stops dashboard", () => {
        store.startDashboard()
        store.stopDashboard()
        expect(store.dashboardOpen()).toBe(false)
    })
    it("sets dashboard open", () => {
        store.setDashboardOpen(true)
        expect(store.dashboardOpen()).toBe(true)
    })
    it("toggles dashboard", () => {
        store.toggleDashboard()
        expect(store.dashboardOpen()).toBe(true)
        store.toggleDashboard()
        expect(store.dashboardOpen()).toBe(false)
    })
    it("sets dashboard metrics", () => {
        store.setDashboardMetrics({ chunksDone: 5, totalTokens: 100 })
        expect(store.dashboardMetrics().chunksDone).toBe(5)
        expect(store.dashboardMetrics().totalTokens).toBe(100)
    })
    it("resets metrics on start", () => {
        store.setDashboardMetrics({ chunksDone: 99 })
        store.startDashboard()
        expect(store.dashboardMetrics().chunksDone).toBe(0)
    })
    it("tick updates elapsed", () => {
        store.startDashboard()
        store.tickDashboard()
        expect(store.dashboardMetrics().elapsed).not.toBe("--")
    })
    it("tick calculates chunks per second", () => {
        store.startDashboard()
        store.setDashboardMetrics({ chunksDone: 10 })
        vi.advanceTimersByTime(1000)
        store.tickDashboard()
        expect(store.dashboardMetrics().chunksPerSecond).toBeGreaterThan(0)
    })
    it("tick calculates eta", () => {
        store.startDashboard()
        store.setDashboardMetrics({ chunksDone: 5, chunksTotal: 10 })
        vi.advanceTimersByTime(1000)
        store.tickDashboard()
        expect(store.dashboardMetrics().eta).not.toBe("--")
    })
    it("tick skips when dashboard closed", () => {
        store.setDashboardMetrics({ chunksDone: 5 })
        store.tickDashboard()
        expect(store.dashboardMetrics().chunksPerSecond).toBe(0)
    })
    it("formats ms duration", () => {
        store.startDashboard()
        vi.advanceTimersByTime(500)
        store.tickDashboard()
        expect(store.dashboardMetrics().elapsed).toContain("ms")
    })
    it("formats seconds duration", () => {
        store.startDashboard()
        vi.advanceTimersByTime(5000)
        store.tickDashboard()
        expect(store.dashboardMetrics().elapsed).toMatch(/\d+s/)
    })
    it("formats minutes duration", () => {
        store.startDashboard()
        vi.advanceTimersByTime(70000)
        store.tickDashboard()
        expect(store.dashboardMetrics().elapsed).toMatch(/\d+m/)
    })
})
describe("UIStore devtools", () => {
    it("starts closed", () => {
        expect(store.devtoolsOpen()).toBe(false)
    })
    it("sets devtools open", () => {
        store.setDevtoolsOpen(true)
        expect(store.devtoolsOpen()).toBe(true)
    })
    it("toggles devtools", () => {
        store.toggleDevtools()
        expect(store.devtoolsOpen()).toBe(true)
        store.toggleDevtools()
        expect(store.devtoolsOpen()).toBe(false)
    })
})
describe("UIStore output preview", () => {
    it("starts empty", () => {
        expect(store.outputPreview()).toBe("")
        expect(store.outputPreviewLoading()).toBe(false)
    })
    it("sets output preview", () => {
        store.setOutputPreview("preview text", true)
        expect(store.outputPreview()).toBe("preview text")
        expect(store.outputPreviewLoading()).toBe(true)
    })
    it("clears output preview", () => {
        store.setOutputPreview("text")
        store.clearOutputPreview()
        expect(store.outputPreview()).toBe("")
        expect(store.outputPreviewLoading()).toBe(false)
    })
    it("debounces output preview", () => {
        store.updateOutputPreviewDebounced("delayed")
        expect(timeouts.length).toBe(1)
        expect(store.outputPreview()).toBe("")
        fireTimeout(timeouts[0].id)
        expect(store.outputPreview()).toBe("delayed")
    })
    it("cancels previous debounce", () => {
        store.updateOutputPreviewDebounced("first")
        let firstId = timeouts[0].id
        store.updateOutputPreviewDebounced("second")
        expect(timeouts.find(t => t.id === firstId)).toBeUndefined()
        fireTimeout(timeouts[0].id)
        expect(store.outputPreview()).toBe("second")
    })
})
describe("UIStore processing stats", () => {
    it("sets files processed", () => {
        store.setFilesProcessed(42)
        expect(store.filesProcessed()).toBe(42)
    })
    it("sets last processed", () => {
        store.setLastProcessed("just now")
        expect(store.lastProcessed()).toBe("just now")
    })
})
describe("UIStore log icons", () => {
    it("returns info icon", () => {
        expect(store.getLogIcon("info")).toBe("fa-info-circle")
    })
    it("returns success icon", () => {
        expect(store.getLogIcon("success")).toBe("fa-check-circle")
    })
    it("returns warning icon", () => {
        expect(store.getLogIcon("warning")).toBe("fa-exclamation-triangle")
    })
    it("returns error icon", () => {
        expect(store.getLogIcon("error")).toBe("fa-times-circle")
    })
    it("defaults unknown type to info", () => {
        expect(store.getLogIcon("unknown" as any)).toBe("fa-info-circle")
    })
})
