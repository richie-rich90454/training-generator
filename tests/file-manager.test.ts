// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest"
import { createFileStore, type FileStore } from "../src/renderer/stores/fileStore.js"
import { withRoot } from "./setup.js"
let disposes: Array<() => void> = []
function makeFileStore(): FileStore {
    return withRoot((dispose) => {
        disposes.push(dispose)
        return createFileStore()
    })
}
function createFile(name: string, size: number=1024, type: string="text/plain"): File {
    let contentSize=Math.min(size, 1000)
    let file=new File(["x".repeat(contentSize)], name, { type })
    if(size>contentSize){
        Object.defineProperty(file, "size", { value: size, configurable: true })
    }
    return file
}
afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
})
describe("FileStore selection", () => {
    it("starts with empty file list", () => {
        let store: FileStore=makeFileStore()
        expect(store.selectedFiles.length).toBe(0)
    })
    it("adds valid files", () => {
        let store: FileStore=makeFileStore()
        let result=store.addFiles([createFile("doc.pdf"), createFile("notes.txt")])
        expect(store.selectedFiles.length).toBe(2)
        expect(result.addedCount).toBe(2)
    })
    it("rejects unsupported file types", () => {
        let store: FileStore=makeFileStore()
        let result=store.addFiles([createFile("image.png")])
        expect(store.selectedFiles.length).toBe(0)
        expect(result.rejectedCount).toBe(1)
    })
    it("rejects files without extension", () => {
        let store: FileStore=makeFileStore()
        let result=store.addFiles([createFile("README")])
        expect(store.selectedFiles.length).toBe(0)
        expect(result.rejectedCount).toBe(1)
    })
    it("detects duplicate file names", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("doc.txt")])
        store.addFiles([createFile("doc.txt")])
        expect(store.selectedFiles.length).toBe(2)
    })
    it("enforces max 100 files", () => {
        let store: FileStore=makeFileStore()
        let files=Array.from({ length: 101 }, (_, i)=>createFile(`f${i}.txt`))
        let result=store.addFiles(files)
        expect(store.selectedFiles.length).toBe(100)
        expect(result.rejectedCount).toBe(1)
    })
    it("reports max files reached", () => {
        let store: FileStore=makeFileStore()
        let files=Array.from({ length: 100 }, (_, i)=>createFile(`f${i}.txt`))
        store.addFiles(files)
        let result=store.addFiles([createFile("extra.txt")])
        expect(result.addedCount).toBe(0)
        expect(result.rejectedCount).toBe(1)
        expect(store.selectedFiles.length).toBe(100)
    })
    it("rejects oversized files", () => {
        let store: FileStore=makeFileStore()
        let result=store.addFiles([createFile("big.pdf", 101*1024*1024)])
        expect(store.selectedFiles.length).toBe(0)
        expect(result.skippedCount).toBe(1)
    })
    it("accepts large pdfs under max", () => {
        let store: FileStore=makeFileStore()
        let result=store.addFiles([createFile("big.pdf", 21*1024*1024)])
        expect(store.selectedFiles.length).toBe(1)
        expect(result.addedCount).toBe(1)
    })
    it("removes a file", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt"), createFile("b.txt")])
        store.removeFile("a.txt")
        expect(store.selectedFiles.length).toBe(1)
        expect(store.selectedFiles[0].name).toBe("b.txt")
    })
    it("clears status on removal", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "processing")
        store.removeFile("a.txt")
        expect(store.fileStatuses["a.txt"]).toBeUndefined()
    })
})
describe("FileStore status", () => {
    it("sets waiting status", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "waiting")
        expect(store.fileStatuses["a.txt"]).toBe("waiting")
    })
    it("sets processing status", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "processing")
        expect(store.getStatusIcon("processing")).toContain("tg-spinner")
        expect(store.getStatusLabel("processing")).toBe("Processing")
        expect(store.getStatusColor("processing")).toBe("#0078D4")
    })
    it("sets completed status", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "completed")
        expect(store.getStatusIcon("completed")).toContain("m9 12 2 2 4-4")
        expect(store.getStatusLabel("completed")).toBe("Completed")
        expect(store.getStatusColor("completed")).toBe("#107C10")
    })
    it("sets failed status", () => {
        let store: FileStore=makeFileStore()
        store.addFiles([createFile("a.txt")])
        store.setFileStatus("a.txt", "failed")
        expect(store.getStatusIcon("failed")).toContain('x1="15" y1="9"')
        expect(store.getStatusLabel("failed")).toBe("Failed")
        expect(store.getStatusColor("failed")).toBe("#D13438")
    })
})
describe("FileStore helpers", () => {
    it("returns correct file icons", () => {
        let store: FileStore=makeFileStore()
        expect(store.getFileIcon("pdf")).toBe("pdf")
        expect(store.getFileIcon("docx")).toBe("word")
        expect(store.getFileIcon("txt")).toBe("file-alt")
        expect(store.getFileIcon("md")).toBe("markdown")
        expect(store.getFileIcon("html")).toBe("code")
        expect(store.getFileIcon("unknown")).toBe("file")
    })
    it("formats file sizes", () => {
        let store: FileStore=makeFileStore()
        expect(store.formatFileSize(0)).toBe("0 Bytes")
        expect(store.formatFileSize(1)).toBe("1 Byte")
        expect(store.formatFileSize(1024)).toBe("1 KB")
        expect(store.formatFileSize(1024*1024)).toBe("1 MB")
        expect(store.formatFileSize(1024*1024*1024)).toContain("GB")
        expect(store.formatFileSize(1536)).toBe("1.5 KB")
    })
})
