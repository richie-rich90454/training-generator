// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import FileManager from "../src/renderer/fileManager.js"
function createFile(name: string, size: number=1024, type: string="text/plain"): File {
    let contentSize=Math.min(size, 1000)
    let file=new File(["x".repeat(contentSize)], name, { type })
    if(size>contentSize){
        Object.defineProperty(file, "size", { value: size, configurable: true })
    }
    return file
}
function setupDom(): void {
    document.body.innerHTML=`
        <div id="drop-zone"></div>
        <input id="file-input" type="file" />
        <button id="browse-btn"></button>
        <div id="file-list"><p class="empty-state">No files selected</p></div>
        <button id="process-btn"></button>
        <button id="clear-btn"></button>
        <div id="files-count"></div>
        <div id="last-processed"></div>
    `
}
function makeApp(ollamaRunning: boolean=false, demo: boolean=false): any {
    return {
        addLog: vi.fn(),
        audit: { record: vi.fn() },
        sanitizeText: (s: string)=>s.replace(/[<>&"]/g, ""),
        uiManager: { ollamaStatus: { running: ollamaRunning } },
        processor: demo ? { demoMode: true } : undefined,
    }
}
describe("FileManager selection", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("starts with empty file list", () => {
        let manager=new FileManager(makeApp())
        expect(manager.selectedFiles.length).toBe(0)
    })
    it("adds valid files", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("doc.pdf"), createFile("notes.txt")])
        expect(manager.selectedFiles.length).toBe(2)
        expect(app.addLog).toHaveBeenCalledWith("Added 2file(s)", "success")
    })
    it("rejects unsupported file types", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("image.png")])
        expect(manager.selectedFiles.length).toBe(0)
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("No valid files"), "warning")
    })
    it("rejects files without extension", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("README")])
        expect(manager.selectedFiles.length).toBe(0)
    })
    it("detects duplicate file names", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("doc.txt")])
        await manager.addFiles([createFile("doc.txt")])
        expect(manager.selectedFiles.length).toBe(2)
    })
    it("enforces max 100 files", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        let files=Array.from({ length: 101 }, (_, i)=>createFile(`f${i}.txt`))
        await manager.addFiles(files)
        expect(manager.selectedFiles.length).toBe(100)
    })
    it("warns when max files reached", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        let files=Array.from({ length: 100 }, (_, i)=>createFile(`f${i}.txt`))
        await manager.addFiles(files)
        await manager.addFiles([createFile("extra.txt")])
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("Maximum of 100"), "warning")
    })
    it("rejects oversized files", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("big.pdf", 101*1024*1024)])
        expect(manager.selectedFiles.length).toBe(0)
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("too large"), "warning")
    })
    it("warns for large pdfs", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("big.pdf", 21*1024*1024)])
        expect(manager.selectedFiles.length).toBe(1)
        expect(app.addLog).toHaveBeenCalledWith(expect.stringContaining("Large PDF"), "info")
    })
    it("removes a file", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt"), createFile("b.txt")])
        manager.removeFile("a.txt")
        expect(manager.selectedFiles.length).toBe(1)
        expect(manager.selectedFiles[0].name).toBe("b.txt")
    })
    it("updates file list after removal", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt")])
        manager.removeFile("a.txt")
        expect(document.querySelectorAll(".file-item").length).toBe(0)
    })
    it("clears all files via updateFileList", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt")])
        manager.selectedFiles=[]
        manager.updateFileList()
        expect(manager.fileStatuses.size).toBe(0)
    })
})
describe("FileManager drag and drop", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("adds drag-over class on dragover", () => {
        let manager=new FileManager(makeApp())
        let event=new DragEvent("dragover", { bubbles: true })
        manager.handleDragOver(event)
        expect(manager.dropZone.classList.contains("drag-over")).toBe(true)
    })
    it("removes drag-over class on dragleave", () => {
        let manager=new FileManager(makeApp())
        manager.dropZone.classList.add("drag-over")
        let event=new DragEvent("dragleave", { bubbles: true, relatedTarget: document.body })
        manager.handleDragLeave(event)
        expect(manager.dropZone.classList.contains("drag-over")).toBe(false)
    })
    it("handles drop with valid files", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        let files=[createFile("a.txt")]
        let event=new DragEvent("drop", { bubbles: true })
        Object.defineProperty(event, "dataTransfer", { value: { files } })
        await manager.handleDrop(event)
        expect(manager.selectedFiles.length).toBe(1)
        expect(manager.dropZone.classList.contains("drag-over")).toBe(false)
    })
    it("handles file input change", async() => {
        let app=makeApp()
        let manager=new FileManager(app)
        let file=createFile("a.txt")
        let event=new Event("change")
        Object.defineProperty(event, "target", { value: { files: [file], value: "" } })
        await manager.handleFileSelect(event)
        expect(manager.selectedFiles.length).toBe(1)
    })
})
describe("FileManager process button", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("disables button when no files", () => {
        let app=makeApp(true)
        let manager=new FileManager(app)
        manager.updateProcessButton()
        expect(manager.processBtn.disabled).toBe(true)
    })
    it("enables button when ollama ready", async() => {
        let app=makeApp(true)
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt")])
        manager.updateProcessButton()
        expect(manager.processBtn.disabled).toBe(false)
    })
    it("disables button when ollama offline and no demo", async() => {
        let app=makeApp(false)
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt")])
        manager.updateProcessButton()
        expect(manager.processBtn.disabled).toBe(true)
        expect(manager.processBtn.title).toContain("Ollama is not running")
    })
    it("enables button in demo mode", async() => {
        let app=makeApp(false, true)
        let manager=new FileManager(app)
        await manager.addFiles([createFile("a.txt")])
        manager.updateProcessButton()
        expect(manager.processBtn.disabled).toBe(false)
        expect(manager.processBtn.title).toContain("Demo mode")
    })
})
describe("FileManager status icons", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("sets waiting status", async() => {
        let manager=new FileManager(makeApp())
        await manager.addFiles([createFile("a.txt")])
        manager.setFileStatus("a.txt", "waiting")
        expect(manager.fileStatuses.get("a.txt")).toBe("waiting")
    })
    it("sets processing status", async() => {
        let manager=new FileManager(makeApp())
        await manager.addFiles([createFile("a.txt")])
        manager.setFileStatus("a.txt", "processing")
        let statusEl=document.querySelector(".file-status")
        expect(statusEl!.getAttribute("aria-label")).toContain("Processing")
    })
    it("sets completed status", async() => {
        let manager=new FileManager(makeApp())
        await manager.addFiles([createFile("a.txt")])
        manager.setFileStatus("a.txt", "completed")
        let statusEl=document.querySelector(".file-status")
        expect(statusEl!.getAttribute("aria-label")).toContain("Completed")
    })
    it("sets failed status", async() => {
        let manager=new FileManager(makeApp())
        await manager.addFiles([createFile("a.txt")])
        manager.setFileStatus("a.txt", "failed")
        let statusEl=document.querySelector(".file-status")
        expect(statusEl!.getAttribute("aria-label")).toContain("Failed")
    })
})
describe("FileManager helpers", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("returns correct file icons", () => {
        let manager=new FileManager(makeApp())
        expect(manager.getFileIcon("pdf")).toBe("pdf")
        expect(manager.getFileIcon("docx")).toBe("word")
        expect(manager.getFileIcon("txt")).toBe("file-alt")
        expect(manager.getFileIcon("md")).toBe("markdown")
        expect(manager.getFileIcon("html")).toBe("code")
        expect(manager.getFileIcon("unknown")).toBe("file")
    })
    it("formats file sizes", () => {
        let manager=new FileManager(makeApp())
        expect(manager.formatFileSize(0)).toBe("0 Bytes")
        expect(manager.formatFileSize(1024)).toBe("1 KB")
        expect(manager.formatFileSize(1024*1024)).toBe("1 MB")
        expect(manager.formatFileSize(1024*1024*1024)).toContain("GB")
    })
    it("sanitizes file names in list", async() => {
        let app=makeApp()
        app.sanitizeText=(s: string)=>s.replace(/</g, "&lt;")
        let manager=new FileManager(app)
        await manager.addFiles([createFile("<bad>.txt")])
        let item=document.querySelector(".file-item")
        expect(item!.getAttribute("data-name")).not.toContain("<")
    })
})
