import { describe, it, expect, beforeEach } from "vitest"
import { AuditTrail, AuditEntry } from "../src/renderer/audit.js"
describe("AuditTrail", () => {
    let trail: AuditTrail
    beforeEach(() => {
        trail = new AuditTrail()
    })
    it("records a single operation", () => {
        trail.record("processing_started")
        let entries = trail.getEntries()
        expect(entries.length).toBe(1)
        expect(entries[0].operation).toBe("processing_started")
    })
    it("records timestamp in ISO format", () => {
        trail.record("export_triggered")
        let entries = trail.getEntries()
        expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
    it("records details when provided", () => {
        trail.record("settings_changed", { model: "llama2" })
        let entries = trail.getEntries()
        expect(entries[0].details).toEqual({ model: "llama2" })
    })
    it("returns independent copy of entries", () => {
        trail.record("clear_all")
        let entries = trail.getEntries()
        entries.pop()
        expect(trail.getEntries().length).toBe(1)
    })
    it("increments total operations across multiple records", () => {
        trail.record("processing_started")
        trail.record("processing_completed")
        let summary = trail.getSummary()
        expect(summary.totalOperations).toBe(2)
    })
    it("counts operations by type in summary", () => {
        trail.record("processing_started")
        trail.record("processing_started")
        trail.record("export_triggered")
        let summary = trail.getSummary()
        expect(summary.operations["processing_started"]).toBe(2)
        expect(summary.operations["export_triggered"]).toBe(1)
    })
    it("exports empty trail as empty string", () => {
        expect(trail.exportJSONL()).toBe("")
    })
    it("exports entries as JSONL lines", () => {
        trail.record("clear_all", { user: "tester" })
        trail.record("export_triggered")
        let lines = trail.exportJSONL().split("\n")
        expect(lines.length).toBe(2)
        expect(JSON.parse(lines[0]).operation).toBe("clear_all")
    })
    it("clears all entries and operation count", () => {
        trail.record("processing_started")
        trail.clear()
        expect(trail.getEntries().length).toBe(0)
        expect(trail.getSummary().totalOperations).toBe(0)
    })
    it("retains total operations after clear for historical count", () => {
        trail.record("processing_started")
        trail.clear()
        expect(trail.getSummary().totalOperations).toBe(0)
    })
    it("evicts oldest entries when max capacity exceeded", () => {
        for(let i = 0; i < 10005; i++) {
            trail.record(`op_${i}`)
        }
        expect(trail.getEntries().length).toBe(10000)
        expect(trail.getEntries()[0].operation).toBe("op_5")
    })
    it("preserves most recent entries after eviction", () => {
        for(let i = 0; i < 10005; i++) {
            trail.record(`op_${i}`)
        }
        let entries = trail.getEntries()
        expect(entries[entries.length - 1].operation).toBe("op_10004")
    })
    it("summary reflects current entries after eviction", () => {
        for(let i = 0; i < 10002; i++) {
            trail.record("same_op")
        }
        let summary = trail.getSummary()
        expect(summary.operations["same_op"]).toBe(10000)
    })
    it("handles operations with empty details", () => {
        trail.record("processing_started", {})
        let entries = trail.getEntries()
        expect(entries[0].details).toEqual({})
    })
    it("handles operations with nested details", () => {
        trail.record("settings_changed", { nested: { value: 42 } })
        let entries = trail.getEntries()
        expect(entries[0].details).toEqual({ nested: { value: 42 } })
    })
    it("exports details in JSONL", () => {
        trail.record("settings_changed", { model: "x" })
        let exported = JSON.parse(trail.exportJSONL())
        expect(exported.details).toEqual({ model: "x" })
    })
    it("summary returns zero operations for empty trail", () => {
        let summary = trail.getSummary()
        expect(summary.totalOperations).toBe(0)
        expect(Object.keys(summary.operations).length).toBe(0)
    })
    it("allows recording many distinct operation types", () => {
        let ops = ["a", "b", "c", "d", "e"]
        for(let op of ops) {
            trail.record(op)
        }
        let summary = trail.getSummary()
        expect(Object.keys(summary.operations).length).toBe(5)
    })
    it("maintains insertion order after multiple records", () => {
        trail.record("first")
        trail.record("second")
        trail.record("third")
        let entries = trail.getEntries()
        expect(entries.map(e => e.operation)).toEqual(["first", "second", "third"])
    })
    it("records valid ISO timestamp for each entry", () => {
        trail.record("test")
        let timestamp = trail.getEntries()[0].timestamp
        expect(new Date(timestamp).toISOString()).toBe(timestamp)
    })
    it("handles undefined details gracefully", () => {
        trail.record("test")
        expect(trail.getEntries()[0].details).toBeUndefined()
        expect(trail.exportJSONL()).toContain("test")
    })
    it("counts operations correctly after clear and re-record", () => {
        trail.record("a")
        trail.record("b")
        trail.clear()
        trail.record("c")
        expect(trail.getSummary().totalOperations).toBe(1)
        expect(trail.getSummary().operations["c"]).toBe(1)
    })
    it("eviction removes exactly one entry per record over capacity", () => {
        for(let i = 0; i < 10001; i++) {
            trail.record(`op_${i}`)
        }
        expect(trail.getEntries().length).toBe(10000)
        expect(trail.getEntries()[0].operation).toBe("op_1")
    })
    it("summary totalOperations equals recorded count even with eviction", () => {
        for(let i = 0; i < 10001; i++) {
            trail.record(`op_${i}`)
        }
        expect(trail.getSummary().totalOperations).toBe(10001)
    })
    it("entry implements AuditEntry interface shape", () => {
        trail.record("test", { x: 1 })
        let entry: AuditEntry = trail.getEntries()[0]
        expect(entry.operation).toBe("test")
        expect(entry.timestamp).toBeTruthy()
        expect(entry.details).toEqual({ x: 1 })
    })
    it("JSONL export contains valid JSON per line", () => {
        trail.record("test1")
        trail.record("test2")
        for(let line of trail.exportJSONL().split("\n")) {
            expect(JSON.parse(line)).toBeTruthy()
        }
    })
    it("does not include trailing newline in JSONL export", () => {
        trail.record("test")
        let exported = trail.exportJSONL()
        expect(exported.endsWith("\n")).toBe(false)
    })
})
