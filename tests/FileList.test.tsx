import { describe, test, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { UploadCard } from "../src/renderer/components/UploadCard.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { SelectedFile, FileListSortBy, FileListSortDir } from "../src/types/interfaces.js"
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
    sortBy?: FileListSortBy
    sortDir?: FileListSortDir
}

function makeStub(opts: StubOptions = {}) {
    const selectedFiles = opts.selectedFiles ?? []
    const sortByValue = opts.sortBy ?? "date"
    const sortDirValue = opts.sortDir ?? "asc"
    const setSortBy = vi.fn()
    const setSortDir = vi.fn()
    const fileStore = {
        selectedFiles,
        fileStatuses: opts.fileStatuses ?? {},
        addFiles: vi.fn(() => ({ addedCount: 1, skippedCount: 0, rejectedCount: 0 })),
        removeFile: vi.fn(),
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
        getStatusColor: () => "#000",
        sortBy: () => sortByValue,
        sortDir: () => sortDirValue,
        sortedFiles: () => selectedFiles,
        setSortBy,
        setSortDir
    }
    const appStore = {
        fileStore,
        clearAll: vi.fn(),
        uiStore: { showToast: vi.fn() }
    } as unknown as AppStore
    return { appStore, setSortBy, setSortDir }
}

describe("FileList sortable headers - rendering", () => {
    test("does not render headers when no files", () => {
        const { container } = render(() => <UploadCard appStore={makeStub().appStore} />)
        expect(container.querySelector('[data-column="name"]')).toBeNull()
        expect(container.querySelector('[data-column="size"]')).toBeNull()
        expect(container.querySelector('[data-column="date"]')).toBeNull()
    })
    test("renders all three column headers when files present", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({ selectedFiles: [makeSelectedFile("a.txt")] }).appStore} />
        )
        expect(container.querySelector('[data-column="name"]')).not.toBeNull()
        expect(container.querySelector('[data-column="size"]')).not.toBeNull()
        expect(container.querySelector('[data-column="date"]')).not.toBeNull()
    })
    test("header labels use i18n keys", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({ selectedFiles: [makeSelectedFile("a.txt")] }).appStore} />
        )
        expect(container.querySelector('[data-column="name"]')?.textContent).toContain(t("fileList.column.name"))
        expect(container.querySelector('[data-column="size"]')?.textContent).toContain(t("fileList.column.size"))
        expect(container.querySelector('[data-column="date"]')?.textContent).toContain(t("fileList.column.date"))
    })
    test("header row has role=row", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({ selectedFiles: [makeSelectedFile("a.txt")] }).appStore} />
        )
        const header = container.querySelector('[role="row"]')
        expect(header).not.toBeNull()
        expect(header?.getAttribute("role")).toBe("row")
    })
})

describe("FileList sortable headers - clicking", () => {
    test("clicking Name header calls setSortBy with 'name'", () => {
        const { appStore, setSortBy } = makeStub({ selectedFiles: [makeSelectedFile("a.txt")] })
        const { container } = render(() => <UploadCard appStore={appStore} />)
        fireEvent.click(container.querySelector('[data-column="name"]') as HTMLElement)
        expect(setSortBy).toHaveBeenCalledWith("name")
    })
    test("clicking Size header calls setSortBy with 'size'", () => {
        const { appStore, setSortBy } = makeStub({ selectedFiles: [makeSelectedFile("a.txt")] })
        const { container } = render(() => <UploadCard appStore={appStore} />)
        fireEvent.click(container.querySelector('[data-column="size"]') as HTMLElement)
        expect(setSortBy).toHaveBeenCalledWith("size")
    })
    test("clicking Date header calls setSortBy with 'date'", () => {
        const { appStore, setSortBy } = makeStub({ selectedFiles: [makeSelectedFile("a.txt")] })
        const { container } = render(() => <UploadCard appStore={appStore} />)
        fireEvent.click(container.querySelector('[data-column="date"]') as HTMLElement)
        expect(setSortBy).toHaveBeenCalledWith("date")
    })
    test("clicking a header button does not throw", () => {
        const { appStore } = makeStub({ selectedFiles: [makeSelectedFile("a.txt")] })
        const { container } = render(() => <UploadCard appStore={appStore} />)
        expect(() => {
            fireEvent.click(container.querySelector('[data-column="name"]') as HTMLElement)
        }).not.toThrow()
    })
})

describe("FileList sortable headers - aria-sort", () => {
    test("default state: date column ascending, others none", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "date",
                sortDir: "asc"
            }).appStore} />
        )
        expect(container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("none")
        expect(container.querySelector('[data-column="size"]')?.getAttribute("aria-sort")).toBe("none")
        expect(container.querySelector('[data-column="date"]')?.getAttribute("aria-sort")).toBe("ascending")
    })
    test("date desc: date column descending", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "date",
                sortDir: "desc"
            }).appStore} />
        )
        expect(container.querySelector('[data-column="date"]')?.getAttribute("aria-sort")).toBe("descending")
        expect(container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("none")
    })
    test("name asc: name column ascending", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "name",
                sortDir: "asc"
            }).appStore} />
        )
        expect(container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("ascending")
        expect(container.querySelector('[data-column="date"]')?.getAttribute("aria-sort")).toBe("none")
    })
    test("size desc: size column descending", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "size",
                sortDir: "desc"
            }).appStore} />
        )
        expect(container.querySelector('[data-column="size"]')?.getAttribute("aria-sort")).toBe("descending")
        expect(container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("none")
    })
})

describe("FileList sortable headers - arrow indicator", () => {
    test("shows ▲ on active column when asc", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "name",
                sortDir: "asc"
            }).appStore} />
        )
        const nameBtn = container.querySelector('[data-column="name"]')
        expect(nameBtn?.textContent).toContain("▲")
        expect(nameBtn?.textContent).not.toContain("▼")
    })
    test("shows ▼ on active column when desc", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "size",
                sortDir: "desc"
            }).appStore} />
        )
        const sizeBtn = container.querySelector('[data-column="size"]')
        expect(sizeBtn?.textContent).toContain("▼")
        expect(sizeBtn?.textContent).not.toContain("▲")
    })
    test("no arrow on inactive columns", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "date",
                sortDir: "asc"
            }).appStore} />
        )
        const nameBtn = container.querySelector('[data-column="name"]')
        const sizeBtn = container.querySelector('[data-column="size"]')
        const dateBtn = container.querySelector('[data-column="date"]')
        expect(nameBtn?.textContent).not.toContain("▲")
        expect(nameBtn?.textContent).not.toContain("▼")
        expect(sizeBtn?.textContent).not.toContain("▲")
        expect(sizeBtn?.textContent).not.toContain("▼")
        // Date is active, should have arrow
        expect(dateBtn?.textContent).toContain("▲")
    })
    test("arrow is marked aria-hidden", () => {
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "name",
                sortDir: "asc"
            }).appStore} />
        )
        const arrow = container.querySelector('[data-column="name"] [aria-hidden="true"]')
        expect(arrow).not.toBeNull()
        expect(arrow?.getAttribute("aria-hidden")).toBe("true")
    })
})

describe("FileList sortable headers - active column indication", () => {
    test("active column is indicated by aria-sort and arrow", () => {
        // CSS module class names are not available in the test environment,
        // so active-column styling is verified indirectly via aria-sort
        // (ascending/descending) and the arrow indicator (▲/▼).
        const { container } = render(() =>
            <UploadCard appStore={makeStub({
                selectedFiles: [makeSelectedFile("a.txt")],
                sortBy: "name",
                sortDir: "asc"
            }).appStore} />
        )
        const nameBtn = container.querySelector('[data-column="name"]')
        const sizeBtn = container.querySelector('[data-column="size"]')
        const dateBtn = container.querySelector('[data-column="date"]')
        // Active column has aria-sort != none and an arrow
        expect(nameBtn?.getAttribute("aria-sort")).toBe("ascending")
        expect(nameBtn?.textContent).toContain("▲")
        // Inactive columns have aria-sort none and no arrow
        expect(sizeBtn?.getAttribute("aria-sort")).toBe("none")
        expect(sizeBtn?.textContent).not.toContain("▲")
        expect(sizeBtn?.textContent).not.toContain("▼")
        expect(dateBtn?.getAttribute("aria-sort")).toBe("none")
        expect(dateBtn?.textContent).not.toContain("▲")
        expect(dateBtn?.textContent).not.toContain("▼")
    })
})

describe("FileList sortable headers - sort persists across re-render", () => {
    test("sort state from store is reflected after re-render", () => {
        // Sort state lives in the fileStore (signals), not component state,
        // so re-mounting the component reads the current store values.
        const { appStore } = makeStub({
            selectedFiles: [makeSelectedFile("a.txt")],
            sortBy: "name",
            sortDir: "desc"
        })
        const first = render(() => <UploadCard appStore={appStore} />)
        expect(first.container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("descending")
        first.unmount()
        const second = render(() => <UploadCard appStore={appStore} />)
        expect(second.container.querySelector('[data-column="name"]')?.getAttribute("aria-sort")).toBe("descending")
        expect(second.container.querySelector('[data-column="name"]')?.textContent).toContain("▼")
    })
})
