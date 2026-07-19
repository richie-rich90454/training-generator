import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { UploadCard } from "../src/renderer/components/UploadCard.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { SelectedFile } from "../src/types/interfaces.js"
import { t } from "../src/renderer/i18n.js"

function makeFile(name = "test.txt"): File {
    return new File(["hello world"], name, { type: "text/plain" })
}
function makeSelectedFile(name = "test.txt", size = 100): SelectedFile {
    return { file: makeFile(name), name, size, type: "txt", path: null }
}
interface StubOptions {
    selectedFiles?: SelectedFile[]
    fileStatuses?: Record<string, string>
}
function makeStub(opts: StubOptions = {}) {
    const selectedFiles = opts.selectedFiles ?? []
    const addFiles = vi.fn(() => ({ addedCount: 1, skippedCount: 0, rejectedCount: 0 }))
    const removeFile = vi.fn()
    const clearAll = vi.fn()
    const showToast = vi.fn()
    const fileStore = {
        selectedFiles,
        fileStatuses: opts.fileStatuses ?? {},
        addFiles,
        removeFile,
        clearFiles: vi.fn(),
        setFileStatus: vi.fn(),
        setOllamaReady: vi.fn(),
        setDemoActive: vi.fn(),
        demoActive: () => false,
        hasFiles: () => selectedFiles.length > 0,
        fileCount: () => selectedFiles.length,
        canProcess: () => selectedFiles.length > 0,
        getFileIcon: () => "alt",
        formatFileSize: (n: number) => `${n} B`,
        getStatusIcon: () => "",
        getStatusLabel: () => "Waiting",
        getStatusColor: () => "#000"
    }
    const appStore = {
        fileStore,
        clearAll,
        uiStore: { showToast }
    } as unknown as AppStore
    return { appStore, addFiles, removeFile, clearAll, showToast }
}

describe("UploadCard", () => {
    test("renders dropzone, browse button and hidden file input", () => {
        const { container } = render(() => <UploadCard appStore={makeStub().appStore} />)
        expect(screen.getByLabelText(t("upload.dropzoneAria"))).not.toBeNull()
        expect(container.querySelector("#browse-btn")).not.toBeNull()
        expect(container.querySelector("#file-input")).not.toBeNull()
    })
    test("shows empty state when no files selected", () => {
        render(() => <UploadCard appStore={makeStub().appStore} />)
        expect(screen.getByText(t("files.empty"))).not.toBeNull()
    })
    test("renders file items when files present", () => {
        const files = [makeSelectedFile("a.txt", 10), makeSelectedFile("b.md", 20)]
        const { container } = render(() => <UploadCard appStore={makeStub({ selectedFiles: files }).appStore} />)
        expect(container.querySelectorAll('[role="listitem"]').length).toBe(2)
    })
    test("clear-all button disabled when no files", () => {
        render(() => <UploadCard appStore={makeStub().appStore} />)
        const btn = screen.getByLabelText(t("upload.clearAria")) as HTMLButtonElement
        expect(btn.disabled).toBe(true)
    })
    test("clear-all button enabled and calls clearAll when files present", () => {
        const { appStore, clearAll } = makeStub({ selectedFiles: [makeSelectedFile("a.txt", 10)] })
        render(() => <UploadCard appStore={appStore} />)
        const btn = screen.getByLabelText(t("upload.clearAria")) as HTMLButtonElement
        expect(btn.disabled).toBe(false)
        fireEvent.click(btn)
        expect(clearAll).toHaveBeenCalledTimes(1)
    })
    test("drop event calls fileStore.addFiles", () => {
        const { appStore, addFiles } = makeStub()
        const { container } = render(() => <UploadCard appStore={appStore} />)
        const dropzone = container.querySelector(".file-upload-area") as HTMLElement
        fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile("dropped.txt")] } })
        expect(addFiles).toHaveBeenCalledTimes(1)
    })
    test("remove button calls fileStore.removeFile with file name", () => {
        const { appStore, removeFile } = makeStub({ selectedFiles: [makeSelectedFile("remove.txt", 50)] })
        render(() => <UploadCard appStore={appStore} />)
        const removeBtn = screen.getByLabelText(t("file.removeAria", undefined, { name: "remove.txt" })) as HTMLButtonElement
        fireEvent.click(removeBtn)
        expect(removeFile).toHaveBeenCalledWith("remove.txt")
    })
    test("browse button triggers hidden file input click", () => {
        const { container } = render(() => <UploadCard appStore={makeStub().appStore} />)
        const input = container.querySelector("#file-input") as HTMLInputElement
        // Avoid the dropzone onClick re-triggering input.click (input nests inside dropzone)
        const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {})
        const browse = container.querySelector("#browse-btn") as HTMLButtonElement
        fireEvent.click(browse)
        expect(clickSpy).toHaveBeenCalledTimes(1)
    })
    test("drag enter adds drag-over class to dropzone", () => {
        const { container } = render(() => <UploadCard appStore={makeStub().appStore} />)
        const dropzone = container.querySelector(".file-upload-area") as HTMLElement
        expect(dropzone.className).not.toContain("drag-over")
        fireEvent.dragEnter(dropzone)
        expect(dropzone.className).toContain("drag-over")
    })
    test("shows warning toast when files are skipped", () => {
        const stub = makeStub()
        stub.addFiles.mockReturnValue({ addedCount: 1, skippedCount: 2, rejectedCount: 0 })
        const { container } = render(() => <UploadCard appStore={stub.appStore} />)
        const dropzone = container.querySelector(".file-upload-area") as HTMLElement
        fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile("big.txt")] } })
        expect(stub.showToast).toHaveBeenCalledWith(
            t("toast.filesSkipped", undefined, { count: "2" }),
            "warning"
        )
    })
    test("does not show skipped toast when skippedCount is zero", () => {
        const stub = makeStub()
        stub.addFiles.mockReturnValue({ addedCount: 1, skippedCount: 0, rejectedCount: 0 })
        const { container } = render(() => <UploadCard appStore={stub.appStore} />)
        const dropzone = container.querySelector(".file-upload-area") as HTMLElement
        fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile("ok.txt")] } })
        const skippedCall = stub.showToast.mock.calls.find(
            (call) => typeof call[0] === "string" && call[0].includes("file(s) were skipped")
        )
        expect(skippedCall).toBeUndefined()
    })
    test("file-remove button has data-i18n-aria-label and title", () => {
        const { appStore } = makeStub({ selectedFiles: [makeSelectedFile("remove.txt", 50)] })
        render(() => <UploadCard appStore={appStore} />)
        const removeBtn = screen.getByLabelText(t("file.removeAria", undefined, { name: "remove.txt" })) as HTMLButtonElement
        expect(removeBtn.getAttribute("data-i18n-aria-label")).toBe("file.removeAria")
        expect(removeBtn.getAttribute("title")).toContain("remove.txt")
    })
    test("unmounts without throwing", () => {
        const utils = render(() => <UploadCard appStore={makeStub().appStore} />)
        expect(() => utils.unmount()).not.toThrow()
    })
})
