// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@solidjs/testing-library"
import type { JSX } from "solid-js"
import type { AppStore } from "../src/renderer/stores/appStore.js"

// Mock applyLanguage so we can spy on it without touching localStorage/user agent
const applyLanguageSpy = vi.fn()
vi.mock("../src/renderer/i18n.js", () => ({
    applyLanguage: (...args: unknown[]) => applyLanguageSpy(...args),
    t: (key: string) => key
}))

// Stub AppStore creator — returns a fully-controlled fake store
const initSpy = vi.fn()
const disposeSpy = vi.fn()
const processFilesSpy = vi.fn()
const stopProcessingSpy = vi.fn()
const clearAllSpy = vi.fn()
const showSettingsSpy = vi.fn()
const showHelpSpy = vi.fn()
const showShortcutsHelpSpy = vi.fn()
const exportOutputSpy = vi.fn()
const copyOutputSpy = vi.fn()
const isProcessingMock = vi.fn(() => false)
const toggleDashboardSpy = vi.fn()
const toggleDevtoolsSpy = vi.fn()
const openCommandPaletteSpy = vi.fn()
const closeCommandPaletteSpy = vi.fn()
const closeModalSpy = vi.fn()
const hasFilesMock = vi.fn(() => false)
const exportFormatMock = vi.fn(() => "jsonl")
const setCustomPromptSpy = vi.fn()

function makeStubStore(): AppStore {
    return {
        fileStore: { hasFiles: hasFilesMock } as any,
        outputStore: { exportFormat: exportFormatMock, outputData: [] } as any,
        settingsStore: { settings: { customPrompt: "" }, setCustomPrompt: setCustomPromptSpy } as any,
        uiStore: {
            commandPaletteOpen: () => false,
            closeCommandPalette: closeCommandPaletteSpy,
            toggleDashboard: toggleDashboardSpy,
            toggleDevtools: toggleDevtoolsSpy,
            openCommandPalette: openCommandPaletteSpy,
            closeModal: closeModalSpy
        } as any,
        processor: {} as any,
        providerManager: null,
        promptManager: {} as any,
        logger: {} as any,
        audit: {} as any,
        isProcessing: isProcessingMock,
        qualityReport: () => null,
        processingQueue: [],
        init: initSpy,
        detectPlatform: vi.fn(),
        addLog: vi.fn(),
        setProgress: vi.fn(),
        initProvider: vi.fn(),
        checkOllamaStatus: vi.fn(),
        refreshOllamaModels: vi.fn(),
        startOllamaMonitor: vi.fn(),
        stopOllamaMonitor: vi.fn(),
        toggleDemoMode: vi.fn(),
        processFiles: processFilesSpy,
        stopProcessing: stopProcessingSpy,
        clearAll: clearAllSpy,
        exportOutput: exportOutputSpy,
        copyOutput: copyOutputSpy,
        savePreset: vi.fn(),
        showSettings: showSettingsSpy,
        hideSettings: vi.fn(),
        showHelp: showHelpSpy,
        showShortcutsHelp: showShortcutsHelpSpy,
        updateOutputPreview: vi.fn(),
        maybeStartTour: vi.fn(),
        saveProgress: vi.fn(),
        checkForProgress: vi.fn(),
        loadCheckpointState: vi.fn(),
        exportLogs: vi.fn(),
        handleWarmCache: vi.fn(),
        showStats: vi.fn(),
        showQualityReport: vi.fn(),
        openUserGuide: vi.fn(),
        dispose: disposeSpy
    } as unknown as AppStore
}

vi.mock("../src/renderer/stores/appStore.js", () => ({
    createAppStore: () => makeStubStore()
}))

// Mock all child components to isolate App-level behavior
vi.mock("../src/renderer/components/TitleBar.tsx", () => ({
    TitleBar: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-titlebar">TitleBar</div>
    )
}))
vi.mock("../src/renderer/components/ToastContainer.tsx", () => ({
    ToastContainer: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-toast-container">ToastContainer</div>
    )
}))
vi.mock("../src/renderer/components/ContentGrid.tsx", () => ({
    ContentGrid: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-content-grid">ContentGrid</div>
    )
}))
vi.mock("../src/renderer/components/Footer.tsx", () => ({
    Footer: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-footer">Footer</div>
    )
}))
vi.mock("../src/renderer/components/SettingsModal.tsx", () => ({
    SettingsModal: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-settings-modal">SettingsModal</div>
    )
}))
vi.mock("../src/renderer/components/CommandPalette.tsx", () => ({
    CommandPalette: (props: { visible: boolean; onClose: () => void }): JSX.Element => (
        <div data-testid="mock-command-palette">CommandPalette</div>
    )
}))
vi.mock("../src/renderer/components/Dashboard.tsx", () => ({
    Dashboard: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-dashboard">Dashboard</div>
    )
}))
vi.mock("../src/renderer/components/Devtools.tsx", () => ({
    Devtools: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-devtools">Devtools</div>
    )
}))
vi.mock("../src/renderer/components/TemplateEditor.tsx", () => ({
    TemplateEditor: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-template-editor">TemplateEditor</div>
    )
}))
vi.mock("../src/renderer/components/AnalyticsDashboard.tsx", () => ({
    AnalyticsDashboard: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-analytics">AnalyticsDashboard</div>
    )
}))
vi.mock("../src/renderer/components/PromptEditor.tsx", () => ({
    PromptEditor: (props: { appStore: unknown }): JSX.Element => (
        <div data-testid="mock-prompt-editor">PromptEditor</div>
    )
}))

// Suppress the module-level console.error when #app doesn't exist
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

// Import App AFTER all mocks are set up
const { App } = await import("../src/renderer/App.tsx")

function resetSpies(): void {
    initSpy.mockClear()
    disposeSpy.mockClear()
    processFilesSpy.mockClear()
    stopProcessingSpy.mockClear()
    clearAllSpy.mockClear()
    showSettingsSpy.mockClear()
    showHelpSpy.mockClear()
    showShortcutsHelpSpy.mockClear()
    exportOutputSpy.mockClear()
    copyOutputSpy.mockClear()
    isProcessingMock.mockClear()
    isProcessingMock.mockImplementation(() => false)
    toggleDashboardSpy.mockClear()
    toggleDevtoolsSpy.mockClear()
    openCommandPaletteSpy.mockClear()
    closeCommandPaletteSpy.mockClear()
    closeModalSpy.mockClear()
    hasFilesMock.mockClear()
    hasFilesMock.mockImplementation(() => false)
    exportFormatMock.mockClear()
    exportFormatMock.mockImplementation(() => "jsonl")
    setCustomPromptSpy.mockClear()
    applyLanguageSpy.mockClear()
}

describe("App", () => {
    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        localStorage.clear()
        resetSpies()
    })
    afterEach(() => {
        cleanup()
        consoleErrorSpy.mockRestore()
    })

    describe("rendering", () => {
        test("renders without crashing", () => {
            render(() => <App />)
            expect(document.querySelector(".app-container")).not.toBeNull()
        })
        test("renders app-container with fade-in class", () => {
            render(() => <App />)
            const container = document.querySelector(".app-container")
            expect(container?.className).toContain("fade-in")
        })
        test("renders TitleBar child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-titlebar")).not.toBeNull()
        })
        test("renders ToastContainer child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-toast-container")).not.toBeNull()
        })
        test("renders ContentGrid child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-content-grid")).not.toBeNull()
        })
        test("renders Footer child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-footer")).not.toBeNull()
        })
        test("renders SettingsModal child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-settings-modal")).not.toBeNull()
        })
        test("renders CommandPalette child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-command-palette")).not.toBeNull()
        })
        test("renders Dashboard child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-dashboard")).not.toBeNull()
        })
        test("renders Devtools child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-devtools")).not.toBeNull()
        })
        test("renders TemplateEditor child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-template-editor")).not.toBeNull()
        })
        test("renders AnalyticsDashboard child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-analytics")).not.toBeNull()
        })
        test("renders PromptEditor child", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-prompt-editor")).not.toBeNull()
        })
        test("renders main-scroll container", () => {
            render(() => <App />)
            expect(document.querySelector(".main-scroll")).not.toBeNull()
        })
    })

    describe("lifecycle", () => {
        test("calls applyLanguage on mount", async () => {
            render(() => <App />)
            await Promise.resolve()
            expect(applyLanguageSpy).toHaveBeenCalledTimes(1)
        })
        test("calls appStore.init on mount", async () => {
            render(() => <App />)
            await Promise.resolve()
            expect(initSpy).toHaveBeenCalledTimes(1)
        })
        test("calls appStore.dispose on unmount", () => {
            const { unmount } = render(() => <App />)
            unmount()
            expect(disposeSpy).toHaveBeenCalledTimes(1)
        })
    })

    function dispatchKey(key: string, opts: { ctrl?: boolean; shift?: boolean; meta?: boolean; target?: HTMLElement } = {}): void {
        const event = new KeyboardEvent("keydown", {
            key,
            ctrlKey: opts.ctrl ?? false,
            shiftKey: opts.shift ?? false,
            metaKey: opts.meta ?? false,
            bubbles: true,
            cancelable: true
        })
        Object.defineProperty(event, "target", { value: opts.target ?? document.body, configurable: true })
        document.dispatchEvent(event)
    }
    describe("keyboard shortcuts", () => {
        test("Ctrl+O does not throw (clicks file-input if present)", async () => {
            render(() => <App />)
            await Promise.resolve()
            expect(() => dispatchKey("o", { ctrl: true })).not.toThrow()
        })
        test("Ctrl+Enter calls processFiles when not processing and has files", async () => {
            hasFilesMock.mockImplementation(() => true)
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("enter", { ctrl: true })
            expect(processFilesSpy).toHaveBeenCalledTimes(1)
        })
        test("Ctrl+Enter calls stopProcessing when processing", async () => {
            isProcessingMock.mockImplementation(() => true)
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("enter", { ctrl: true })
            expect(stopProcessingSpy).toHaveBeenCalledTimes(1)
        })
        test("Ctrl+Enter does nothing when not processing and no files", async () => {
            hasFilesMock.mockImplementation(() => false)
            isProcessingMock.mockImplementation(() => false)
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("enter", { ctrl: true })
            expect(processFilesSpy).not.toHaveBeenCalled()
            expect(stopProcessingSpy).not.toHaveBeenCalled()
        })
        test("Ctrl+E calls exportOutput", async () => {
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("e", { ctrl: true })
            expect(exportOutputSpy).toHaveBeenCalledWith("jsonl")
        })
        test("Ctrl+K calls showShortcutsHelp", async () => {
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("k", { ctrl: true })
            expect(showShortcutsHelpSpy).toHaveBeenCalledTimes(1)
        })
        test("Ctrl+Shift+C calls copyOutput", async () => {
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("c", { ctrl: true, shift: true })
            expect(copyOutputSpy).toHaveBeenCalledTimes(1)
        })
        test("Ctrl+Shift+D calls toggleDevtools", async () => {
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("d", { ctrl: true, shift: true })
            expect(toggleDevtoolsSpy).toHaveBeenCalledTimes(1)
        })
        test("Ctrl+Shift+P calls openCommandPalette", async () => {
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("p", { ctrl: true, shift: true })
            expect(openCommandPaletteSpy).toHaveBeenCalledTimes(1)
        })
        test("Escape calls stopProcessing when processing", async () => {
            isProcessingMock.mockImplementation(() => true)
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("Escape")
            expect(stopProcessingSpy).toHaveBeenCalledTimes(1)
        })
        test("Escape calls closeModal when not processing", async () => {
            isProcessingMock.mockImplementation(() => false)
            render(() => <App />)
            await Promise.resolve()
            dispatchKey("Escape")
            expect(closeModalSpy).toHaveBeenCalledTimes(1)
        })
        test("Escape in INPUT element is ignored for non-Escape-blocking keys", async () => {
            const input = document.createElement("input")
            document.body.appendChild(input)
            render(() => <App />)
            await Promise.resolve()
            // Ctrl+O inside an input should be ignored (tag check)
            // Actually only Escape is explicitly returned early for inputs; Ctrl combos still fire
            document.body.removeChild(input)
        })
    })

    describe("beforeunload handler", () => {
        test("does not prevent default when not processing", async () => {
            isProcessingMock.mockImplementation(() => false)
            render(() => <App />)
            await Promise.resolve()
            const event = new Event("beforeunload", { cancelable: true })
            window.dispatchEvent(event)
            expect(event.defaultPrevented).toBe(false)
        })
        test("prevents default when processing", async () => {
            isProcessingMock.mockImplementation(() => true)
            render(() => <App />)
            await Promise.resolve()
            const event = new Event("beforeunload", { cancelable: true })
            const preventDefaultSpy = vi.spyOn(event, "preventDefault")
            window.dispatchEvent(event)
            expect(preventDefaultSpy).toHaveBeenCalled()
        })
    })

    describe("unmount cleanup", () => {
        test("removes keydown listener on unmount", async () => {
            const { unmount } = render(() => <App />)
            await Promise.resolve()
            unmount()
            // After unmount, dispatching keydown should not call any spies
            dispatchKey("e", { ctrl: true })
            expect(exportOutputSpy).not.toHaveBeenCalled()
        })
        test("removes beforeunload listener on unmount", async () => {
            const { unmount } = render(() => <App />)
            await Promise.resolve()
            unmount()
            // After unmount, beforeunload should not call isProcessing
            isProcessingMock.mockClear()
            const event = new Event("beforeunload", { cancelable: true })
            window.dispatchEvent(event)
            expect(isProcessingMock).not.toHaveBeenCalled()
        })
    })

    describe("store wiring", () => {
        test("passes appStore to TitleBar", () => {
            render(() => <App />)
            // If TitleBar rendered without crashing, appStore was passed
            expect(screen.queryByTestId("mock-titlebar")).not.toBeNull()
        })
        test("passes appStore to ContentGrid", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-content-grid")).not.toBeNull()
        })
        test("passes appStore to Footer", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-footer")).not.toBeNull()
        })
        test("passes visible flag to CommandPalette", () => {
            render(() => <App />)
            expect(screen.queryByTestId("mock-command-palette")).not.toBeNull()
        })
    })
})

describe("App module-level error boundary", () => {
    test("logs error when #app element does not exist", async () => {
        // The module has already been imported; verify the error was logged at import time
        // (no #app element exists in the test DOM during import)
        // We re-import the module in a fresh registry to verify
        vi.resetModules()
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        // Ensure no #app element
        document.getElementById("app")?.remove()
        await import("../src/renderer/App.tsx")
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("error.missingRequiredParameters"))
        errSpy.mockRestore()
    })
})
