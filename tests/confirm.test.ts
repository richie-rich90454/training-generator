// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type ShowConfirm = (
    message: string,
    title?: string,
    onConfirm?: () => void,
    onCancel?: () => void
) => Promise<boolean>

describe("confirm dialog", () => {
    let showConfirm: ShowConfirm
    let closeConfirm: () => void
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(async () => {
        vi.resetModules()
        document.body.innerHTML = ""
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        const mod = await import("../src/renderer/confirm.js")
        showConfirm = mod.showConfirm
        closeConfirm = mod.closeConfirm
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    function getModal(): HTMLDivElement {
        return document.getElementById("confirm-modal") as HTMLDivElement
    }
    function okBtn(): HTMLButtonElement {
        return getModal().querySelector("#confirm-ok-btn") as HTMLButtonElement
    }
    function cancelBtn(): HTMLButtonElement {
        return getModal().querySelector("#confirm-cancel-btn") as HTMLButtonElement
    }

    it("creates the modal with ARIA attributes and appends it to the body", () => {
        showConfirm("are you sure?")
        const modal = getModal()
        expect(modal).not.toBeNull()
        expect(document.body.contains(modal)).toBe(true)
        expect(modal.getAttribute("role")).toBe("dialog")
        expect(modal.getAttribute("aria-modal")).toBe("true")
        expect(modal.getAttribute("aria-labelledby")).toBe("confirm-title")
        closeConfirm()
    })

    it("sets the message and defaults the title to the i18n title", () => {
        showConfirm("delete everything?")
        expect((getModal().querySelector("#confirm-message") as HTMLElement).textContent).toBe("delete everything?")
        expect((getModal().querySelector("#confirm-title") as HTMLElement).textContent).toBe("Confirm")
        closeConfirm()
    })

    it("uses a custom title when one is provided", () => {
        showConfirm("msg", "Custom Title")
        expect((getModal().querySelector("#confirm-title") as HTMLElement).textContent).toBe("Custom Title")
        closeConfirm()
    })

    it("resolves true and runs onConfirm when the OK button is clicked", async () => {
        let called = false
        const p = showConfirm("msg", undefined, () => { called = true })
        okBtn().click()
        expect(await p).toBe(true)
        expect(called).toBe(true)
    })

    it("resolves false and runs onCancel when the cancel button is clicked", async () => {
        let called = false
        const p = showConfirm("msg", undefined, undefined, () => { called = true })
        cancelBtn().click()
        expect(await p).toBe(false)
        expect(called).toBe(true)
    })

    it("logs via logger.warn and still resolves true when onConfirm throws", async () => {
        const p = showConfirm("msg", undefined, () => { throw new Error("boom") })
        okBtn().click()
        expect(await p).toBe(true)
        expect(warnSpy).toHaveBeenCalledWith("onConfirm callback threw", expect.any(Error))
    })

    it("logs via logger.warn and still resolves false when onCancel throws", async () => {
        const p = showConfirm("msg", undefined, undefined, () => { throw new Error("cancel boom") })
        cancelBtn().click()
        expect(await p).toBe(false)
        expect(warnSpy).toHaveBeenCalledWith("onCancel callback threw", expect.any(Error))
    })

    it("works without any callbacks (OK path)", async () => {
        const p = showConfirm("msg")
        okBtn().click()
        expect(await p).toBe(true)
    })

    it("works without any callbacks (cancel path)", async () => {
        const p = showConfirm("msg")
        cancelBtn().click()
        expect(await p).toBe(false)
    })

    it("cancels when the Escape key is pressed", async () => {
        const p = showConfirm("msg")
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
        expect(await p).toBe(false)
    })

    it("cancels when the backdrop (modal itself) is clicked", async () => {
        const p = showConfirm("msg")
        getModal().click()
        expect(await p).toBe(false)
    })

    it("does not cancel when a click targets an inner element rather than the modal", async () => {
        const p = showConfirm("msg")
        let resolved = false
        p.then(() => { resolved = true })
        ;(getModal().querySelector("#confirm-message") as HTMLElement).click()
        expect(resolved).toBe(false)
        closeConfirm()
        expect(await p).toBe(false)
    })

    it("wraps focus to the OK button on Shift+Tab when cancel is active", () => {
        showConfirm("msg")
        expect(document.activeElement).toBe(cancelBtn())
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }))
        expect(document.activeElement).toBe(okBtn())
        closeConfirm()
    })

    it("wraps focus to the cancel button on Tab when OK is active", () => {
        showConfirm("msg")
        okBtn().focus()
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }))
        expect(document.activeElement).toBe(cancelBtn())
        closeConfirm()
    })

    it("leaves focus unchanged on Tab when the active element does not match a trap edge", () => {
        showConfirm("msg")
        // cancelBtn is focused after showConfirm; Tab (no shift) with active=cancelBtn hits no branch
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }))
        expect(document.activeElement).toBe(cancelBtn())
        closeConfirm()
    })

    it("closeConfirm cancels a pending dialog", async () => {
        const p = showConfirm("msg")
        closeConfirm()
        expect(await p).toBe(false)
    })

    it("closeConfirm is a no-op when no dialog is open", () => {
        expect(() => closeConfirm()).not.toThrow()
    })

    it("resolves a previously pending confirm with false when a new one is shown", async () => {
        const p1 = showConfirm("first")
        const p2 = showConfirm("second")
        expect(await p1).toBe(false)
        okBtn().click()
        expect(await p2).toBe(true)
    })

    it("restores focus to the previously focused element after confirm", async () => {
        const trigger = document.createElement("button")
        document.body.appendChild(trigger)
        trigger.focus()
        expect(document.activeElement).toBe(trigger)
        const p = showConfirm("msg")
        okBtn().click()
        await p
        expect(document.activeElement).toBe(trigger)
    })

    it("reuses the cached modal element across multiple showConfirm calls", () => {
        showConfirm("first")
        const first = getModal()
        closeConfirm()
        showConfirm("second")
        expect(getModal()).toBe(first)
        closeConfirm()
    })

    it("hides the modal (display none, no active class) after cleanup", async () => {
        const p = showConfirm("msg")
        const modal = getModal()
        expect(modal.style.display).toBe("flex")
        expect(modal.classList.contains("active")).toBe(true)
        okBtn().click()
        await p
        expect(modal.style.display).toBe("none")
        expect(modal.classList.contains("active")).toBe(false)
    })
})
