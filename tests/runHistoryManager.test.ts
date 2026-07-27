// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { RunHistoryManager, JobQueue, InMemoryJobStorage, createJobId, RunRecord } from "../src/core/runHistoryManager.js"
function makeRecord(overrides: Partial<RunRecord>={}): RunRecord{
    return {
        id: "id",
        name: "run",
        status: "queued",
        config: {},
        ...overrides
    }
}
describe("JobQueue", () => {
    it("should enqueue and dequeue in FIFO order", () => {
        let queue=new JobQueue()
        let r1=makeRecord({id: "1", name: "first"})
        let r2=makeRecord({id: "2", name: "second"})
        queue.enqueue(r1)
        queue.enqueue(r2)
        expect(queue.dequeue()).toBe(r1)
        expect(queue.dequeue()).toBe(r2)
    })
    it("should return undefined when dequeuing empty queue", () => {
        let queue=new JobQueue()
        expect(queue.dequeue()).toBeUndefined()
    })
    it("should peek at first item without removing it", () => {
        let queue=new JobQueue()
        let r1=makeRecord({id: "1"})
        queue.enqueue(r1)
        expect(queue.peek()).toBe(r1)
        expect(queue.peek()).toBe(r1)
        expect(queue.list().length).toBe(1)
    })
    it("should return undefined when peeking empty queue", () => {
        let queue=new JobQueue()
        expect(queue.peek()).toBeUndefined()
    })
    it("should remove matching item by id", () => {
        let queue=new JobQueue()
        let r1=makeRecord({id: "1"})
        let r2=makeRecord({id: "2"})
        queue.enqueue(r1)
        queue.enqueue(r2)
        expect(queue.remove("1")).toBe(true)
        expect(queue.list()).toEqual([r2])
    })
    it("should return false when removing missing id", () => {
        let queue=new JobQueue()
        queue.enqueue(makeRecord({id: "1"}))
        expect(queue.remove("missing")).toBe(false)
    })
    it("should return a copy from list", () => {
        let queue=new JobQueue()
        queue.enqueue(makeRecord({id: "1"}))
        let list=queue.list()
        list.pop()
        expect(queue.list().length).toBe(1)
    })
    it("should clear all items", () => {
        let queue=new JobQueue()
        queue.enqueue(makeRecord({id: "1"}))
        queue.enqueue(makeRecord({id: "2"}))
        queue.clear()
        expect(queue.list()).toEqual([])
        expect(queue.peek()).toBeUndefined()
    })
})
describe("RunHistoryManager", () => {
    it("should load empty history when storage is empty", () => {
        let manager=new RunHistoryManager({storage: new InMemoryJobStorage()})
        manager.load()
        expect(manager.history).toEqual([])
    })
    it("should save history to storage", () => {
        let storage=new InMemoryJobStorage()
        let manager=new RunHistoryManager({storage})
        manager.addRun(makeRecord({id: "1", name: "saved"}))
        manager.save()
        let raw=storage.getItem("tg-run-history")
        expect(raw).not.toBeNull()
        let parsed=JSON.parse(raw!)
        expect(parsed.length).toBe(1)
        expect(parsed[0].id).toBe("1")
    })
    it("should round-trip history through load and save", () => {
        let storage=new InMemoryJobStorage()
        let manager=new RunHistoryManager({storage})
        manager.addRun(makeRecord({id: "1", name: "round"}))
        manager.save()
        let other=new RunHistoryManager({storage})
        other.load()
        expect(other.listRuns().length).toBe(1)
        expect(other.getRun("1")?.name).toBe("round")
    })
    it("should add run to front of history", () => {
        let manager=new RunHistoryManager()
        manager.addRun(makeRecord({id: "1", name: "first"}))
        manager.addRun(makeRecord({id: "2", name: "second"}))
        expect(manager.listRuns()[0].id).toBe("2")
        expect(manager.listRuns()[1].id).toBe("1")
    })
    it("should trim history to maxHistory", () => {
        let manager=new RunHistoryManager({maxHistory: 3})
        for (let i=0;i<5;i++){
            manager.addRun(makeRecord({id: `${i}`, name: `run${i}`}))
        }
        expect(manager.listRuns().length).toBe(3)
        expect(manager.listRuns()[0].id).toBe("4")
    })
    it("should update run by merging fields", () => {
        let manager=new RunHistoryManager()
        manager.addRun(makeRecord({id: "1", status: "running"}))
        manager.updateRun("1", {status: "completed", completedAt: 1234})
        let run=manager.getRun("1")
        expect(run?.status).toBe("completed")
        expect(run?.completedAt).toBe(1234)
        expect(run?.name).toBe("run")
    })
    it("should do nothing when updating missing run", () => {
        let manager=new RunHistoryManager()
        manager.addRun(makeRecord({id: "1"}))
        expect(() => manager.updateRun("missing", {status: "completed"})).not.toThrow()
        expect(manager.listRuns().length).toBe(1)
    })
    it("should get correct run by id", () => {
        let manager=new RunHistoryManager()
        let record=makeRecord({id: "1", name: "target"})
        manager.addRun(record)
        manager.addRun(makeRecord({id: "2"}))
        expect(manager.getRun("1")?.name).toBe("target")
    })
    it("should return undefined for missing run", () => {
        let manager=new RunHistoryManager()
        expect(manager.getRun("missing")).toBeUndefined()
    })
    it("should delete run by id", () => {
        let manager=new RunHistoryManager()
        manager.addRun(makeRecord({id: "1"}))
        expect(manager.deleteRun("1")).toBe(true)
        expect(manager.getRun("1")).toBeUndefined()
    })
    it("should return false when deleting missing run", () => {
        let manager=new RunHistoryManager()
        expect(manager.deleteRun("missing")).toBe(false)
    })
    it("should return a copy from listRuns", () => {
        let manager=new RunHistoryManager()
        manager.addRun(makeRecord({id: "1"}))
        let list=manager.listRuns()
        list.pop()
        expect(manager.listRuns().length).toBe(1)
    })
    it("should queue run", () => {
        let manager=new RunHistoryManager()
        let record=makeRecord({id: "1"})
        manager.queueRun(record)
        expect(manager.queue.peek()).toBe(record)
    })
    it("should dequeue next job", () => {
        let manager=new RunHistoryManager()
        let r1=makeRecord({id: "1"})
        let r2=makeRecord({id: "2"})
        manager.queueRun(r1)
        manager.queueRun(r2)
        expect(manager.nextJob()).toBe(r1)
        expect(manager.nextJob()).toBe(r2)
        expect(manager.nextJob()).toBeUndefined()
    })
    it("should round-trip autosave draft", () => {
        let manager=new RunHistoryManager()
        let draft={prompt: "hello", temperature: 0.7}
        manager.autosaveDraft(draft)
        expect(manager.loadDraft()).toEqual(draft)
    })
    it("should return undefined when no draft exists", () => {
        let manager=new RunHistoryManager()
        expect(manager.loadDraft()).toBeUndefined()
    })
    it("should clear draft", () => {
        let manager=new RunHistoryManager()
        manager.autosaveDraft({value: 1})
        manager.clearDraft()
        expect(manager.loadDraft()).toBeUndefined()
    })
    it("should save periodically with startAutosave", () => {
        vi.useFakeTimers()
        try {
            let storage=new InMemoryJobStorage()
            let manager=new RunHistoryManager({storage, autosaveIntervalMs: 1000})
            manager.addRun(makeRecord({id: "1", name: "autosaved"}))
            manager.startAutosave()
            vi.advanceTimersByTime(1000)
            let raw=storage.getItem("tg-run-history")
            expect(raw).not.toBeNull()
            let parsed=JSON.parse(raw!)
            expect(parsed.length).toBe(1)
            expect(parsed[0].name).toBe("autosaved")
        }
        finally {
            vi.useRealTimers()
        }
    })
    it("should stop autosave timer", () => {
        vi.useFakeTimers()
        try {
            let storage=new InMemoryJobStorage()
            let manager=new RunHistoryManager({storage, autosaveIntervalMs: 1000})
            manager.addRun(makeRecord({id: "1"}))
            manager.startAutosave()
            manager.stopAutosave()
            vi.advanceTimersByTime(2000)
            expect(storage.getItem("tg-run-history")).toBeNull()
        }
        finally {
            vi.useRealTimers()
        }
    })
})
describe("createJobId", () => {
    it("should generate unique ids", () => {
        let id1=createJobId()
        let id2=createJobId()
        expect(id1).not.toBe(id2)
    })
    it("should produce non-empty string ids", () => {
        let id=createJobId()
        expect(typeof id).toBe("string")
        expect(id.length).toBeGreaterThan(0)
    })
})
describe("InMemoryJobStorage", () => {
    it("should store and retrieve values", () => {
        let storage=new InMemoryJobStorage()
        storage.setItem("k1", "v1")
        expect(storage.getItem("k1")).toBe("v1")
    })
    it("should return null for missing key", () => {
        let storage=new InMemoryJobStorage()
        expect(storage.getItem("missing")).toBeNull()
    })
    it("should overwrite existing value", () => {
        let storage=new InMemoryJobStorage()
        storage.setItem("k1", "v1")
        storage.setItem("k1", "v2")
        expect(storage.getItem("k1")).toBe("v2")
    })
})
