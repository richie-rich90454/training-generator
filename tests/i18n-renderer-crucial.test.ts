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
    it("falls back to english when target language does not exist", () => {
        expect(t("app.title", "xx-YY")).toBe("Training Generator")
    })
    it("falls back to english when key exists in en but target locale is unsupported", () => {
        expect(t("config.model", "ar")).toBe("Ollama Model")
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
        expect(el.getAttribute("aria-label")).toBe("浏览文件（Ctrl+O）")
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
describe("applyLanguage localStorage-missing branch", () => {
    let originalLocalStorage: Storage | undefined
    beforeEach(() => {
        originalLocalStorage = (global as { localStorage?: Storage }).localStorage
        document.documentElement.innerHTML = ""
        document.documentElement.lang = "en"
    })
    afterEach(() => {
        vi.stubGlobal("localStorage", originalLocalStorage)
        originalLocalStorage?.clear()
        document.documentElement.innerHTML = ""
        document.documentElement.lang = "en"
    })
    it("does not crash when localStorage is unavailable (SSR/private mode)", () => {
        const throwingStorage = {
            getItem: () => { throw new Error("localStorage unavailable") },
            setItem: () => { throw new Error("localStorage unavailable") },
            removeItem: () => { throw new Error("localStorage unavailable") },
            clear: () => { throw new Error("localStorage unavailable") },
            key: () => { throw new Error("localStorage unavailable") },
            length: 0,
        }
        vi.stubGlobal("localStorage", throwingStorage)
        expect(() => applyLanguage("zh-Hans")).not.toThrow()
        expect(getCurrentLang()).toBe("zh-Hans")
        expect(document.documentElement.lang).toBe("zh-Hans")
    })
    it("catches error from localStorage.getItem without crashing", () => {
        const base = originalLocalStorage
        const stub = {
            getItem: () => { throw new Error("unavailable") },
            setItem: base ? base.setItem.bind(base) : () => {},
            removeItem: base ? base.removeItem.bind(base) : () => {},
            clear: base ? base.clear.bind(base) : () => {},
            key: base ? base.key.bind(base) : () => null,
            length: 0,
        }
        vi.stubGlobal("localStorage", stub)
        expect(() => applyLanguage("zh-Hant")).not.toThrow()
        expect(getCurrentLang()).toBe("zh-Hant")
    })
    it("catches error from localStorage.setItem without crashing", () => {
        const base = originalLocalStorage
        const stub = {
            getItem: base ? base.getItem.bind(base) : (() => null),
            setItem: () => { throw new Error("unavailable") },
            removeItem: base ? base.removeItem.bind(base) : () => {},
            clear: base ? base.clear.bind(base) : () => {},
            key: base ? base.key.bind(base) : () => null,
            length: 0,
        }
        vi.stubGlobal("localStorage", stub)
        expect(() => applyLanguage("ja")).not.toThrow()
        expect(getCurrentLang()).toBe("ja")
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
    it("every supported locale has the same keys as english", () => {
        const enKeys = Object.keys(translations["en"]).sort()
        const locales = Object.keys(translations).filter((l) => l !== "en")
        for (const locale of locales) {
            const missing = enKeys.filter((k) => !(k in translations[locale]))
            expect(missing, `${locale} is missing ${missing.length} keys`).toEqual([])
        }
    })
    it("returns a value for every english key in every locale", () => {
        const enKeys = Object.keys(translations["en"])
        const locales = Object.keys(translations).filter((l) => l !== "en")
        for (const locale of locales) {
            for (const key of enKeys) {
                const value = t(key, locale)
                expect(value).not.toBe(key)
                expect(typeof value).toBe("string")
                expect(value.length).toBeGreaterThan(0)
            }
        }
    })
})
