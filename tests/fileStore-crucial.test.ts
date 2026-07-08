// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { createFileStore, type FileStore } from "../src/renderer/stores/fileStore.js"
let store: FileStore
function createFile(name: string, size: number = 1024, type: string = "text/plain"): File {
    let contentSize = Math.min(size, 1000)
    let file = new File(["x".repeat(contentSize)], name, { type })
    if (size > contentSize) {
        Object.defineProperty(file, "size", { value: size, configurable: true })
    }
    return file
}
beforeEach(() => {
    store = createFileStore()
})
describe("FileStore initial state", () => {
    it("starts empty", () => {
        expect(store.selectedFiles.length).toBe(0)
        expect(store.fileStatuses).toEqual({})
        expect(store.hasFiles()).toBe(false)
        expect(store.fileCount()).toBe(0)
    })
    it("cannot process initially", () => {
        expect(store.canProcess()).toBe(false)
    })
    it("demo mode is off initially", () => {
        expect(store.demoActive()).toBe(false)
    })
})
describe("FileStore addFiles validation", () => {
    it("accepts all supported extensions", () => {
        let exts = ["pdf", "docx", "doc", "rtf", "txt", "md", "html"]
        let files = exts.map(ext => createFile(`file.${ext}`))
        let result = store.addFiles(files)
        expect(result.addedCount).toBe(exts.length)
        expect(store.fileCount()).toBe(exts.length)
    })
    it("rejects unsupported extensions", () => {
        let result = store.addFiles([createFile("image.png"), createFile("archive.zip")])
        expect(result.rejectedCount).toBe(2)
        expect(result.addedCount).toBe(0)
    })
    it("rejects files without extension", () => {
        let result = store.addFiles([createFile("README")])
        expect(result.rejectedCount).toBe(1)
    })
    it("accepts extension-only names as valid txt", () => {
        let result = store.addFiles([createFile(".txt")])
        expect(result.addedCount).toBe(1)
    })
    it("rejects oversized files", () => {
        let result = store.addFiles([createFile("big.pdf", 101 * 1024 * 1024)])
        expect(result.skippedCount).toBe(1)
        expect(result.addedCount).toBe(0)
    })
    it("accepts files at max size boundary", () => {
        let result = store.addFiles([createFile("max.pdf", 100 * 1024 * 1024)])
        expect(result.addedCount).toBe(1)
    })
})
describe("FileStore limits", () => {
    it("enforces 100 file max", () => {
        let files = Array.from({ length: 101 }, (_, i) => createFile(`f${i}.txt`))
        let result = store.addFiles(files)
        expect(store.fileCount()).toBe(100)
        expect(result.rejectedCount).toBe(1)
    })
    it("rejects all when at max", () => {
        store.addFiles(Array.from({ length: 100 }, (_, i) => createFile(`f${i}.txt`)))
        let result = store.addFiles([createFile("extra.txt")])
        expect(result.addedCount).toBe(0)
        expect(result.rejectedCount).toBe(1)
    })
    it("partially accepts when batch exceeds limit", () => {
        store.addFiles(Array.from({ length: 95 }, (_, i) => createFile(`f${i}.txt`)))
        let result = store.addFiles(Array.from({ length: 10 }, (_, i) => createFile(`g${i}.txt`)))
        expect(store.fileCount()).toBe(100)
        expect(result.addedCount).toBe(5)
        expect(result.rejectedCount).toBe(5)
    })
})
describe("FileStore status", () => {
    it("sets status for added file", () => {
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "processing")
        expect(store.fileStatuses["a.txt"]).toBe("processing")
    })
    it("ignores status for unknown file", () => {
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("b.txt", "processing")
        expect(store.fileStatuses["b.txt"]).toBeUndefined()
    })
    it("clears status on removal", () => {
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "completed")
        store.removeFile("a.txt")
        expect(store.fileStatuses["a.txt"]).toBeUndefined()
    })
    it("clears all files and statuses", () => {
        store.addFiles([createFile("a.txt"), createFile("b.txt")])
        store.setFileStatus("a.txt", "processing")
        store.clearFiles()
        expect(store.selectedFiles.length).toBe(0)
        expect(Object.keys(store.fileStatuses).length).toBe(0)
    })
})
describe("FileStore canProcess", () => {
    it("can process with files and ollama ready", () => {
        store.addFiles([createFile("a.txt")])
        store.setOllamaReady(true)
        expect(store.canProcess()).toBe(true)
    })
    it("cannot process without files", () => {
        store.setOllamaReady(true)
        expect(store.canProcess()).toBe(false)
    })
    it("can process in demo mode without ollama", () => {
        store.addFiles([createFile("a.txt")])
        store.setOllamaReady(false)
        store.setDemoActive(true)
        expect(store.canProcess()).toBe(true)
    })
    it("cannot process when ollama offline and not demo", () => {
        store.addFiles([createFile("a.txt")])
        store.setOllamaReady(false)
        store.setDemoActive(false)
        expect(store.canProcess()).toBe(false)
    })
})
describe("FileStore icons", () => {
    it("returns correct file icon per extension", () => {
        expect(store.getFileIcon("pdf")).toBe("pdf")
        expect(store.getFileIcon("docx")).toBe("word")
        expect(store.getFileIcon("doc")).toBe("word")
        expect(store.getFileIcon("md")).toBe("markdown")
        expect(store.getFileIcon("html")).toBe("code")
        expect(store.getFileIcon("unknown")).toBe("file")
    })
    it("returns status icons", () => {
        expect(store.getStatusIcon("waiting")).toContain("<circle")
        expect(store.getStatusIcon("waiting")).toContain("<polyline")
        expect(store.getStatusIcon("processing")).toContain("tg-spinner")
        expect(store.getStatusIcon("completed")).toContain("m9 12 2 2 4-4")
        expect(store.getStatusIcon("failed")).toContain("<line")
        expect(store.getStatusIcon("unknown")).toContain("<circle")
    })
    it("returns status labels", () => {
        expect(store.getStatusLabel("waiting").length).toBeGreaterThan(0)
        expect(store.getStatusLabel("processing").length).toBeGreaterThan(0)
        expect(store.getStatusLabel("completed").length).toBeGreaterThan(0)
        expect(store.getStatusLabel("failed").length).toBeGreaterThan(0)
        expect(store.getStatusLabel("unknown")).toBe(store.getStatusLabel("waiting"))
    })
    it("returns status colors", () => {
        expect(store.getStatusColor("waiting")).toBe("#A19F9D")
        expect(store.getStatusColor("processing")).toBe("#0078D4")
        expect(store.getStatusColor("completed")).toBe("#107C10")
        expect(store.getStatusColor("failed")).toBe("#D13438")
        expect(store.getStatusColor("unknown")).toBe("#A19F9D")
    })
})
describe("FileStore formatFileSize", () => {
    it("formats zero bytes", () => {
        expect(store.formatFileSize(0)).toContain("0")
    })
    it("formats single byte", () => {
        expect(store.formatFileSize(1)).toContain("1")
    })
    it("formats kilobytes", () => {
        expect(store.formatFileSize(1024)).toContain("1")
        expect(store.formatFileSize(1024)).toContain("KB")
    })
    it("formats megabytes", () => {
        expect(store.formatFileSize(1024 * 1024)).toContain("1")
        expect(store.formatFileSize(1024 * 1024)).toContain("MB")
    })
    it("formats gigabytes", () => {
        expect(store.formatFileSize(1024 * 1024 * 1024)).toContain("1")
        expect(store.formatFileSize(1024 * 1024 * 1024)).toContain("GB")
    })
})
describe("FileStore removeFile", () => {
    it("removes existing file", () => {
        store.addFiles([createFile("a.txt"), createFile("b.txt")])
        store.removeFile("a.txt")
        expect(store.fileCount()).toBe(1)
        expect(store.selectedFiles[0].name).toBe("b.txt")
    })
    it("does nothing for unknown file", () => {
        store.addFiles([createFile("a.txt")])
        store.removeFile("b.txt")
        expect(store.fileCount()).toBe(1)
    })
})
describe("FileStore buildSelectedFile", () => {
    it("uses path when available", () => {
        let file = createFile("a.txt") as File & { path?: string }
        file.path = "/tmp/a.txt"
        store.addFiles([file])
        expect(store.selectedFiles[0].path).toBe("/tmp/a.txt")
    })
    it("stores extension as type", () => {
        store.addFiles([createFile("doc.pdf")])
        expect(store.selectedFiles[0].type).toBe("pdf")
    })
})
