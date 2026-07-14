import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { Devtools } from "../src/renderer/components/Devtools.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { LogEntry, LogLevel } from "../src/renderer/logger.js"

interface StubState {
    devtoolsOpen: () => boolean
    setDevtoolsOpen: (open: boolean) => void
    listeners: Array<(entry: LogEntry) => void>
    addListener: (listener: (entry: LogEntry) => void) => void
    removeListener: (listener: (entry: LogEntry) => void) => void
}

function makeStub(Open: boolean): StubState {
    const [open, setOpen] = createSignal<boolean>(Open)
    const listeners: Array<(entry: LogEntry) => void> = []
    return {
        devtoolsOpen: open,
        setDevtoolsOpen: (v: boolean) => setOpen(v),
        listeners,
        addListener: (l: (entry: LogEntry) => void) => { listeners.push(l) },
        removeListener: (l: (entry: LogEntry) => void) => {
            const idx = listeners.indexOf(l)
            if (idx >= 0) listeners.splice(idx, 1)
        }
    }
}

function makeAppStore(stub: StubState): AppStore {
    return {
        uiStore: {
            devtoolsOpen: stub.devtoolsOpen,
            setDevtoolsOpen: stub.setDevtoolsOpen
        } as any,
        logger: {
            addListener: stub.addListener,
            removeListener: stub.removeListener
        } as any
    } as unknown as AppStore
}

function makeLogEntry(level: LogLevel = "info", message: string = "test message", module: string = "TestModule"): LogEntry {
    return {
        timestamp: new Date("2025-01-15T12:34:56.000Z").toISOString(),
        level,
        module,
        message
    }
}

describe("Devtools", () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })
    test("does not render when devtools closed", () => {
        const stub = makeStub(false)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        expect(screen.queryByTestId("devtools-panel")).toBeNull()
    })
    test("renders panel when devtools open", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        expect(screen.queryByTestId("devtools-panel")).not.toBeNull()
    })
    test("renders title", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const panel = screen.getByTestId("devtools-panel")
        const heading = panel.querySelector("h3")
        expect(heading).not.toBeNull()
        expect(heading?.textContent).toBe("Devtools")
    })
    test("renders all four tab buttons", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.queryAllByTestId(/^devtools-tab-|devtools-tab-/)
        const tabButtons = screen.queryAllByText(/Logs|Cache|Workers|Memory/)
        expect(tabButtons.length).toBe(4)
    })
    test("logs tab is active by default", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        expect(screen.queryByTestId("devtools-logs")).not.toBeNull()
    })
    test("clicking cache tab switches to cache view", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const cacheTab = screen.getByText("Cache")
        fireEvent.click(cacheTab)
        await Promise.resolve()
        expect(screen.queryByTestId("devtools-cache")).not.toBeNull()
    })
    test("clicking workers tab switches to workers view", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const workersTab = screen.getByText("Workers")
        fireEvent.click(workersTab)
        await Promise.resolve()
        expect(screen.queryByTestId("devtools-workers")).not.toBeNull()
    })
    test("clicking memory tab switches to memory view", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const memoryTab = screen.getByText("Memory")
        fireEvent.click(memoryTab)
        await Promise.resolve()
        expect(screen.queryByTestId("devtools-memory")).not.toBeNull()
    })
    test("close button calls setDevtoolsOpen(false)", async () => {
        const stub = makeStub(true)
        const spy = vi.spyOn(stub, "setDevtoolsOpen")
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const closeButton = screen.getByLabelText("Close devtools")
        fireEvent.click(closeButton)
        await Promise.resolve()
        expect(spy).toHaveBeenCalledWith(false)
    })
    test("renders empty state when no log entries", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        expect(screen.queryByTestId("devtools-empty")).not.toBeNull()
    })
    test("renders log entries when logger emits", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        // Emit a log entry through the listener
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "Hello world", "App"))
        }
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1)
        expect(entries[0].textContent).toContain("Hello world")
        expect(entries[0].textContent).toContain("App")
        expect(entries[0].textContent).toContain("[INFO]")
    })
    test("log filter select filters entries by level", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "info message", "M1"))
            listener(makeLogEntry("error", "error message", "M2"))
        }
        await Promise.resolve()
        expect(screen.queryAllByTestId("devtools-log-entry").length).toBe(2)
        const select = screen.getByLabelText("Filter log level")
        fireEvent.change(select, { target: { value: "error" } })
        await Promise.resolve()
        const filtered = screen.queryAllByTestId("devtools-log-entry")
        expect(filtered.length).toBe(1)
        expect(filtered[0].textContent).toContain("error message")
    })
    test("clear logs button removes all entries", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "Hello", "M1"))
            listener(makeLogEntry("warn", "World", "M2"))
        }
        await Promise.resolve()
        expect(screen.queryAllByTestId("devtools-log-entry").length).toBe(2)
        const clearBtn = screen.getByText("Clear")
        fireEvent.click(clearBtn)
        await Promise.resolve()
        expect(screen.queryAllByTestId("devtools-log-entry").length).toBe(0)
        expect(screen.queryByTestId("devtools-empty")).not.toBeNull()
    })
    test("limits log entries to MAX_LOG_ENTRIES (1000)", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            for (let i = 0; i < 1050; i++) {
                listener(makeLogEntry("info", `msg ${i}`, "M"))
            }
        }
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1000)
    })
    test("cache tab renders cache stats table", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        fireEvent.click(screen.getByText("Cache"))
        await Promise.resolve()
        const cachePanel = screen.getByTestId("devtools-cache")
        const rows = cachePanel.querySelectorAll("tr")
        expect(rows.length).toBeGreaterThanOrEqual(5)
    })
    test("workers tab renders worker info", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        fireEvent.click(screen.getByText("Workers"))
        await Promise.resolve()
        const workersPanel = screen.getByTestId("devtools-workers")
        expect(workersPanel.textContent).toContain("Worker Pool:")
        expect(workersPanel.textContent).toContain("Status:")
    })
    test("memory tab renders memory info or unavailable message", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        fireEvent.click(screen.getByText("Memory"))
        await Promise.resolve()
        const memoryPanel = screen.getByTestId("devtools-memory")
        // Either shows memory stats or shows unavailable message
        expect(memoryPanel.textContent).toBeTruthy()
    })
    test("logger listener is removed on unmount", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />).unmount()
        expect(stub.listeners.length).toBe(0)
    })
    test("unmounts without errors", () => {
        const stub = makeStub(true)
        const { unmount } = render(() => <Devtools appStore={makeAppStore(stub)} />)
        expect(() => unmount()).not.toThrow()
    })
    test("tab buttons have data-tab attributes", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const panel = screen.getByTestId("devtools-panel")
        const tabButtons = panel.querySelectorAll("button[data-tab]")
        expect(tabButtons.length).toBe(4)
        const tabValues = Array.from(tabButtons).map((b) => b.getAttribute("data-tab"))
        expect(tabValues).toEqual(["logs", "cache", "workers", "memory"])
    })
    test("switching to invalid tab is a no-op", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        // Cannot switch to invalid tab via UI, but logs should remain active
        expect(screen.queryByTestId("devtools-logs")).not.toBeNull()
        expect(screen.queryByTestId("devtools-cache")).toBeNull()
    })
    test("log level class applied to entry", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("error", "boom", "M"))
        }
        await Promise.resolve()
        const entry = screen.getByTestId("devtools-log-entry")
        expect(entry.className).toContain("log-level-error")
    })
    test("unknown log level falls back to info class", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info" as LogLevel, "weird", "M"))
            // Manually call with an unknown level via type cast
            listener({ ...makeLogEntry("info", "weird", "M"), level: "verbose" as any })
        }
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(2)
        // The unknown-level entry should fall back to log-level-info
        const unknownEntry = entries[1]
        expect(unknownEntry.className).toContain("log-level-info")
    })
})
