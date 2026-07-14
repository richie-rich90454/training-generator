import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { Dashboard } from "../src/renderer/components/Dashboard.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { DashboardMetrics } from "../src/renderer/stores/uiStore.js"

const ZERO_METRICS: DashboardMetrics = {
    chunksDone: 0,
    chunksTotal: 0,
    chunksPerSecond: 0,
    tokensPerSecond: 0,
    totalTokens: 0,
    cacheHitRate: 0,
    providerLatency: 0,
    activeProvider: "--",
    eta: "--",
    elapsed: "0s"
}
function makeStub(open = true, metrics: DashboardMetrics = ZERO_METRICS) {
    const setDashboardOpen = vi.fn()
    const uiStore = {
        dashboardOpen: () => open,
        dashboardMetrics: () => metrics,
        setDashboardOpen
    }
    const appStore = { uiStore } as unknown as AppStore
    return { appStore, setDashboardOpen }
}
function renderComponent(open = true, metrics: DashboardMetrics = ZERO_METRICS) {
    const stub = makeStub(open, metrics)
    const result = render(() => <Dashboard appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("Dashboard", () => {
    test("renders overlay when open", () => {
        renderComponent(true)
        expect(screen.getByTestId("dashboard-overlay")).not.toBeNull()
        expect(screen.getByTestId("dashboard-close")).not.toBeNull()
    })
    test("does not render when closed", () => {
        renderComponent(false)
        expect(screen.queryByTestId("dashboard-overlay")).toBeNull()
    })
    test("shows zero metrics when defaults", () => {
        renderComponent(true, ZERO_METRICS)
        expect(screen.getByTestId("dash-chunks").textContent).toBe("0 / 0")
        expect(screen.getByTestId("dash-cps").textContent).toBe("0")
        expect(screen.getByTestId("dash-tps").textContent).toBe("0")
        expect(screen.getByTestId("dash-tokens").textContent).toBe("0")
        expect(screen.getByTestId("dash-cache").textContent).toBe("0%")
        expect(screen.getByTestId("dash-latency").textContent).toBe("--")
        expect(screen.getByTestId("dash-provider").textContent).toBe("--")
    })
    test("shows sample metrics formatted", () => {
        const metrics: DashboardMetrics = {
            chunksDone: 5,
            chunksTotal: 10,
            chunksPerSecond: 2,
            tokensPerSecond: 120,
            totalTokens: 1500,
            cacheHitRate: 80,
            providerLatency: 250,
            activeProvider: "ollama",
            eta: "00:01:30",
            elapsed: "45s"
        }
        renderComponent(true, metrics)
        expect(screen.getByTestId("dash-chunks").textContent).toBe("5 / 10")
        expect(screen.getByTestId("dash-cps").textContent).toBe("2")
        expect(screen.getByTestId("dash-tps").textContent).toBe("120")
        expect(screen.getByTestId("dash-tokens").textContent).toBe((1500).toLocaleString())
        expect(screen.getByTestId("dash-cache").textContent).toBe("80%")
        expect(screen.getByTestId("dash-latency").textContent).toBe("250 ms")
        expect(screen.getByTestId("dash-provider").textContent).toBe("ollama")
        expect(screen.getByTestId("dash-eta").textContent).toBe("00:01:30")
        expect(screen.getByTestId("dash-elapsed").textContent).toBe("45s")
    })
    test("large token counts use locale string formatting", () => {
        const metrics: DashboardMetrics = { ...ZERO_METRICS, totalTokens: 1234567 }
        renderComponent(true, metrics)
        expect(screen.getByTestId("dash-tokens").textContent).toBe((1234567).toLocaleString())
    })
    test("latency shows dash when zero", () => {
        renderComponent(true, { ...ZERO_METRICS, providerLatency: 0 })
        expect(screen.getByTestId("dash-latency").textContent).toBe("--")
    })
    test("latency shows ms when greater than zero", () => {
        renderComponent(true, { ...ZERO_METRICS, providerLatency: 500 })
        expect(screen.getByTestId("dash-latency").textContent).toBe("500 ms")
    })
    test("clicking close button calls setDashboardOpen(false)", () => {
        const { setDashboardOpen } = renderComponent(true)
        fireEvent.click(screen.getByTestId("dashboard-close"))
        expect(setDashboardOpen).toHaveBeenCalledWith(false)
    })
    test("escape key calls setDashboardOpen(false)", () => {
        const { setDashboardOpen } = renderComponent(true)
        fireEvent.keyDown(document.body, { key: "Escape" })
        expect(setDashboardOpen).toHaveBeenCalledWith(false)
    })
    test("unmounts without throwing and removes keydown listener", () => {
        const utils = renderComponent(true)
        expect(() => utils.unmount()).not.toThrow()
        const before = utils.setDashboardOpen.mock.calls.length
        fireEvent.keyDown(document.body, { key: "Escape" })
        expect(utils.setDashboardOpen.mock.calls.length).toBe(before)
        cleanup()
    })
})
