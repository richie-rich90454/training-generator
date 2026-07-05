// @vitest-environment node
import { describe, it, expect } from "vitest"
import { AuditLog, AuditEntry, InMemoryAuditStorage, computeHash, createGenesisEntry } from "../src/core/auditLog.js"
function makeBaseEntry(overrides: Partial<Omit<AuditEntry, "hash">>={}): Omit<AuditEntry, "hash">{
    return {
        id: "id-1",
        timestamp: 1000,
        action: "test",
        actor: "actor",
        resource: "resource",
        details: {},
        prevHash: "0",
        ...overrides
    }
}
function makeEntry(withoutHashOverrides: Partial<Omit<AuditEntry, "hash">>={}, hash?: string): AuditEntry{
    let withoutHash: Omit<AuditEntry, "hash">=makeBaseEntry(withoutHashOverrides)
    return {
        ...withoutHash,
        hash: hash??computeHash(withoutHash)
    }
}
describe("computeHash", () => {
    it("should return a 64-character hex string", () => {
        let entry=makeBaseEntry()
        let hash=computeHash(entry)
        expect(hash.length).toBe(64)
        expect(hash).toMatch(/^[0-9a-f]+$/)
    })
    it("should return the same hash for the same entry", () => {
        let entry=makeBaseEntry()
        let hash1=computeHash(entry)
        let hash2=computeHash(entry)
        expect(hash1).toBe(hash2)
    })
    it("should return different hashes for different entries", () => {
        let entry1=makeBaseEntry({action: "a"})
        let entry2=makeBaseEntry({action: "b"})
        expect(computeHash(entry1)).not.toBe(computeHash(entry2))
    })
})
describe("createGenesisEntry", () => {
    it("should have prevHash set to 0", () => {
        let entry=createGenesisEntry()
        expect(entry.prevHash).toBe("0")
    })
    it("should have genesis action and system actor", () => {
        let entry=createGenesisEntry()
        expect(entry.action).toBe("genesis")
        expect(entry.actor).toBe("system")
        expect(entry.resource).toBe("audit-log")
    })
    it("should have a 64-character hex hash", () => {
        let entry=createGenesisEntry()
        expect(entry.hash.length).toBe(64)
        expect(entry.hash).toMatch(/^[0-9a-f]+$/)
    })
})
describe("AuditLog", () => {
    it("should append an entry with a hash", () => {
        let log=new AuditLog()
        let entry=log.append("login", "user1", "file.txt")
        expect(entry.hash.length).toBe(64)
        expect(entry.hash).toMatch(/^[0-9a-f]+$/)
    })
    it("should link entries by prevHash", () => {
        let log=new AuditLog()
        let e1=log.append("a1", "u1", "r1")
        let e2=log.append("a2", "u2", "r2")
        expect(e2.prevHash).toBe(e1.hash)
    })
    it("should use prevHash 0 for the first append", () => {
        let log=new AuditLog()
        let entry=log.append("genesis", "system", "audit-log")
        expect(entry.prevHash).toBe("0")
    })
    it("should return a copy from getEntries", () => {
        let log=new AuditLog()
        log.append("a", "u", "r")
        let entries=log.getEntries()
        entries.pop()
        expect(log.getEntries().length).toBe(1)
    })
    it("should verify a valid chain", () => {
        let log=new AuditLog()
        log.append("a1", "u1", "r1")
        log.append("a2", "u2", "r2")
        expect(log.verifyChain()).toEqual({valid: true})
    })
    it("should verify an empty chain as valid", () => {
        let log=new AuditLog()
        expect(log.verifyChain()).toEqual({valid: true})
    })
    it("should detect tampered entry data", () => {
        let log=new AuditLog()
        let entry=log.append("a1", "u1", "r1")
        entry.action="tampered"
        let result=log.verifyChain()
        expect(result.valid).toBe(false)
        expect(result.brokenAt).toBe(0)
    })
    it("should detect tampered hash", () => {
        let log=new AuditLog()
        let entry=log.append("a1", "u1", "r1")
        entry.hash="0".repeat(64)
        let result=log.verifyChain()
        expect(result.valid).toBe(false)
        expect(result.brokenAt).toBe(0)
    })
    it("should report broken link at the next entry", () => {
        let log=new AuditLog()
        log.append("a1", "u1", "r1")
        let e2=log.append("a2", "u2", "r2")
        e2.prevHash="0".repeat(64)
        let result=log.verifyChain()
        expect(result.valid).toBe(false)
        expect(result.brokenAt).toBe(1)
    })
    it("should report tampering at correct index", () => {
        let log=new AuditLog()
        let e1=log.append("a1", "u1", "r1")
        log.append("a2", "u2", "r2")
        log.append("a3", "u3", "r3")
        e1.action="tampered"
        let result=log.verifyChain()
        expect(result.valid).toBe(false)
        expect(result.brokenAt).toBe(0)
    })
    it("should include headers in CSV export", () => {
        let log=new AuditLog()
        log.append("a", "u", "r", {key: "value"})
        let csv=log.exportCsv()
        let lines=csv.split("\n")
        expect(lines[0]).toBe("id,timestamp,action,actor,resource,details,prevHash,hash")
        expect(lines.length).toBe(2)
    })
    it("should escape commas and quotes in CSV export", () => {
        let log=new AuditLog()
        log.append("action,test", 'actor"quote', "resource", {key: "value"})
        let csv=log.exportCsv()
        expect(csv).toContain('"action,test"')
        expect(csv).toContain('"actor""quote"')
    })
    it("should round-trip JSON export", () => {
        let log=new AuditLog()
        let e1=log.append("a1", "u1", "r1", {k: "v"})
        let e2=log.append("a2", "u2", "r2")
        let json=log.exportJson()
        let parsed=JSON.parse(json) as AuditEntry[]
        expect(parsed.length).toBe(2)
        expect(parsed[0].id).toBe(e1.id)
        expect(parsed[1].prevHash).toBe(e2.prevHash)
    })
    it("should save entries to storage", () => {
        let storage=new InMemoryAuditStorage()
        let log=new AuditLog({storage})
        log.append("a", "u", "r")
        log.save()
        let raw=storage.getItem("tg-audit-log")
        expect(raw).not.toBeNull()
        let parsed=JSON.parse(raw!)
        expect(parsed.length).toBe(1)
    })
    it("should load entries from storage", () => {
        let storage=new InMemoryAuditStorage()
        let log=new AuditLog({storage})
        let entry=log.append("a", "u", "r")
        log.save()
        let other=new AuditLog({storage})
        other.load()
        expect(other.getEntries().length).toBe(1)
        expect(other.getEntries()[0].id).toBe(entry.id)
    })
    it("should round-trip through save and load", () => {
        let storage=new InMemoryAuditStorage()
        let log=new AuditLog({storage})
        log.append("a1", "u1", "r1", {k: "v"})
        log.append("a2", "u2", "r2")
        log.save()
        let other=new AuditLog({storage})
        other.load()
        expect(other.verifyChain()).toEqual({valid: true})
    })
    it("should clear entries when loading empty storage", () => {
        let log=new AuditLog({storage: new InMemoryAuditStorage()})
        log.append("a", "u", "r")
        log.load()
        expect(log.getEntries()).toEqual([])
    })
})
describe("InMemoryAuditStorage", () => {
    it("should store and retrieve values", () => {
        let storage=new InMemoryAuditStorage()
        storage.setItem("k1", "v1")
        expect(storage.getItem("k1")).toBe("v1")
    })
    it("should return null for missing key", () => {
        let storage=new InMemoryAuditStorage()
        expect(storage.getItem("missing")).toBeNull()
    })
    it("should overwrite existing value", () => {
        let storage=new InMemoryAuditStorage()
        storage.setItem("k1", "v1")
        storage.setItem("k1", "v2")
        expect(storage.getItem("k1")).toBe("v2")
    })
})
