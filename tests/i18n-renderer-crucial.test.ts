// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { t, detectLocale, applyLanguage, getCurrentLang, translations } from "../src/renderer/i18n.js"
describe("t", () => {
    beforeEach(() => {
        localStorage.clear()
        applyLanguage("en")
    })
    afterEach(() => {
        localStorage.clear()
        applyLanguage("en")
    })
    it("returns english value by default", () => {
        expect(t("app.title")).toBe("Training Generator")
    })
    it("returns translated value for zh-Hans", () => {
        expect(t("app.title", "zh-Hans")).toBe("训练生成器")
    })
    it("returns translated value for zh-Hant", () => {
        expect(t("app.title", "zh-Hant")).toBe("訓練生成器")
    })
    it("replaces single parameter", () => {
        expect(t("duration.ms", "en", { ms: "120" })).toBe("120ms")
    })
    it("replaces multiple parameters", () => {
        let result = t("processing.fileChunk", "en", { name: "doc.txt", current: "2", total: "5" })
        expect(result).toContain("doc.txt")
        expect(result).toContain("2/5")
    })
    it("falls back to english when key missing in target lang", () => {
        expect(t("nonexistent.key.for.fallback", "es")).toBe("nonexistent.key.for.fallback")
    })
    it("returns key when missing in all languages", () => {
        expect(t("nonexistent.key.missing")).toBe("nonexistent.key.missing")
    })
    it("uses empty string for missing params", () => {
        expect(t("duration.ms", "en", {})).toBe("ms")
    })
    it("uses current lang when lang omitted", () => {
        applyLanguage("zh-Hans")
        expect(t("app.title")).toBe("训练生成器")
    })
    it("uses explicit lang over current lang", () => {
        applyLanguage("zh-Hans")
        expect(t("app.title", "zh-Hant")).toBe("訓練生成器")
    })
    it("handles empty params object", () => {
        expect(t("app.title", "en", {})).toBe("Training Generator")
    })
    it("clears unreplaced placeholders when param missing", () => {
        expect(t("processing.fileChunk", "en", { name: "doc.txt" })).toBe("Processing doc.txt (chunk /)")
    })
    it("supports file status labels", () => {
        expect(t("file.status.processing")).toBe("Processing")
        expect(t("file.status.completed")).toBe("Completed")
    })
    it("supports toast messages with params", () => {
        let result = t("toast.ollamaNotRunning")
        expect(result).toBe("Ollama is not running")
    })
})
describe("getCurrentLang", () => {
    beforeEach(() => {
        localStorage.clear()
        applyLanguage("en")
    })
    afterEach(() => {
        localStorage.clear()
        applyLanguage("en")
    })
    it("returns en by default", () => {
        expect(getCurrentLang()).toBe("en")
    })
    it("reflects applyLanguage", () => {
        applyLanguage("zh-Hans")
        expect(getCurrentLang()).toBe("zh-Hans")
    })
})
describe("applyLanguage", () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.innerHTML = ""
        document.documentElement.lang = "en"
    })
    afterEach(() => {
        localStorage.clear()
        document.documentElement.innerHTML = ""
        document.documentElement.lang = "en"
    })
    it("persists lang to localStorage", () => {
        applyLanguage("zh-Hans")
        expect(localStorage.getItem("train-generator-ui-lang")).toBe("zh-Hans")
    })
    it("updates data-i18n element text", () => {
        let el = document.createElement("div")
        el.setAttribute("data-i18n", "app.title")
        document.body.appendChild(el)
        applyLanguage("zh-Hans")
        expect(el.textContent).toBe("训练生成器")
    })
    it("updates data-i18n-placeholder", () => {
        let el = document.createElement("input")
        el.setAttribute("data-i18n-placeholder", "config.apiKey.placeholder")
        document.body.appendChild(el)
        applyLanguage("zh-Hans")
        expect((el as HTMLInputElement).placeholder).toBe("sk-...")
    })
    it("updates data-i18n-title", () => {
        let el = document.createElement("button")
        el.setAttribute("data-i18n-title", "upload.clear")
        document.body.appendChild(el)
        applyLanguage("zh-Hans")
        expect(el.getAttribute("title")).toBe("全部清除")
    })
    it("updates data-i18n-aria-label", () => {
        let el = document.createElement("button")
        el.setAttribute("data-i18n-aria-label", "upload.browseAria")
        document.body.appendChild(el)
        applyLanguage("zh-Hans")
        expect(el.getAttribute("aria-label")).toBe("Browse for files (Ctrl+O)")
    })
    it("sets document.documentElement.lang", () => {
        applyLanguage("zh-Hant")
        expect(document.documentElement.lang).toBe("zh-Hant")
    })
    it("reads from localStorage when no arg", () => {
        localStorage.setItem("train-generator-ui-lang", "zh-Hans")
        applyLanguage()
        expect(getCurrentLang()).toBe("zh-Hans")
    })
    it("falls back to detectLocale when no arg and no localStorage", () => {
        localStorage.clear()
        applyLanguage()
        expect(getCurrentLang()).toBe(detectLocale())
    })
    it("updates text node without replacing child elements", () => {
        let el = document.createElement("div")
        el.setAttribute("data-i18n", "app.title")
        el.appendChild(document.createTextNode("Old"))
        let span = document.createElement("span")
        el.appendChild(span)
        document.body.appendChild(el)
        applyLanguage("zh-Hans")
        expect(el.firstChild?.textContent).toBe("训练生成器")
        expect(el.querySelector("span")).toBeTruthy()
    })
})
describe("detectLocale", () => {
    let originalNavigator: Navigator | undefined
    beforeEach(() => {
        originalNavigator = (global as { navigator?: Navigator }).navigator
    })
    afterEach(() => {
        vi.stubGlobal("navigator", originalNavigator)
    })
    it("maps zh-CN to zh-Hans", () => {
        vi.stubGlobal("navigator", { language: "zh-CN" } as Navigator)
        expect(detectLocale()).toBe("zh-Hans")
    })
    it("maps zh-SG to zh-Hans", () => {
        vi.stubGlobal("navigator", { language: "zh-SG" } as Navigator)
        expect(detectLocale()).toBe("zh-Hans")
    })
    it("maps zh-TW to zh-Hant", () => {
        vi.stubGlobal("navigator", { language: "zh-TW" } as Navigator)
        expect(detectLocale()).toBe("zh-Hant")
    })
    it("maps zh-HK to zh-Hant", () => {
        vi.stubGlobal("navigator", { language: "zh-HK" } as Navigator)
        expect(detectLocale()).toBe("zh-Hant")
    })
    it("returns supported base language", () => {
        vi.stubGlobal("navigator", { language: "fr-FR" } as Navigator)
        expect(detectLocale()).toBe("fr")
    })
    it("falls back to en for unsupported locale", () => {
        vi.stubGlobal("navigator", { language: "xx-YY" } as Navigator)
        expect(detectLocale()).toBe("en")
    })
    it("handles missing navigator", () => {
        vi.stubGlobal("navigator", undefined)
        expect(detectLocale()).toBe("en")
    })
    it("handles empty navigator.language", () => {
        vi.stubGlobal("navigator", { language: "" } as Navigator)
        expect(detectLocale()).toBe("en")
    })
})
describe("translations", () => {
    it("has english keys", () => {
        expect(translations["en"]["app.title"]).toBeDefined()
        expect(translations["en"]["processing.start"]).toBeDefined()
    })
    it("has zh-Hans keys", () => {
        expect(translations["zh-Hans"]["app.title"]).toBeDefined()
    })
    it("has zh-Hant keys", () => {
        expect(translations["zh-Hant"]["app.title"]).toBeDefined()
    })
    it("english prompt templates are non-empty", () => {
        expect(translations["en"]["prompt.system.instruction"].length).toBeGreaterThan(0)
        expect(translations["en"]["prompt.system.conversation"].length).toBeGreaterThan(0)
    })
})
