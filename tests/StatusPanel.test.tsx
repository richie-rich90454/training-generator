// @vitest-environment happy-dom
import { describe, test, expect, vi, afterEach } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { StatusPanel } from "../src/renderer/components/StatusPanel.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { OllamaStatus } from "../src/types/index.js"

interface StubState {
    ollamaStatus: () => OllamaStatus
    ollamaLoading: () => boolean
    filesProcessed: () => number
    lastProcessed: () => string
    setOllamaStatus: (s: OllamaStatus) => void
    setOllamaLoading: (v: boolean) => void
    setFilesProcessed: (n: number) => void
    setLastProcessed: (s: string) => void
}

function makeStub(initial?: Partial<{
    status: OllamaStatus
    loading: boolean
    files: number
    last: string
}>): StubState {
    // Use "in" check so explicit null status is preserved (?? would replace null with default)
    const hasStatus = initial && Object.prototype.hasOwnProperty.call(initial, "status")
    const [status, setStatus] = createSignal<OllamaStatus>(
        hasStatus ? (initial!.status as OllamaStatus) : { running: false, models: [] }
    )
    const [loading, setLoading] = createSignal<boolean>(initial?.loading ?? false)
    const [files, setFiles] = createSignal<number>(initial?.files ?? 0)
    const [last, setLast] = createSignal<string>(initial?.last ?? "Never")
    return {
        ollamaStatus: status,
        ollamaLoading: loading,
        filesProcessed: files,
        lastProcessed: last,
        setOllamaStatus: setStatus,
        setOllamaLoading: setLoading,
        setFilesProcessed: setFiles,
        setLastProcessed: setLast
    }
}

function makeAppStore(stub: StubState): AppStore {
    return {
        uiStore: {
            ollamaStatus: stub.ollamaStatus,
            ollamaLoading: stub.ollamaLoading,
            filesProcessed: stub.filesProcessed,
            lastProcessed: stub.lastProcessed
        } as any
    } as unknown as AppStore
}

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("StatusPanel rendering", () => {
    test("renders without crashing", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const panel = document.querySelector(".status-panel")
        expect(panel).not.toBeNull()
    })
    test("renders title 'System Status'", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("System Status")
    })
    test("renders card with status-panel class", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const panel = document.querySelector(".status-panel")
        expect(panel?.className).toContain("status-panel")
    })
    test("renders server icon", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const panel = document.querySelector(".status-panel")
        const svg = panel?.querySelector("svg")
        expect(svg).not.toBeNull()
    })
    test("renders status-list container", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.querySelector(".status-list")).not.toBeNull()
    })
    test("renders status-dot element", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.querySelector(".status-dot")).not.toBeNull()
    })
    test("status-dot has aria-hidden true", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const dot = document.querySelector(".status-dot")
        expect(dot?.getAttribute("aria-hidden")).toBe("true")
    })
    test("status-indicator exposes role=status for screen readers", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.getAttribute("role")).toBe("status")
    })
    test("status-indicator exposes aria-live=polite", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.getAttribute("aria-live")).toBe("polite")
    })
    test("status-indicator exposes aria-atomic=true", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.getAttribute("aria-atomic")).toBe("true")
    })
})

describe("StatusPanel ollama offline state", () => {
    test("shows offline status text when not running and not loading", () => {
        const stub = makeStub({ status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Ollama: Offline")
    })
    test("applies status-indicator--offline class when offline", () => {
        const stub = makeStub({ status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--offline")
    })
    test("does not show online text when offline", () => {
        const stub = makeStub({ status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).not.toContain("Online")
    })
})

describe("StatusPanel ollama online state", () => {
    test("shows online status text when running", () => {
        const stub = makeStub({
            status: { running: true, models: [{ name: "llama2" }], version: "0.1.0" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Online")
    })
    test("shows version in online status text", () => {
        const stub = makeStub({
            status: { running: true, models: [{ name: "llama2" }], version: "0.1.0" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("0.1.0")
    })
    test("shows model count in online status text", () => {
        const stub = makeStub({
            status: { running: true, models: [{ name: "llama2" }, { name: "mistral" }], version: "0.1.0" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("2")
        expect(document.body.textContent).toContain("models")
    })
    test("applies status-indicator--online class when online", () => {
        const stub = makeStub({
            status: { running: true, models: [], version: "" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--online")
    })
    test("handles zero models gracefully when online", () => {
        const stub = makeStub({
            status: { running: true, models: [], version: "1.0" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("0")
        expect(document.body.textContent).toContain("models")
    })
    test("handles missing version when online", () => {
        const stub = makeStub({
            status: { running: true, models: [{ name: "x" }] }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Online")
    })
})

describe("StatusPanel ollama checking state", () => {
    test("shows checking text when loading is true", () => {
        const stub = makeStub({ loading: true, status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Checking")
    })
    test("applies status-indicator--checking class when loading", () => {
        const stub = makeStub({ loading: true, status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--checking")
    })
    test("shows checking text when status is null/undefined", () => {
        const stub = makeStub({ status: null as unknown as OllamaStatus })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Checking")
    })
    test("applies checking class when status is null", () => {
        const stub = makeStub({ status: null as unknown as OllamaStatus })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--checking")
    })
    test("loading takes precedence over running status", () => {
        const stub = makeStub({
            loading: true,
            status: { running: true, models: [], version: "" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Checking")
        expect(document.body.textContent).not.toContain("Online")
    })
})

describe("StatusPanel ollama error state", () => {
    test("shows error text when status has error", () => {
        const stub = makeStub({
            status: { running: false, models: [], error: "connection refused" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Error")
    })
    test("applies status-indicator--error class when error", () => {
        const stub = makeStub({
            status: { running: false, models: [], error: "connection refused" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--error")
    })
    test("error takes precedence over offline (not running, not loading)", () => {
        const stub = makeStub({
            status: { running: false, models: [], error: "boom" }
        })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Error")
        expect(document.body.textContent).not.toContain("Offline")
    })
})

describe("StatusPanel files processed", () => {
    test("renders files processed label", () => {
        const stub = makeStub({ files: 5 })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Files Processed:")
    })
    test("renders files processed value", () => {
        const stub = makeStub({ files: 5 })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const rows = document.querySelectorAll(".status-row")
        // First status-row is files processed
        expect(rows[0].textContent).toContain("5")
    })
    test("renders zero when no files processed", () => {
        const stub = makeStub({ files: 0 })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const rows = document.querySelectorAll(".status-row")
        expect(rows[0].textContent).toContain("0")
    })
    test("updates when files processed changes", () => {
        const stub = makeStub({ files: 1 })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        let rows = document.querySelectorAll(".status-row")
        expect(rows[0].textContent).toContain("1")
        stub.setFilesProcessed(42)
        rows = document.querySelectorAll(".status-row")
        expect(rows[0].textContent).toContain("42")
    })
    test("renders large numbers correctly", () => {
        const stub = makeStub({ files: 99999 })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const rows = document.querySelectorAll(".status-row")
        expect(rows[0].textContent).toContain("99999")
    })
})

describe("StatusPanel last processed", () => {
    test("renders last processed label", () => {
        const stub = makeStub({ last: "Never" })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Last Processed:")
    })
    test("renders Never when last processed is Never", () => {
        const stub = makeStub({ last: "Never" })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const rows = document.querySelectorAll(".status-row")
        expect(rows[1].textContent).toContain("Never")
    })
    test("renders timestamp when last processed is set", () => {
        const stub = makeStub({ last: "2025-01-15 12:34" })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const rows = document.querySelectorAll(".status-row")
        expect(rows[1].textContent).toContain("2025-01-15 12:34")
    })
    test("updates when last processed changes", () => {
        const stub = makeStub({ last: "Never" })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        let rows = document.querySelectorAll(".status-row")
        expect(rows[1].textContent).toContain("Never")
        stub.setLastProcessed("2025-06-01 09:00")
        rows = document.querySelectorAll(".status-row")
        expect(rows[1].textContent).toContain("2025-06-01 09:00")
    })
})

describe("StatusPanel reactivity", () => {
    test("updates status text when ollamaStatus changes from offline to online", () => {
        const stub = makeStub({ status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Offline")
        stub.setOllamaStatus({ running: true, models: [{ name: "llama2" }], version: "1.0" })
        expect(document.body.textContent).toContain("Online")
        expect(document.body.textContent).not.toContain("Offline")
    })
    test("updates status class when ollamaStatus changes", () => {
        const stub = makeStub({ status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        let indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--offline")
        stub.setOllamaStatus({ running: true, models: [], version: "" })
        indicator = document.querySelector(".status-indicator")
        expect(indicator?.className).toContain("status-indicator--online")
    })
    test("updates status text when loading toggles", () => {
        const stub = makeStub({ loading: false, status: { running: false, models: [] } })
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(document.body.textContent).toContain("Offline")
        stub.setOllamaLoading(true)
        expect(document.body.textContent).toContain("Checking")
        stub.setOllamaLoading(false)
        expect(document.body.textContent).toContain("Offline")
    })
})

describe("StatusPanel unmount", () => {
    test("unmounts without errors", () => {
        const stub = makeStub()
        const { unmount } = render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        expect(() => unmount()).not.toThrow()
    })
})

describe("StatusPanel data-i18n attributes", () => {
    test("title span has data-i18n='status.title'", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const el = document.querySelector('[data-i18n="status.title"]')
        expect(el).not.toBeNull()
    })
    test("files processed label has data-i18n='status.filesProcessed'", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const el = document.querySelector('[data-i18n="status.filesProcessed"]')
        expect(el).not.toBeNull()
    })
    test("last processed label has data-i18n='status.lastProcessed'", () => {
        const stub = makeStub()
        render(() => <StatusPanel appStore={makeAppStore(stub)} />)
        const el = document.querySelector('[data-i18n="status.lastProcessed"]')
        expect(el).not.toBeNull()
    })
})
