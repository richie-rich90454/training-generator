import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { TemplateEditor } from "../src/renderer/components/TemplateEditor.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"

function makeStub(open = true) {
    const closeTemplateEditor = vi.fn()
    const uiStore = { templateOpen: () => open, closeTemplateEditor, showToast: vi.fn() }
    const appStore = { uiStore } as unknown as AppStore
    return { appStore, closeTemplateEditor }
}
function renderComponent(open = true) {
    const stub = makeStub(open)
    const result = render(() => <TemplateEditor appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("TemplateEditor", () => {
    test("renders modal dialog when template editor open", () => {
        renderComponent(true)
        expect(screen.getByRole("dialog")).not.toBeNull()
        expect(screen.getByText(t("templateEditor.title"))).not.toBeNull()
    })
    test("does not render when template editor closed", () => {
        renderComponent(false)
        expect(screen.queryByRole("dialog")).toBeNull()
    })
    test("renders textarea with placeholder", () => {
        renderComponent(true)
        const textarea = screen.getByPlaceholderText(t("templateEditor.placeholder")) as HTMLTextAreaElement
        expect(textarea).not.toBeNull()
    })
    test("typing in textarea updates content", () => {
        renderComponent(true)
        const textarea = screen.getByPlaceholderText(t("templateEditor.placeholder")) as HTMLTextAreaElement
        fireEvent.input(textarea, { target: { value: "Hello world" } })
        expect(textarea.value).toBe("Hello world")
    })
    test("live preview substitutes {text} variable with sample", () => {
        renderComponent(true)
        const textarea = screen.getByPlaceholderText(t("templateEditor.placeholder")) as HTMLTextAreaElement
        fireEvent.input(textarea, { target: { value: "Translate: {text}" } })
        const pres = document.body.querySelectorAll("pre")
        // Second <pre> is the live preview (first is the highlighted innerHTML one)
        expect(pres.length).toBeGreaterThanOrEqual(2)
        expect(pres[1].textContent).toContain(t("templateEditor.sampleText"))
    })
    test("clicking close button calls uiStore.closeTemplateEditor", () => {
        const { closeTemplateEditor } = renderComponent(true)
        // Header × button and footer Close button share the same aria-label
        const closeBtns = screen.getAllByLabelText(t("templateEditor.closeAria"))
        fireEvent.click(closeBtns[0] as HTMLButtonElement)
        expect(closeTemplateEditor).toHaveBeenCalledTimes(1)
    })
    test("escape key calls uiStore.closeTemplateEditor", () => {
        const { closeTemplateEditor } = renderComponent(true)
        fireEvent.keyDown(document.body, { key: "Escape" })
        expect(closeTemplateEditor).toHaveBeenCalledTimes(1)
    })
    test("save with content triggers download via URL.createObjectURL", () => {
        const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url")
        const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        renderComponent(true)
        const textarea = screen.getByPlaceholderText(t("templateEditor.placeholder")) as HTMLTextAreaElement
        fireEvent.input(textarea, { target: { value: "Template with {text}" } })
        fireEvent.click(screen.getByText(t("templateEditor.save")))
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        createObjectURL.mockRestore()
        revokeObjectURL.mockRestore()
    })
    test("save with empty content does not trigger download", () => {
        const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url")
        renderComponent(true)
        fireEvent.click(screen.getByText(t("templateEditor.save")))
        expect(createObjectURL).not.toHaveBeenCalled()
        createObjectURL.mockRestore()
    })
    test("backdrop click closes editor", () => {
        const { closeTemplateEditor } = renderComponent(true)
        const dialog = screen.getByRole("dialog")
        // Click the overlay (dialog root) directly to simulate backdrop click
        fireEvent.click(dialog)
        expect(closeTemplateEditor).toHaveBeenCalledTimes(1)
    })
    test("unmounts without throwing and removes keydown listener", () => {
        const utils = renderComponent(true)
        expect(() => utils.unmount()).not.toThrow()
        // After unmount, Escape should no longer call closeTemplateEditor
        const before = utils.closeTemplateEditor.mock.calls.length
        fireEvent.keyDown(document.body, { key: "Escape" })
        expect(utils.closeTemplateEditor.mock.calls.length).toBe(before)
        cleanup()
    })
    test("locks body scroll when open", () => {
        cleanup()
        document.body.style.overflow = ""
        renderComponent(true)
        expect(document.body.style.overflow).toBe("hidden")
        cleanup()
    })
    test("restores body scroll on unmount", () => {
        cleanup()
        document.body.style.overflow = "auto"
        const utils = renderComponent(true)
        expect(document.body.style.overflow).toBe("hidden")
        utils.unmount()
        expect(document.body.style.overflow).toBe("auto")
        cleanup()
    })
    test("saves and restores focus", () => {
        cleanup()
        const trigger = document.createElement("button")
        trigger.textContent = "Open editor"
        document.body.appendChild(trigger)
        trigger.focus()
        expect(document.activeElement).toBe(trigger)
        const utils = renderComponent(true)
        // Modal is open — focus should have moved to the textarea
        expect(document.activeElement).not.toBe(trigger)
        utils.unmount()
        // After unmount, focus should be restored to the trigger
        expect(document.activeElement).toBe(trigger)
        document.body.removeChild(trigger)
        cleanup()
    })
    test("dialog aria-labelledby points to visible title", () => {
        cleanup()
        renderComponent(true)
        const dialog = screen.getByRole("dialog")
        expect(dialog.getAttribute("aria-labelledby")).toBe("template-editor-title")
        const title = document.getElementById("template-editor-title")
        expect(title).not.toBeNull()
        expect(title?.tagName).toBe("H2")
        cleanup()
    })
    test("tags translatable strings with data-i18n attributes", () => {
        cleanup()
        renderComponent(true)
        const dialog = screen.getByRole("dialog")
        expect(dialog.querySelector("[data-i18n='templateEditor.title']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.templateLabel']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.highlightedLabel']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.previewLabel']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.load']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.save']")).not.toBeNull()
        expect(dialog.querySelector("[data-i18n='templateEditor.close']")).not.toBeNull()
        const textarea = screen.getByPlaceholderText(t("templateEditor.placeholder"))
        expect(textarea.getAttribute("data-i18n-placeholder")).toBe("templateEditor.placeholder")
        expect(textarea.getAttribute("data-i18n-aria-label")).toBe("templateEditor.contentAria")
        cleanup()
    })
    test("Tab on last focusable wraps to first", () => {
        cleanup()
        renderComponent(true)
        const dialog = screen.getByRole("dialog")
        const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        last.focus()
        expect(document.activeElement).toBe(last)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: false, bubbles: true, cancelable: true }))
        expect(document.activeElement).toBe(first)
        cleanup()
    })
    test("Shift+Tab on first focusable wraps to last", () => {
        cleanup()
        renderComponent(true)
        const dialog = screen.getByRole("dialog")
        const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        first.focus()
        expect(document.activeElement).toBe(first)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }))
        expect(document.activeElement).toBe(last)
        cleanup()
    })
})
