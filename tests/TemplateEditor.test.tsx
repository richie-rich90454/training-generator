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
})
