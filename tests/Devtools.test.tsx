import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { Devtools } from "../src/renderer/components/Devtools.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { LogEntry, LogLevel } from "../src/renderer/logger.js"
import { t } from "../src/renderer/i18n.js"

interface StubState {
    devtoolsOpen: () => boolean
    setDevtoolsOpen: (open: boolean) => void
    showToast: ReturnType<typeof vi.fn>
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
        showToast: vi.fn(),
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
            setDevtoolsOpen: stub.setDevtoolsOpen,
            showToast: stub.showToast,
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

describe("Devtools a11y", () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })
    test("dialog has aria-modal=true and aria-labelledby pointing to title", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const dialog = screen.getByRole("dialog")
        expect(dialog.getAttribute("aria-modal")).toBe("true")
        const labelledBy = dialog.getAttribute("aria-labelledby")
        expect(labelledBy).toBe("devtools-title")
        const title = document.getElementById("devtools-title")
        expect(title).not.toBeNull()
        expect(title?.tagName).toBe("H3")
    })
    test("tablist has role=tablist and each tab has role=tab with aria-selected", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tablist = screen.getByRole("tablist")
        expect(tablist).not.toBeNull()
        const tabs = screen.getAllByRole("tab")
        expect(tabs.length).toBe(4)
        const selected = tabs.filter((t) => t.getAttribute("aria-selected") === "true")
        expect(selected.length).toBe(1)
        expect(selected[0].getAttribute("data-tab")).toBe("logs")
    })
    test("non-active tabs have tabindex=-1 and active tab has tabindex=0", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.getAllByRole("tab")
        const logsTab = tabs.find((t) => t.getAttribute("data-tab") === "logs") as HTMLButtonElement
        const cacheTab = tabs.find((t) => t.getAttribute("data-tab") === "cache") as HTMLButtonElement
        expect(logsTab.tabIndex).toBe(0)
        expect(cacheTab.tabIndex).toBe(-1)
    })
    test("active tab has aria-controls pointing to its tabpanel id", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.getAllByRole("tab")
        // Only the active tabpanel is rendered (others are conditionally mounted
        // via <Show>), so we verify the relationship for the active tab.
        const activeTab = tabs.find((t) => t.getAttribute("aria-selected") === "true") as HTMLButtonElement
        const controls = activeTab.getAttribute("aria-controls")
        expect(controls).toMatch(/^devtools-panel-/)
        const panel = document.getElementById(controls as string)
        expect(panel).not.toBeNull()
        expect(panel?.getAttribute("role")).toBe("tabpanel")
        expect(panel?.getAttribute("aria-labelledby")).toBe(activeTab.id)
    })
    test("ArrowRight moves active tab to the right and focuses it", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.getAllByRole("tab")
        const logsTab = tabs.find((t) => t.getAttribute("data-tab") === "logs") as HTMLButtonElement
        logsTab.focus()
        fireEvent.keyDown(logsTab, { key: "ArrowRight" })
        await Promise.resolve()
        const cacheTab = tabs.find((t) => t.getAttribute("data-tab") === "cache") as HTMLButtonElement
        expect(cacheTab.getAttribute("aria-selected")).toBe("true")
        expect(document.activeElement).toBe(cacheTab)
    })
    test("ArrowLeft wraps from first tab to last tab", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.getAllByRole("tab")
        const logsTab = tabs.find((t) => t.getAttribute("data-tab") === "logs") as HTMLButtonElement
        logsTab.focus()
        fireEvent.keyDown(logsTab, { key: "ArrowLeft" })
        await Promise.resolve()
        const memoryTab = tabs.find((t) => t.getAttribute("data-tab") === "memory") as HTMLButtonElement
        expect(memoryTab.getAttribute("aria-selected")).toBe("true")
        expect(document.activeElement).toBe(memoryTab)
    })
    test("Home and End move to first and last tab", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const tabs = screen.getAllByRole("tab")
        const logsTab = tabs.find((t) => t.getAttribute("data-tab") === "logs") as HTMLButtonElement
        fireEvent.keyDown(logsTab, { key: "End" })
        await Promise.resolve()
        const memoryTab = tabs.find((t) => t.getAttribute("data-tab") === "memory") as HTMLButtonElement
        expect(memoryTab.getAttribute("aria-selected")).toBe("true")
        fireEvent.keyDown(memoryTab, { key: "Home" })
        await Promise.resolve()
        const logsTabAfter = tabs.find((t) => t.getAttribute("data-tab") === "logs") as HTMLButtonElement
        expect(logsTabAfter.getAttribute("aria-selected")).toBe("true")
    })
    test("data-i18n attributes are present on title, tab labels, and clear button", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const title = document.getElementById("devtools-title")
        expect(title?.getAttribute("data-i18n")).toBe("devtools.title")
        const clearBtn = document.getElementById("devtools-clear-logs")
        expect(clearBtn?.getAttribute("data-i18n")).toBe("devtools.clearLogs")
        const tabs = screen.getAllByRole("tab")
        const logsSpan = tabs[0].querySelector("[data-i18n]")
        expect(logsSpan?.getAttribute("data-i18n")).toBe("devtools.tab.logs")
    })
    test("data-i18n-aria-label present on close button", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const closeBtn = screen.getByLabelText(t("devtools.closeAria"))
        expect(closeBtn.getAttribute("data-i18n-aria-label")).toBe("devtools.closeAria")
    })
})

describe("Devtools focus and scroll lock", () => {
    afterEach(() => {
        cleanup()
        document.body.style.overflow = ""
        vi.restoreAllMocks()
    })
    test("opening devtools locks body scroll", () => {
        const stub = makeStub(false)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        document.body.style.overflow = ""
        stub.setDevtoolsOpen(true)
        expect(document.body.style.overflow).toBe("hidden")
    })
    test("closing devtools restores body scroll", () => {
        const stub = makeStub(false)
        document.body.style.overflow = "auto"
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        stub.setDevtoolsOpen(true)
        expect(document.body.style.overflow).toBe("hidden")
        stub.setDevtoolsOpen(false)
        expect(document.body.style.overflow).toBe("auto")
    })
    test("focus moves into panel on open", () => {
        const stub = makeStub(false)
        const trigger = document.createElement("button")
        document.body.appendChild(trigger)
        trigger.focus()
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        stub.setDevtoolsOpen(true)
        expect(document.activeElement).not.toBe(trigger)
        document.body.removeChild(trigger)
    })
    test("focus restores to trigger on close", () => {
        const stub = makeStub(false)
        const trigger = document.createElement("button")
        document.body.appendChild(trigger)
        trigger.focus()
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        stub.setDevtoolsOpen(true)
        stub.setDevtoolsOpen(false)
        expect(document.activeElement).toBe(trigger)
        document.body.removeChild(trigger)
    })
    test("Tab on last focusable wraps to first", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const panel = screen.getByTestId("devtools-panel")
        const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        last.focus()
        expect(document.activeElement).toBe(last)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: false, bubbles: true, cancelable: true }))
        expect(document.activeElement).toBe(first)
    })
    test("Shift+Tab on first focusable wraps to last", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const panel = screen.getByTestId("devtools-panel")
        const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        first.focus()
        expect(document.activeElement).toBe(first)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }))
        expect(document.activeElement).toBe(last)
    })
})

describe("Devtools log search", () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })
    test("search input filters entries by message substring (case-insensitive)", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "loading model", "App"))
            listener(makeLogEntry("info", "saving file", "App"))
        }
        await Promise.resolve()
        const search = screen.getByLabelText(t("devtools.searchAria")) as HTMLInputElement
        fireEvent.input(search, { target: { value: "MODEL" } })
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1)
        expect(entries[0].textContent).toContain("loading model")
    })
    test("search input filters entries by module", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "hello", "WorkerA"))
            listener(makeLogEntry("info", "hello", "WorkerB"))
        }
        await Promise.resolve()
        const search = screen.getByLabelText(t("devtools.searchAria")) as HTMLInputElement
        fireEvent.input(search, { target: { value: "WorkerB" } })
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1)
        expect(entries[0].textContent).toContain("WorkerB")
    })
    test("search input filters entries by level", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "ok", "M"))
            listener(makeLogEntry("error", "boom", "M"))
        }
        await Promise.resolve()
        const search = screen.getByLabelText(t("devtools.searchAria")) as HTMLInputElement
        fireEvent.input(search, { target: { value: "error" } })
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1)
        expect(entries[0].textContent).toContain("boom")
    })
    test("search and level filter combine", async () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("error", "boom one", "M"))
            listener(makeLogEntry("error", "crash two", "M"))
            listener(makeLogEntry("info", "boom three", "M"))
        }
        await Promise.resolve()
        const select = screen.getByLabelText("Filter log level")
        fireEvent.change(select, { target: { value: "error" } })
        const search = screen.getByLabelText(t("devtools.searchAria")) as HTMLInputElement
        fireEvent.input(search, { target: { value: "boom" } })
        await Promise.resolve()
        const entries = screen.queryAllByTestId("devtools-log-entry")
        expect(entries.length).toBe(1)
        expect(entries[0].textContent).toContain("boom one")
    })
    test("search input is tagged with data-i18n-aria-label and data-i18n-placeholder", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const search = screen.getByLabelText(t("devtools.searchAria"))
        expect(search.getAttribute("data-i18n-aria-label")).toBe("devtools.searchAria")
        expect(search.getAttribute("data-i18n-placeholder")).toBe("devtools.searchPlaceholder")
    })
})

describe("Devtools export logs", () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })
    test("export button triggers a download via URL.createObjectURL", async () => {
        const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url")
        const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "hello", "App"))
        }
        await Promise.resolve()
        const exportBtn = screen.getByLabelText(t("devtools.exportLogsAria"))
        fireEvent.click(exportBtn)
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        createObjectURL.mockRestore()
        revokeObjectURL.mockRestore()
    })
    test("export button does nothing when no log entries", () => {
        const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url")
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const exportBtn = screen.getByLabelText(t("devtools.exportLogsAria"))
        fireEvent.click(exportBtn)
        expect(createObjectURL).not.toHaveBeenCalled()
        createObjectURL.mockRestore()
    })
    test("export button is tagged with data-i18n and data-i18n-aria-label", () => {
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        const exportBtn = screen.getByLabelText(t("devtools.exportLogsAria"))
        expect(exportBtn.getAttribute("data-i18n")).toBe("devtools.exportLogs")
        expect(exportBtn.getAttribute("data-i18n-aria-label")).toBe("devtools.exportLogsAria")
    })
    test("export surfaces failure via showToast", async () => {
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
            throw new Error("boom")
        })
        const stub = makeStub(true)
        render(() => <Devtools appStore={makeAppStore(stub)} />)
        for (const listener of stub.listeners) {
            listener(makeLogEntry("info", "hello", "App"))
        }
        await Promise.resolve()
        const exportBtn = screen.getByLabelText(t("devtools.exportLogsAria"))
        fireEvent.click(exportBtn)
        expect(stub.showToast).toHaveBeenCalledTimes(1)
        expect(stub.showToast).toHaveBeenCalledWith(t("devtools.exportLogsFailed"), "error")
    })
})
