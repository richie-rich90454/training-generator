import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { Footer } from "../src/renderer/components/Footer.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"

function makeAppStore(): AppStore {
    return {
        fileStore: {} as any,
        outputStore: {} as any,
        settingsStore: {} as any,
        uiStore: {} as any,
        processor: {} as any,
        providerManager: null,
        promptManager: {} as any,
        logger: {} as any,
        audit: {} as any,
        isProcessing: () => false,
        qualityReport: () => null,
        processingQueue: [],
        init: vi.fn(),
        detectPlatform: vi.fn(),
        addLog: vi.fn(),
        setProgress: vi.fn(),
        initProvider: vi.fn(),
        checkOllamaStatus: vi.fn(),
        refreshOllamaModels: vi.fn(),
        startOllamaMonitor: vi.fn(),
        stopOllamaMonitor: vi.fn(),
        toggleDemoMode: vi.fn(),
        processFiles: vi.fn(),
        stopProcessing: vi.fn(),
        clearAll: vi.fn(),
        exportOutput: vi.fn(),
        copyOutput: vi.fn(),
        savePreset: vi.fn(),
        showSettings: vi.fn(),
        hideSettings: vi.fn(),
        showHelp: vi.fn(),
        showShortcutsHelp: vi.fn(),
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
        dispose: vi.fn()
    } as unknown as AppStore
}

describe("Footer", () => {
    let openSpy: ReturnType<typeof vi.fn>
    beforeEach(() => {
        openSpy = vi.fn()
        vi.stubGlobal("open", openSpy)
    })
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })
    test("renders without crashing", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        expect(screen.queryByRole("contentinfo")).not.toBeNull()
    })
    test("renders version status text", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        expect(screen.getByText("Training Generator")).not.toBeNull()
    })
    test("renders documentation link", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const docLink = screen.getByText("Documentation")
        expect(docLink).not.toBeNull()
        expect(docLink.closest("a")?.getAttribute("href")).toContain("github.com")
    })
    test("renders report issue link", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const reportLink = screen.getByText("Report Issue")
        expect(reportLink).not.toBeNull()
        expect(reportLink.closest("a")?.getAttribute("href")).toContain("issues")
    })
    test("renders star on github link", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const starLink = screen.getByText("Star on GitHub")
        expect(starLink).not.toBeNull()
        expect(starLink.closest("a")?.getAttribute("href")).toContain("github.com")
    })
    test("clicking documentation link calls window.open", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const docLink = screen.getByText("Documentation").closest("a") as HTMLAnchorElement
        fireEvent.click(docLink)
        expect(openSpy).toHaveBeenCalledTimes(1)
        expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("github.com"), "_blank")
    })
    test("clicking report issue link calls window.open with issues URL", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const reportLink = screen.getByText("Report Issue").closest("a") as HTMLAnchorElement
        fireEvent.click(reportLink)
        expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("/issues"), "_blank")
    })
    test("clicking star link calls window.open with repo URL", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const starLink = screen.getByText("Star on GitHub").closest("a") as HTMLAnchorElement
        fireEvent.click(starLink)
        expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("richie-rich90454/training-generator"), "_blank")
    })
    test("renders all three footer links", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const links = screen.queryAllByRole("link")
        expect(links.length).toBe(3)
    })
    test("renders svg icon inside each link", () => {
        render(() => <Footer appStore={makeAppStore()} />)
        const links = screen.queryAllByRole("link")
        for (const link of links) {
            const svg = link.querySelector("svg")
            expect(svg).not.toBeNull()
        }
    })
    test("unmounts without errors", () => {
        const { unmount } = render(() => <Footer appStore={makeAppStore()} />)
        expect(() => unmount()).not.toThrow()
    })
})
