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
