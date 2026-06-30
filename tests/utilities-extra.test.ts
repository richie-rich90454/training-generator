// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { encryptKey, decryptKey } from "../src/renderer/security.js"
import { Logger } from "../src/renderer/logger.js"
import { t, applyLanguage } from "../src/renderer/i18n.js"
import { validateItems } from "../src/renderer/qualityValidator.js"
import type { TrainingItem } from "../src/types/index.js"
describe("security", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })
    it("encrypts and decrypts a key", async () => {
        let original = "sk-test-key-12345"
        let encrypted = await encryptKey(original)
        expect(encrypted).not.toBe(original)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe(original)
    })
    it("returns empty string for empty input", async () => {
        expect(await encryptKey("")).toBe("")
        expect(await decryptKey("")).toBe("")
    })
    it("produces different ciphertexts for same plaintext", async () => {
        let key = "same-key"
        let e1 = await encryptKey(key)
        let e2 = await encryptKey(key)
        expect(e1).not.toBe(e2)
    })
    it("returns plaintext when decrypting unencrypted value", async () => {
        let plaintext = "not-encrypted"
        let decrypted = await decryptKey(plaintext)
        expect(decrypted).toBe(plaintext)
    })
    it("stores key in localStorage", async () => {
        await encryptKey("secret")
        expect(localStorage.getItem("train-generator-encryption-key")).toBeTruthy()
    })
    it("reuses stored key for subsequent encryptions", async () => {
        await encryptKey("first")
        let stored = localStorage.getItem("train-generator-encryption-key")
        await encryptKey("second")
        expect(localStorage.getItem("train-generator-encryption-key")).toBe(stored)
    })
})
describe("logger", () => {
    let logger: Logger
    beforeEach(() => {
        logger = new Logger()
    })
    it("creates entries for each level", () => {
        logger.debug("mod", "debug msg")
        logger.info("mod", "info msg")
        logger.warn("mod", "warn msg")
        logger.error("mod", "error msg")
        let entries = logger.getEntries()
        expect(entries.length).toBe(4)
        expect(entries.map(e => e.level)).toEqual(["debug", "info", "warn", "error"])
    })
    it("filters entries by level", () => {
        logger.info("mod", "info msg")
        logger.error("mod", "error msg")
        expect(logger.getEntriesByLevel("error").length).toBe(1)
        expect(logger.getEntriesByLevel("info").length).toBe(1)
    })
    it("filters entries by module", () => {
        logger.info("a", "from a")
        logger.info("b", "from b")
        expect(logger.getEntriesByModule("a").length).toBe(1)
    })
    it("includes context in entries", () => {
        logger.info("mod", "msg", { key: "value" })
        let entry = logger.getEntries()[0]
        expect(entry.context).toEqual({ key: "value" })
    })
    it("notifies listeners", () => {
        let heard: any = null
        logger.addListener((entry) => { heard = entry })
        logger.info("mod", "msg")
        expect(heard).not.toBeNull()
        expect(heard.message).toBe("msg")
    })
    it("removes listeners", () => {
        let fn = vi.fn()
        logger.addListener(fn)
        logger.removeListener(fn)
        logger.info("mod", "msg")
        expect(fn).not.toHaveBeenCalled()
    })
    it("ignores listener errors", () => {
        logger.addListener(() => { throw new Error("bad listener") })
        expect(() => logger.info("mod", "msg")).not.toThrow()
    })
    it("exports JSONL", () => {
        logger.info("mod", "msg1")
        logger.info("mod", "msg2")
        let jsonl = logger.exportJSONL()
        expect(jsonl.split("\n").length).toBe(2)
        expect(jsonl).toContain("msg1")
    })
    it("clears entries", () => {
        logger.info("mod", "msg")
        logger.clear()
        expect(logger.getEntries().length).toBe(0)
    })
    it("includes ISO timestamp", () => {
        logger.info("mod", "msg")
        let entry = logger.getEntries()[0]
        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
})
describe("i18n", () => {
    beforeEach(() => {
        document.body.innerHTML = `<span data-i18n="app.title"></span><input data-i18n-placeholder="config.apiKey.placeholder" />`
    })
    it("returns translation for known key", () => {
        expect(t("app.title", "en")).toBe("Training Generator")
    })
    it("falls back to English for missing language", () => {
        expect(t("app.title", "xx")).toBe("Training Generator")
    })
    it("falls back to key for unknown key", () => {
        expect(t("unknown.key", "en")).toBe("unknown.key")
    })
    it("returns Chinese simplified translation", () => {
        expect(t("app.title", "zh-Hans")).toContain("训练")
    })
    it("applies translations to DOM elements", () => {
        applyLanguage("en")
        let el = document.querySelector('[data-i18n="app.title"]') as HTMLElement
        expect(el.textContent).toBe("Training Generator")
    })
    it("applies placeholder translations", () => {
        applyLanguage("en")
        let input = document.querySelector('[data-i18n-placeholder="config.apiKey.placeholder"]') as HTMLInputElement
        expect(input.placeholder).toBe("sk-...")
    })
    it("sets document lang attribute", () => {
        applyLanguage("ja")
        expect(document.documentElement.lang).toBe("ja")
    })
    let languages = ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es", "fr", "de"]
    languages.forEach(lang => {
        it(`returns app title for ${lang}`, () => {
            expect(t("app.title", lang)).toBeTruthy()
        })
    })
})
describe("quality validator", () => {
    it("passes valid instruction items", () => {
        let items: TrainingItem[] = [{ instruction: "What is the capital of France?", input: "", output: "Paris is the capital of France and it is beautiful." }]
        let report = validateItems(items)
        expect(report.passRate).toBe(100)
        expect(report.flaggedItems).toBe(0)
    })
    it("flags short answers", () => {
        let items: TrainingItem[] = [{ instruction: "What?", input: "", output: "Yes" }]
        let report = validateItems(items)
        expect(report.flaggedItems).toBe(1)
        expect(report.breakdown["answer_too_short"]).toBe(1)
    })
    it("flags missing answer", () => {
        let items: TrainingItem[] = [{ instruction: "What?", input: "", output: "" }]
        let report = validateItems(items)
        expect(report.flaggedItems).toBe(1)
    })
    it("flags missing question", () => {
        let items: TrainingItem[] = [{ instruction: "", input: "", output: "Paris is the capital of France and it is beautiful." }]
        let report = validateItems(items)
        expect(report.breakdown["missing_question"]).toBe(1)
    })
    it("flags language mismatch", () => {
        let items: TrainingItem[] = [{ instruction: "这是什么？", input: "", output: "This is an English answer that is long enough." }]
        let report = validateItems(items)
        expect(report.breakdown["language_mismatch"]).toBe(1)
    })
    it("validates chatml messages", () => {
        let items: TrainingItem[] = [{ messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there, how can I help you today?" }] }]
        let report = validateItems(items)
        expect(report.passRate).toBe(100)
    })
    it("flags empty messages", () => {
        let items: TrainingItem[] = [{ messages: [] }]
        let report = validateItems(items)
        expect(report.breakdown["missing_answer"]).toBe(1)
    })
    it("flags messages with missing content", () => {
        let items: TrainingItem[] = [{ messages: [{ role: "user", content: "" }, { role: "assistant", content: "" }] }]
        let report = validateItems(items)
        expect(report.flaggedItems).toBeGreaterThan(0)
    })
    it("flags short message answers", () => {
        let items: TrainingItem[] = [{ messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hi" }] }]
        let report = validateItems(items)
        expect(report.breakdown["answer_too_short"]).toBe(1)
    })
    it("validates text format items", () => {
        let items: TrainingItem[] = [{ text: "This is a long enough text answer for validation purposes." }]
        let report = validateItems(items)
        expect(report.passRate).toBe(100)
    })
    it("flags short text items", () => {
        let items: TrainingItem[] = [{ text: "Short" }]
        let report = validateItems(items)
        expect(report.breakdown["answer_too_short"]).toBe(1)
    })
    it("returns 100% pass rate for empty items", () => {
        let report = validateItems([])
        expect(report.passRate).toBe(100)
    })
    it("computes breakdown totals", () => {
        let items: TrainingItem[] = [
            { instruction: "Q1?", input: "", output: "A" },
            { instruction: "Q2?", input: "", output: "B" },
        ]
        let report = validateItems(items)
        expect(report.totalItems).toBe(2)
        expect(report.flaggedItems).toBe(2)
        expect(report.breakdown["answer_too_short"]).toBe(2)
    })
})
