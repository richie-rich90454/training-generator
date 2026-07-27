import { describe, test, expect } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import type { TrainingItem } from "../src/types/index.js"
import { DataClassifier, QuarantineManager, applyRetentionPolicy, type ClassificationResult } from "../src/core/dataClassification.js"
function makeItem(text: string): TrainingItem{
    return {format: "instruction", instruction: text, input: "", output: ""}
}
function tempDir(): string{
    return path.join(os.tmpdir(), `tg-quarantine-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}
async function cleanup(dir: string): Promise<void>{
    await fs.promises.rm(dir, {recursive: true, force: true})
}
describe("DataClassifier",()=>{
    test("detects email as PII",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("Contact alice@example.com")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii?.matches).toContain("alice@example.com")
    })
    test("detects phone as PII",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("Call 555-123-4567")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii?.matches).toContain("555-123-4567")
    })
    test("detects SSN as PII",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("SSN 123-45-6789")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii?.matches).toContain("123-45-6789")
    })
    test("detects passport as PII",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("Passport A12345678")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii?.matches).toContain("A12345678")
    })
    test("detects credit card as financial",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("Card 4111-1111-1111-1111")
        let financial=results.find((r)=>r.type==="financial")
        expect(financial).toBeDefined()
        expect(financial?.matches).toContain("4111-1111-1111-1111")
    })
    test("detects API key as secret",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("api-key: abcdef1234567890abcdef1234567890")
        let secret=results.find((r)=>r.type==="secret")
        expect(secret).toBeDefined()
        expect(secret?.matches.length).toBeGreaterThan(0)
    })
    test("detects password as secret",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("password: SuperSecret123!")
        let secret=results.find((r)=>r.type==="secret")
        expect(secret).toBeDefined()
        expect(secret?.matches.length).toBeGreaterThan(0)
    })
    test("classify returns multiple types",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("Email alice@example.com and card 4111-1111-1111-1111 and api-key: secret1234567890abc")
        expect(results.length).toBeGreaterThanOrEqual(2)
        expect(results.map((r)=>r.type)).toContain("pii")
        expect(results.map((r)=>r.type)).toContain("financial")
        expect(results.map((r)=>r.type)).toContain("secret")
    })
    test("classify returns empty for clean text",()=>{
        let classifier=new DataClassifier()
        let results=classifier.classify("The quick brown fox jumps over the lazy dog")
        expect(results.length).toBe(0)
    })
    test("custom pattern detected",()=>{
        let classifier=new DataClassifier({patterns: {employee_id: /\bEMP\d{6}\b/g}})
        let results=classifier.classify("ID EMP123456")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii?.matches).toContain("EMP123456")
    })
    test("handles invalid zero-length regex",()=>{
        let classifier=new DataClassifier({patterns: {bad: /b?/g}})
        let results=classifier.classify("any text")
        expect(results.length).toBe(0)
    })
    test("risk score respects maxRiskScore policy",()=>{
        let classifier=new DataClassifier({policies: {pii: {maxRiskScore: 0.2, retentionDays: 1}}})
        let results=classifier.classify("alice@example.com bob@example.com carol@example.com dave@example.com eve@example.com")
        let pii=results.find((r)=>r.type==="pii")
        expect(pii).toBeDefined()
        expect(pii!.riskScore).toBeLessThanOrEqual(0.2)
    })
    test("policy reflects retention days",()=>{
        let classifier=new DataClassifier({policies: {secret: {maxRiskScore: 1, retentionDays: 45}}})
        let results=classifier.classify("password: hello1234567890")
        let secret=results.find((r)=>r.type==="secret")
        expect(secret).toBeDefined()
        expect(secret?.policy).toBe("retain-45-days")
    })
})
describe("DataClassifier.getHighestRisk",()=>{
    test("selects highest risk score",()=>{
        let classifier=new DataClassifier()
        let results: ClassificationResult[]=[
            {type: "pii", matches: ["a@b.com"], riskScore: 0.5, policy: "retain-30-days"},
            {type: "secret", matches: ["key"], riskScore: 0.9, policy: "retain-90-days"}
        ]
        expect(classifier.getHighestRisk(results)).toBe("secret")
    })
    test("tie broken by type priority",()=>{
        let classifier=new DataClassifier()
        let results: ClassificationResult[]=[
            {type: "pii", matches: ["a@b.com"], riskScore: 0.9, policy: "retain-30-days"},
            {type: "secret", matches: ["key"], riskScore: 0.9, policy: "retain-90-days"}
        ]
        expect(classifier.getHighestRisk(results)).toBe("secret")
    })
    test("returns none for empty results",()=>{
        let classifier=new DataClassifier()
        expect(classifier.getHighestRisk([])).toBe("none")
    })
})
describe("QuarantineManager",()=>{
    test("quarantine stores item",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir})
        let item=makeItem("sensitive")
        let quarantined=await manager.quarantine(item, "contains PII")
        expect(quarantined.item).toEqual(item)
        expect(quarantined.reason).toBe("contains PII")
        expect(typeof quarantined.id).toBe("string")
        expect(quarantined.quarantinedAt).toBeLessThanOrEqual(Date.now())
        let listed=await manager.listQuarantined()
        expect(listed.length).toBe(1)
        await cleanup(dir)
    })
    test("listQuarantined returns items sorted by date",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir})
        let item1=await manager.quarantine(makeItem("a"), "reason1")
        let item2=await manager.quarantine(makeItem("b"), "reason2")
        let listed=await manager.listQuarantined()
        expect(listed.length).toBe(2)
        expect(listed[0].id).toBe(item2.id)
        expect(listed[1].id).toBe(item1.id)
        await cleanup(dir)
    })
    test("release removes item",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir})
        let quarantined=await manager.quarantine(makeItem("a"), "reason")
        let released=await manager.release(quarantined.id)
        expect(released).toBe(true)
        let listed=await manager.listQuarantined()
        expect(listed.length).toBe(0)
        await cleanup(dir)
    })
    test("release returns false for unknown id",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir})
        let released=await manager.release("non-existent-id")
        expect(released).toBe(false)
        await cleanup(dir)
    })
    test("purgeExpired deletes old items",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir, maxRetentionDays: 7})
        let old=await manager.quarantine(makeItem("old"), "old")
        let recent=await manager.quarantine(makeItem("recent"), "recent")
        let filePath=path.join(dir, `${old.id}.json`)
        let raw=await fs.promises.readFile(filePath, "utf8")
        let parsed=JSON.parse(raw) as {id: string, item: TrainingItem, reason: string, quarantinedAt: number}
        parsed.quarantinedAt=Date.now()-10*24*60*60*1000
        await fs.promises.writeFile(filePath, JSON.stringify(parsed), "utf8")
        let deleted=await manager.purgeExpired()
        expect(deleted).toContain(old.id)
        expect(deleted).not.toContain(recent.id)
        let listed=await manager.listQuarantined()
        expect(listed.map((i)=>i.id)).toContain(recent.id)
        expect(listed.map((i)=>i.id)).not.toContain(old.id)
        await cleanup(dir)
    })
    test("purgeExpired keeps recent items",async()=>{
        let dir=tempDir()
        let manager=new QuarantineManager({quarantineDir: dir, maxRetentionDays: 30})
        let quarantined=await manager.quarantine(makeItem("recent"), "recent")
        let deleted=await manager.purgeExpired()
        expect(deleted).not.toContain(quarantined.id)
        await cleanup(dir)
    })
    test("uses default quarantine dir when not specified",async()=>{
        let manager=new QuarantineManager()
        let quarantined=await manager.quarantine(makeItem("x"), "reason")
        expect(quarantined.id).toBeDefined()
        let listed=await manager.listQuarantined()
        expect(listed.length).toBeGreaterThan(0)
        let defaultDir=path.join(os.tmpdir(), "training-generator-quarantine")
        await fs.promises.rm(defaultDir, {recursive: true, force: true})
    })
})
describe("applyRetentionPolicy",()=>{
    test("filters old soft-deleted items",()=>{
        let oldItem: TrainingItem={format: "text", text: "old", metadata: {deletedAt: Date.now()-10*24*60*60*1000}}
        let recentItem: TrainingItem={format: "text", text: "recent", metadata: {deletedAt: Date.now()-2*24*60*60*1000}}
        let result=applyRetentionPolicy([oldItem, recentItem], 5)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual(recentItem)
    })
    test("keeps items without deletedAt",()=>{
        let item: TrainingItem={format: "text", text: "active"}
        let result=applyRetentionPolicy([item], 5)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual(item)
    })
    test("keeps items with null deletedAt",()=>{
        let item: TrainingItem={format: "text", text: "active", metadata: {deletedAt: null}}
        let result=applyRetentionPolicy([item], 5)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual(item)
    })
    test("retention policy filters old items",()=>{
        let items: TrainingItem[]=[
            {format: "text", text: "a", metadata: {deletedAt: Date.now()-100*24*60*60*1000}},
            {format: "text", text: "b", metadata: {deletedAt: Date.now()-1*24*60*60*1000}},
            {format: "text", text: "c"}
        ]
        let result=applyRetentionPolicy(items, 30)
        expect(result.length).toBe(2)
    })
})
