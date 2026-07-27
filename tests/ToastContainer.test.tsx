// @vitest-environment happy-dom
import { describe, test, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { createStore } from "solid-js/store"
import { ToastContainer } from "../src/renderer/components/ToastContainer.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { ToastItem, UIStore } from "../src/renderer/stores/uiStore.js"
import { t } from "../src/renderer/i18n.js"

interface StubHandles {
    appStore: AppStore
    dismissToast: ReturnType<typeof vi.fn>
    setToasts: (next: ToastItem[]) => void
}

function makeStub(initialToasts: ToastItem[] = []): StubHandles {
    const [toasts, setToasts] = createStore<ToastItem[]>([...initialToasts])
    const dismissToast = vi.fn((id: number) => {
        setToasts((prev) => prev.filter((it) => it.id !== id))
    })
    const uiStore = {
        get toasts() { return toasts },
        dismissToast,
    } as unknown as UIStore
    const appStore = { uiStore } as unknown as AppStore
    return { appStore, dismissToast, setToasts }
}

function renderContainer(initialToasts: ToastItem[] = []) {
    const stub = makeStub(initialToasts)
    const result = render(() => <ToastContainer appStore={stub.appStore} />)
    return { ...result, ...stub }
}

const sampleToasts: ToastItem[] = [
    { id: 1, message: "Hello", type: "info" },
    { id: 2, message: "Done", type: "success" },
    { id: 3, message: "Careful", type: "warning" },
    { id: 4, message: "Oops", type: "error" },
]

describe("ToastContainer", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    test("container has region role with Notifications aria-label", () => {
        renderContainer()
        const region = screen.getByRole("region")
        expect(region.getAttribute("aria-label")).toBe(t("toast.containerLabel"))
    })

    test("container tags data-i18n-aria-label for runtime re-translation", () => {
        renderContainer()
        const region = screen.getByRole("region")
        expect(region.getAttribute("data-i18n-aria-label")).toBe("toast.containerLabel")
    })

    test("container exposes polite aria-live and aria-atomic=false so each new toast is announced individually", () => {
        renderContainer()
        const region = screen.getByRole("region")
        expect(region.getAttribute("aria-live")).toBe("polite")
        expect(region.getAttribute("aria-atomic")).toBe("false")
    })

    test("dismiss button has Dismiss aria-label and data-i18n-aria-label", () => {
        renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const btn = screen.getByRole("button")
        expect(btn.getAttribute("aria-label")).toBe(t("toast.dismissAria"))
        expect(btn.getAttribute("data-i18n-aria-label")).toBe("toast.dismissAria")
    })

    test("each toast carries aria-atomic=true so screen readers read the full message", () => {
        renderContainer(sampleToasts)
        const statuses = screen.getAllByRole("status")
        const alerts = screen.getAllByRole("alert")
        for (const el of [...statuses, ...alerts]) {
            expect(el.getAttribute("aria-atomic")).toBe("true")
        }
    })

    test("error toasts get role=alert; other types get role=status", () => {
        renderContainer(sampleToasts)
        expect(screen.getAllByRole("alert").length).toBe(1)
        expect(screen.getAllByRole("status").length).toBe(3)
    })

    test("individual toasts do not duplicate aria-live from the container", () => {
        renderContainer(sampleToasts)
        const statuses = screen.getAllByRole("status")
        const alerts = screen.getAllByRole("alert")
        for (const el of [...statuses, ...alerts]) {
            expect(el.hasAttribute("aria-live")).toBe(false)
        }
    })

    test("toast renders without toast-visible class so the enter transition can run", () => {
        renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        expect(toast).not.toBeNull()
        expect(toast.classList.contains("toast-visible")).toBe(false)
    })

    test("toast-visible class is added on the next frame to trigger enter animation", async () => {
        renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        await vi.waitFor(() => {
            expect(toast.classList.contains("toast-visible")).toBe(true)
        })
    })

    test("clicking dismiss swaps toast-visible for toast-hiding before removing", () => {
        renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        const btn = screen.getByRole("button")
        fireEvent.click(btn)
        expect(toast.classList.contains("toast-hiding")).toBe(true)
        expect(toast.classList.contains("toast-visible")).toBe(false)
    })

    test("onDismiss is not called until transitionend fires", () => {
        const { dismissToast } = renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        fireEvent.click(screen.getByRole("button"))
        expect(dismissToast).not.toHaveBeenCalled()
        fireEvent.transitionEnd(toast)
        expect(dismissToast).toHaveBeenCalledTimes(1)
        expect(dismissToast).toHaveBeenCalledWith(1)
    })

    test("fallback timer calls onDismiss when transitionend never fires", () => {
        vi.useFakeTimers()
        const { dismissToast } = renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        // Pin a known transition duration so the fallback window is deterministic.
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            transitionDuration: "0.4s",
        } as CSSStyleDeclaration)
        fireEvent.click(screen.getByRole("button"))
        // 400ms transition + 50ms padding = 450ms.
        vi.advanceTimersByTime(449)
        expect(dismissToast).not.toHaveBeenCalled()
        vi.advanceTimersByTime(2)
        expect(dismissToast).toHaveBeenCalledTimes(1)
        expect(dismissToast).toHaveBeenCalledWith(1)
    })

    test("repeated dismiss clicks only trigger onDismiss once", () => {
        const { dismissToast } = renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const toast = document.querySelector(".toast") as HTMLDivElement
        const btn = screen.getByRole("button") as HTMLButtonElement
        fireEvent.click(btn)
        fireEvent.click(btn)
        fireEvent.transitionEnd(toast)
        expect(dismissToast).toHaveBeenCalledTimes(1)
    })
})

describe("ToastContainer - Undo action", () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    test("toast without undoAction does not render an Undo button", () => {
        renderContainer([{ id: 1, message: "Hi", type: "info" }])
        const buttons = screen.getAllByRole("button")
        expect(buttons).toHaveLength(1)
        expect(buttons[0].getAttribute("aria-label")).toBe(t("toast.dismissAria"))
    })

    test("toast with null undoAction does not render an Undo button", () => {
        renderContainer([{ id: 1, message: "Hi", type: "info", undoAction: null as unknown as undefined }])
        const buttons = screen.getAllByRole("button")
        expect(buttons).toHaveLength(1)
        expect(buttons[0].getAttribute("aria-label")).toBe(t("toast.dismissAria"))
    })

    test("toast with undoAction renders an Undo button with default label", () => {
        renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction: () => { } }])
        const undoBtn = screen.getByRole("button", { name: t("toast.undo") })
        expect(undoBtn.textContent).toBe(t("toast.undo"))
        // Close button is also present (2 buttons total).
        expect(screen.getAllByRole("button")).toHaveLength(2)
    })

    test("toast with undoLabel renders custom label", () => {
        renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction: () => { }, undoLabel: "Restore" }])
        const undoBtn = screen.getByRole("button", { name: "Restore" })
        expect(undoBtn.textContent).toBe("Restore")
    })

    test("clicking Undo calls undoAction once and dismisses the toast", () => {
        const undoAction = vi.fn()
        const { dismissToast } = renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        const undoBtn = screen.getByRole("button", { name: t("toast.undo") })
        fireEvent.click(undoBtn)
        expect(undoAction).toHaveBeenCalledTimes(1)
        // handleDismiss starts the hide animation; transitionend completes it.
        const toast = document.querySelector(".toast") as HTMLDivElement
        fireEvent.transitionEnd(toast)
        expect(dismissToast).toHaveBeenCalledTimes(1)
        expect(dismissToast).toHaveBeenCalledWith(1)
    })

    test("Undo button disappears after 5 seconds while toast remains", () => {
        vi.useFakeTimers()
        const undoAction = vi.fn()
        renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        // Undo button is initially visible (getByRole throws if not found).
        screen.getByRole("button", { name: t("toast.undo") })
        // Close button is also present.
        screen.getByRole("button", { name: t("toast.dismissAria") })
        vi.advanceTimersByTime(5000)
        // Undo button is gone after 5s.
        expect(screen.queryByRole("button", { name: t("toast.undo") })).toBeNull()
        // Close button remains visible.
        screen.getByRole("button", { name: t("toast.dismissAria") })
    })

    test("Undo timeout is cleared when toast is dismissed early", () => {
        vi.useFakeTimers()
        const undoAction = vi.fn()
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { })
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { })
        const { dismissToast } = renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        // Resolve the close button BEFORE mocking getComputedStyle — the
        // role+name query needs a real CSSStyleDeclaration (with
        // getPropertyValue) to compute accessible names via dom-accessibility-api.
        const closeBtn = screen.getByRole("button", { name: t("toast.dismissAria") })
        const toast = document.querySelector(".toast") as HTMLDivElement
        // Mock getComputedStyle for handleDismiss's fallback timer.
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            transitionDuration: "0.4s",
        } as CSSStyleDeclaration)
        // Dismiss via close button (before the 5s undo timeout fires).
        fireEvent.click(closeBtn)
        fireEvent.transitionEnd(toast)
        expect(dismissToast).toHaveBeenCalledTimes(1)
        // Advance past the undo timeout — should not trigger setState on a
        // disposed component (no setState-after-dispose warning).
        vi.advanceTimersByTime(5000)
        expect(errorSpy).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
    })

    test("rapid clicks on Undo only call undoAction once", () => {
        const undoAction = vi.fn()
        renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        const undoBtn = screen.getByRole("button", { name: t("toast.undo") })
        fireEvent.click(undoBtn)
        fireEvent.click(undoBtn)
        fireEvent.click(undoBtn)
        expect(undoAction).toHaveBeenCalledTimes(1)
    })

    test("Undo timeout is cleared on component dispose", () => {
        vi.useFakeTimers()
        const undoAction = vi.fn()
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { })
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { })
        const result = renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        result.unmount()
        // Advance past the undo timeout — should not trigger setState on a
        // disposed component (no setState-after-dispose warning).
        vi.advanceTimersByTime(5000)
        expect(errorSpy).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
    })

    test("undoAction that throws still dismisses the toast", () => {
        const undoAction = vi.fn(() => { throw new Error("boom") })
        const { dismissToast } = renderContainer([{ id: 1, message: "Deleted", type: "info", undoAction }])
        const undoBtn = screen.getByRole("button", { name: t("toast.undo") })
        expect(() => fireEvent.click(undoBtn)).toThrow("boom")
        expect(undoAction).toHaveBeenCalledTimes(1)
        // The finally block should have started the dismiss animation.
        const toast = document.querySelector(".toast") as HTMLDivElement
        expect(toast.classList.contains("toast-hiding")).toBe(true)
        fireEvent.transitionEnd(toast)
        expect(dismissToast).toHaveBeenCalledTimes(1)
        expect(dismissToast).toHaveBeenCalledWith(1)
    })
})
