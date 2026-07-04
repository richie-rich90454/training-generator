import { describe, test, expect } from "vitest"
import crypto from "crypto"
import type { TrainingItem } from "../../src/types/index.js"
import { PiiValidator, DEFAULT_PII_PATTERNS, hashItem, encryptRedactionLog, decryptRedactionLog, type PiiType } from "../../src/renderer/validators/piiValidator.js"
function makeItemWithOutput(output: string): TrainingItem{
    return {format: "instruction", instruction: "What?", input: "", output}
}
describe("DEFAULT_PII_PATTERNS",()=>{
    test("has all types",()=>{
        let types: PiiType[]=["email", "phone", "ssn", "credit_card", "address", "ip_address", "url", "date_of_birth"]
        for (let type of types){
            expect(DEFAULT_PII_PATTERNS[type]).toBeDefined()
            expect(DEFAULT_PII_PATTERNS[type].pattern).toBeInstanceOf(RegExp)
            expect(typeof DEFAULT_PII_PATTERNS[type].replacement).toBe("string")
        }
    })
})
describe("detect",()=>{
    test("finds email",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("Contact alice@example.com for details")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("email")
        expect(matches[0].value).toBe("alice@example.com")
    })
    test("finds phone",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("Call 555-123-4567 today")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("phone")
        expect(matches[0].value).toBe("555-123-4567")
    })
    test("finds SSN",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("SSN: 123-45-6789")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("ssn")
        expect(matches[0].value).toBe("123-45-6789")
    })
    test("finds credit card",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("Card 4111-1111-1111-1111")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("credit_card")
        expect(matches[0].value).toBe("4111-1111-1111-1111")
    })
    test("finds address",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("I live at 123 Main St")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("address")
        expect(matches[0].value).toBe("123 Main St")
    })
    test("finds IP address",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("Server at 192.168.1.1")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("ip_address")
        expect(matches[0].value).toBe("192.168.1.1")
    })
    test("finds URL",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("See https://example.com/page")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("url")
        expect(matches[0].value).toBe("https://example.com/page")
    })
    test("finds date of birth",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("DOB 05/15/1990")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("date_of_birth")
        expect(matches[0].value).toBe("05/15/1990")
    })
    test("handles overlapping matches keeping longer",()=>{
        let validator=new PiiValidator()
        let matches=validator.detect("Visit http://192.168.1.1/path now")
        expect(matches.length).toBe(1)
        expect(matches[0].type).toBe("url")
        expect(matches[0].value).toBe("http://192.168.1.1/path")
    })
})
describe("redact",()=>{
    test("replaces email with [EMAIL_REDACTED]",()=>{
        let validator=new PiiValidator()
        let result=validator.redact("Email alice@example.com please")
        expect(result.redactedText).toBe("Email [EMAIL_REDACTED] please")
        expect(result.matches.length).toBe(1)
        expect(result.matches[0].type).toBe("email")
    })
    test("replaces phone",()=>{
        let validator=new PiiValidator()
        let result=validator.redact("Call 555-123-4567")
        expect(result.redactedText).toBe("Call [PHONE_REDACTED]")
        expect(result.matches[0].type).toBe("phone")
    })
    test("returns matches",()=>{
        let validator=new PiiValidator()
        let result=validator.redact("A alice@example.com and 555-123-4567")
        expect(result.matches.length).toBe(2)
        expect(result.matches.map(m => m.type)).toContain("email")
        expect(result.matches.map(m => m.type)).toContain("phone")
    })
})
describe("mutate",()=>{
    test("redacts item fields",()=>{
        let validator=new PiiValidator()
        let item: TrainingItem={format: "instruction", instruction: "alice@example.com", input: "555-123-4567", output: "123-45-6789"}
        validator.mutate(item)
        expect(item.instruction).toBe("[EMAIL_REDACTED]")
        expect(item.input).toBe("[PHONE_REDACTED]")
        expect(item.output).toBe("[SSN_REDACTED]")
    })
    test("redacts message content",()=>{
        let validator=new PiiValidator()
        let item: TrainingItem={format: "chatml", messages: [{role: "user", content: "alice@example.com"}, {role: "assistant", content: "555-123-4567"}]}
        validator.mutate(item)
        expect(item.messages?.[0]?.content).toBe("[EMAIL_REDACTED]")
        expect(item.messages?.[1]?.content).toBe("[PHONE_REDACTED]")
    })
})
describe("validate",()=>{
    test("flags item with PII",()=>{
        let validator=new PiiValidator()
        let result=validator.validate(makeItemWithOutput("alice@example.com"))
        expect(result.passed).toBe(false)
        expect(result.flags.length).toBeGreaterThan(0)
        expect(result.flags.some(f => f.includes("email"))).toBe(true)
    })
    test("passes clean item",()=>{
        let validator=new PiiValidator()
        let result=validator.validate(makeItemWithOutput("Clean helpful text"))
        expect(result.passed).toBe(true)
        expect(result.score).toBe(1)
        expect(result.flags).toEqual([])
    })
    test("score decreases with more PII",()=>{
        let validator=new PiiValidator()
        let r1=validator.validate(makeItemWithOutput("alice@example.com"))
        let r2=validator.validate(makeItemWithOutput("alice@example.com and 555-123-4567"))
        let r3=validator.validate(makeItemWithOutput("alice@example.com, 555-123-4567, 123-45-6789"))
        expect(r1.score).toBeGreaterThan(r2.score)
        expect(r2.score).toBeGreaterThan(r3.score)
        expect(r3.score).toBe(Math.max(0, 1-3*0.1))
    })
})
describe("redactionLog",()=>{
    test("records when enabled",()=>{
        let validator=new PiiValidator({enableRedaction: true})
        let item: TrainingItem={format: "instruction", instruction: "alice@example.com", input: "", output: ""}
        let expectedHash=hashItem(item)
        validator.mutate(item)
        expect(validator.redactionLog.length).toBe(1)
        expect(validator.redactionLog[0].type).toBe("email")
        expect(validator.redactionLog[0].original).toBe("alice@example.com")
        expect(validator.redactionLog[0].itemHash).toBe(expectedHash)
    })
    test("does not record when disabled",()=>{
        let validator=new PiiValidator()
        let item: TrainingItem={format: "instruction", instruction: "alice@example.com", input: "", output: ""}
        validator.mutate(item)
        expect(validator.redactionLog.length).toBe(0)
    })
})
describe("hashItem",()=>{
    test("is consistent",()=>{
        let item: TrainingItem={format: "instruction", instruction: "hello", input: "", output: ""}
        expect(hashItem(item)).toBe(hashItem(item))
    })
})
describe("encryptRedactionLog",()=>{
    test("round-trip",()=>{
        let key=crypto.randomBytes(32).toString("hex")
        let log=[{timestamp: 1, type: "email" as PiiType, original: "a@b.com", itemHash: "hash"}]
        let encrypted=encryptRedactionLog(log, key)
        let decrypted=decryptRedactionLog(encrypted, key)
        expect(decrypted).toEqual(log)
    })
    test("uses different IV each time",()=>{
        let key=crypto.randomBytes(32).toString("hex")
        let log=[{timestamp: 1, type: "email" as PiiType, original: "a@b.com", itemHash: "hash"}]
        let e1=encryptRedactionLog(log, key)
        let e2=encryptRedactionLog(log, key)
        expect(e1).not.toBe(e2)
    })
})
describe("PiiValidator options",()=>{
    test("name is pii",()=>{
        let validator=new PiiValidator()
        expect(validator.name).toBe("pii")
    })
    test("threshold is 0.5",()=>{
        let validator=new PiiValidator()
        expect(validator.threshold).toBe(0.5)
    })
})
