// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, CheckpointData } from "../src/renderer/checkpoint.js"
import type { SelectedFile, TrainingItem } from "../src/types/index.js"
function makeFile(name: string): SelectedFile {
    return { file: null, name, size: 100, type: "text/plain", path: null }
}
function makeCheckpoint(overrides: Partial<CheckpointData> = {}): CheckpointData {
    return {
        files: [makeFile("doc.txt")],
        completedChunks: { "doc.txt": 3 },
        outputData: [{ format: "instruction", instruction: "q", output: "a" }],
        config: { model: "llama2", processingType: "instruction", chunkSize: 8000, concurrency: 3, provider: "ollama" },
        timestamp: Date.now(),
        ...overrides
    }
}
describe("saveCheckpoint", () => {
    beforeEach(() => {
        vi.stubGlobal("window", { electronAPI: { saveCheckpoint: vi.fn(async() => ({ success: true })) } })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })
    it("returns true when save succeeds", async() => {
        let result = await saveCheckpoint(makeCheckpoint())
        expect(result).toBe(true)
    })
    it("calls electronAPI.saveCheckpoint with data", async() => {
        let data = makeCheckpoint()
        await saveCheckpoint(data)
        expect(window.electronAPI!.saveCheckpoint).toHaveBeenCalledWith(data)
    })
    it("returns false when electronAPI is missing", async() => {
        vi.unstubAllGlobals()
        vi.stubGlobal("window", {})
        let result = await saveCheckpoint(makeCheckpoint())
        expect(result).toBe(false)
    })
    it("returns false when saveCheckpoint is missing", async() => {
        vi.stubGlobal("window", { electronAPI: {} })
        let result = await saveCheckpoint(makeCheckpoint())
        expect(result).toBe(false)
    })
    it("returns false when save throws", async() => {
        vi.mocked(window.electronAPI!.saveCheckpoint).mockRejectedValue(new Error("disk full"))
        let result = await saveCheckpoint(makeCheckpoint())
        expect(result).toBe(false)
    })
})
describe("loadCheckpoint", () => {
    beforeEach(() => {
        vi.stubGlobal("window", { electronAPI: { loadCheckpoint: vi.fn(async() => ({ success: true, data: makeCheckpoint() })) } })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })
    it("returns valid checkpoint data", async() => {
        let data = await loadCheckpoint()
        expect(data).not.toBeNull()
        expect(data!.files[0].name).toBe("doc.txt")
    })
    it("returns null when electronAPI is missing", async() => {
        vi.unstubAllGlobals()
        vi.stubGlobal("window", {})
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when loadCheckpoint is missing", async() => {
        vi.stubGlobal("window", { electronAPI: {} })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when result is not successful", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: false })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when data is missing", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when files is not an array", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: { ...makeCheckpoint(), files: "nope" } })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when file entry lacks required fields", async() => {
        let invalid = makeCheckpoint()
        invalid.files = [{ file: null, name: null, size: "0", type: "", path: null } as unknown as SelectedFile]
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when completedChunks is not an object", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: { ...makeCheckpoint(), completedChunks: null } })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when outputData is not an array", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: { ...makeCheckpoint(), outputData: 123 } })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config is not an object", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: { ...makeCheckpoint(), config: null } })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config model is not a string", async() => {
        let invalid = makeCheckpoint()
        invalid.config = { ...invalid.config, model: 123 as any }
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config processingType is not a string", async() => {
        let invalid = makeCheckpoint()
        invalid.config = { ...invalid.config, processingType: 123 as any }
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config chunkSize is not a number", async() => {
        let invalid = makeCheckpoint()
        invalid.config = { ...invalid.config, chunkSize: "8000" as any }
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config concurrency is not a number", async() => {
        let invalid = makeCheckpoint()
        invalid.config = { ...invalid.config, concurrency: "3" as any }
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when config provider is not a string", async() => {
        let invalid = makeCheckpoint()
        invalid.config = { ...invalid.config, provider: 123 as any }
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: invalid })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when timestamp is not a number", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: { ...makeCheckpoint(), timestamp: "now" } })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("returns null when load throws", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockRejectedValue(new Error("corrupted"))
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
    it("accepts checkpoint with empty outputData", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: makeCheckpoint({ outputData: [] }) })
        let data = await loadCheckpoint()
        expect(data).not.toBeNull()
        expect(data!.outputData.length).toBe(0)
    })
    it("accepts checkpoint with empty files", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: makeCheckpoint({ files: [] }) })
        let data = await loadCheckpoint()
        expect(data).not.toBeNull()
        expect(data!.files.length).toBe(0)
    })
    it("accepts file entry with path and no file object", async() => {
        let cp = makeCheckpoint()
        cp.files = [{ file: null, name: "x.txt", size: 10, type: "text/plain", path: "/x.txt" }]
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: cp })
        let data = await loadCheckpoint()
        expect(data).not.toBeNull()
    })
    it("rejects checkpoint with null data", async() => {
        vi.mocked(window.electronAPI!.loadCheckpoint).mockResolvedValue({ success: true, data: null })
        let data = await loadCheckpoint()
        expect(data).toBeNull()
    })
})
describe("clearCheckpoint", () => {
    beforeEach(() => {
        vi.stubGlobal("window", { electronAPI: { clearCheckpoint: vi.fn(async() => ({ success: true })) } })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })
    it("calls electronAPI.clearCheckpoint when available", async() => {
        await clearCheckpoint()
        expect(window.electronAPI!.clearCheckpoint).toHaveBeenCalled()
    })
    it("does nothing when electronAPI is missing", async() => {
        vi.unstubAllGlobals()
        vi.stubGlobal("window", {})
        await expect(clearCheckpoint()).resolves.toBeUndefined()
    })
    it("does nothing when clearCheckpoint is missing", async() => {
        vi.stubGlobal("window", { electronAPI: {} })
        await expect(clearCheckpoint()).resolves.toBeUndefined()
    })
    it("resolves even when clear throws", async() => {
        vi.mocked(window.electronAPI!.clearCheckpoint).mockRejectedValue(new Error("disk error"))
        await expect(clearCheckpoint()).resolves.toBeUndefined()
    })
})
