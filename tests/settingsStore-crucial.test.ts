// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createSettingsStore, type SettingsStore } from "../src/renderer/stores/settingsStore.js"
function stubMatchMedia(matches: boolean): void {
    vi.stubGlobal("window", {
        ...window,
        matchMedia: vi.fn(() => ({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    })
}
let store: SettingsStore
beforeEach(() => {
    localStorage.clear()
    document.body.className = ""
    document.documentElement.lang = "en"
    stubMatchMedia(false)
})
afterEach(() => {
    vi.restoreAllMocks()
})
describe("SettingsStore initial state", () => {
    it("has default settings", () => {
        store = createSettingsStore()
        expect(store.settings.model).toBe("")
        expect(store.settings.processingType).toBe("instruction")
        expect(store.settings.outputFormat).toBe("jsonl")
        expect(store.settings.language).toBe("en")
        expect(store.settings.chunkSize).toBe(2000)
        expect(store.settings.concurrency).toBe(3)
        expect(store.settings.provider).toBe("ollama")
        expect(store.settings.apiKey).toBe("")
        expect(store.settings.baseUrl).toBe("")
        expect(store.settings.temperature).toBe(0.7)
        expect(store.settings.customPrompt).toBe("")
    })
    it("has default app settings", () => {
        store = createSettingsStore()
        expect(store.appSettings.theme).toBe("auto")
        expect(store.appSettings.fontSize).toBe("medium")
        expect(store.appSettings.autoSave).toBe(true)
        expect(store.appSettings.autoCheckOllama).toBe(true)
        expect(store.appSettings.startMaximized).toBe(false)
        expect(store.appSettings.rememberWindowSize).toBe(true)
        expect(store.appSettings.smartSizing).toBe(true)
        expect(store.appSettings.maxFileSize).toBe(100)
        expect(store.appSettings.maxOutputItems).toBe(100000)
        expect(store.appSettings.maxChunks).toBe(500)
        expect(store.appSettings.maxParallelFiles).toBe(1)
    })
    it("starts with empty profile selection", () => {
        store = createSettingsStore()
        expect(store.selectedProfile()).toBe("")
        expect(store.profiles.length).toBe(0)
    })
    it("starts with empty api key", () => {
        store = createSettingsStore()
        expect(store.apiKeyPlain()).toBe("")
    })
    it("detects ollama as non-cloud provider", () => {
        store = createSettingsStore()
        expect(store.isCloudProvider()).toBe(false)
    })
})
describe("SettingsStore setters", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("sets model", () => {
        store.setModel("llama3")
        expect(store.settings.model).toBe("llama3")
    })
    it("sets processing type", () => {
        store.setProcessingType("conversation")
        expect(store.settings.processingType).toBe("conversation")
    })
    it("sets output format", () => {
        store.setOutputFormat("csv")
        expect(store.settings.outputFormat).toBe("csv")
    })
    it("sets language", () => {
        store.setLanguage("es")
        expect(store.settings.language).toBe("es")
    })
    it("sets chunk size", () => {
        store.setChunkSize(3000)
        expect(store.settings.chunkSize).toBe(3000)
    })
    it("sets concurrency", () => {
        store.setConcurrency(5)
        expect(store.settings.concurrency).toBe(5)
    })
    it("sets provider", () => {
        store.setProvider("openai")
        expect(store.settings.provider).toBe("openai")
        expect(store.isCloudProvider()).toBe(true)
    })
    it("sets api key plain", () => {
        store.setApiKey("secret-key")
        expect(store.apiKeyPlain()).toBe("secret-key")
    })
    it("clears api key in settings when empty", () => {
        store.setApiKey("secret")
        store.setApiKey("")
        expect(store.settings.apiKey).toBe("")
    })
    it("sets base url", () => {
        store.setBaseUrl("http://localhost:11434")
        expect(store.settings.baseUrl).toBe("http://localhost:11434")
    })
    it("sets temperature", () => {
        store.setTemperature(0.5)
        expect(store.settings.temperature).toBe(0.5)
    })
    it("sets custom prompt", () => {
        store.setCustomPrompt("prompt text")
        expect(store.settings.customPrompt).toBe("prompt text")
    })
    it("sets theme", () => {
        store.setTheme("dark")
        expect(store.appSettings.theme).toBe("dark")
    })
    it("sets font size", () => {
        store.setFontSize("large")
        expect(store.appSettings.fontSize).toBe("large")
    })
    it("toggles auto save", () => {
        store.setAutoSave(false)
        expect(store.appSettings.autoSave).toBe(false)
    })
    it("toggles auto check ollama", () => {
        store.setAutoCheckOllama(false)
        expect(store.appSettings.autoCheckOllama).toBe(false)
    })
    it("toggles start maximized", () => {
        store.setStartMaximized(true)
        expect(store.appSettings.startMaximized).toBe(true)
    })
    it("toggles remember window size", () => {
        store.setRememberWindowSize(false)
        expect(store.appSettings.rememberWindowSize).toBe(false)
    })
    it("toggles smart sizing", () => {
        store.setSmartSizing(false)
        expect(store.appSettings.smartSizing).toBe(false)
    })
    it("sets max file size", () => {
        store.setMaxFileSize(200)
        expect(store.appSettings.maxFileSize).toBe(200)
    })
    it("sets max output items", () => {
        store.setMaxOutputItems(50000)
        expect(store.appSettings.maxOutputItems).toBe(50000)
    })
    it("sets max chunks", () => {
        store.setMaxChunks(1000)
        expect(store.appSettings.maxChunks).toBe(1000)
    })
    it("sets max parallel files", () => {
        store.setMaxParallelFiles(4)
        expect(store.appSettings.maxParallelFiles).toBe(4)
    })
})
describe("SettingsStore loadSettings", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("loads model", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ model: "test-model" }))
        await store.loadSettings()
        expect(store.settings.model).toBe("test-model")
    })
    it("validates processing type", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ processingType: "invalid" }))
        await store.loadSettings()
        expect(store.settings.processingType).toBe("instruction")
    })
    it("loads valid processing type", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ processingType: "chunking" }))
        await store.loadSettings()
        expect(store.settings.processingType).toBe("chunking")
    })
    it("validates output format", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ outputFormat: "xml" }))
        await store.loadSettings()
        expect(store.settings.outputFormat).toBe("jsonl")
    })
    it("loads valid output format", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ outputFormat: "chatml" }))
        await store.loadSettings()
        expect(store.settings.outputFormat).toBe("chatml")
    })
    it("validates language", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ language: "pt" }))
        await store.loadSettings()
        expect(store.settings.language).toBe("en")
    })
    it("loads valid language", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ language: "ja" }))
        await store.loadSettings()
        expect(store.settings.language).toBe("ja")
    })
    it("clamps chunk size below minimum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ chunkSize: 100 }))
        await store.loadSettings()
        expect(store.settings.chunkSize).toBe(2000)
    })
    it("clamps chunk size above maximum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ chunkSize: 20000 }))
        await store.loadSettings()
        expect(store.settings.chunkSize).toBe(2000)
    })
    it("loads valid chunk size", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ chunkSize: 3000 }))
        await store.loadSettings()
        expect(store.settings.chunkSize).toBe(3000)
    })
    it("clamps concurrency below minimum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ concurrency: 0 }))
        await store.loadSettings()
        expect(store.settings.concurrency).toBe(3)
    })
    it("clamps concurrency above maximum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ concurrency: 20 }))
        await store.loadSettings()
        expect(store.settings.concurrency).toBe(3)
    })
    it("validates provider", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ provider: "cohere" }))
        await store.loadSettings()
        expect(store.settings.provider).toBe("ollama")
    })
    it("loads valid provider", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ provider: "anthropic" }))
        await store.loadSettings()
        expect(store.settings.provider).toBe("anthropic")
    })
    it("validates base url", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ baseUrl: "not-a-url" }))
        await store.loadSettings()
        expect(store.settings.baseUrl).toBe("")
    })
    it("loads valid base url", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ baseUrl: "https://api.example.com" }))
        await store.loadSettings()
        expect(store.settings.baseUrl).toBe("https://api.example.com")
    })
    it("clamps temperature below minimum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ temperature: -1 }))
        await store.loadSettings()
        expect(store.settings.temperature).toBe(0.7)
    })
    it("clamps temperature above maximum", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ temperature: 2 }))
        await store.loadSettings()
        expect(store.settings.temperature).toBe(0.7)
    })
    it("loads valid temperature", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ temperature: 0.5 }))
        await store.loadSettings()
        expect(store.settings.temperature).toBe(0.5)
    })
    it("loads custom prompt", async() => {
        localStorage.setItem("train-generator-settings", JSON.stringify({ customPrompt: "custom" }))
        await store.loadSettings()
        expect(store.settings.customPrompt).toBe("custom")
    })
    it("handles missing settings gracefully", async() => {
        await store.loadSettings()
        expect(store.settings.model).toBe("")
    })
    it("handles corrupted settings gracefully", async() => {
        localStorage.setItem("train-generator-settings", "not json")
        await expect(store.loadSettings()).resolves.not.toThrow()
    })
})
describe("SettingsStore savePreset", () => {
    beforeEach(() => {
        vi.stubGlobal("window", {
            ...window,
            electronAPI: { setSecureKey: vi.fn(async() => true), getSecureKey: vi.fn(async() => null) },
            matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
        })
        store = createSettingsStore()
    })
    it("saves model", async() => {
        store.setModel("model-x")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.model).toBe("model-x")
    })
    it("encrypts api key", async() => {
        store.setProvider("openai")
        store.setApiKey("secret")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.apiKey).not.toBe("secret")
        expect(saved.apiKey.length).toBeGreaterThan(0)
    })
    it("defaults invalid provider to ollama", async() => {
        store.setProvider("invalid")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.provider).toBe("ollama")
    })
    it("clears invalid base url for cloud providers", async() => {
        store.setProvider("openai")
        store.setBaseUrl("not-a-url")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.baseUrl).toBe("")
    })
    it("keeps valid base url for cloud providers", async() => {
        store.setProvider("openai")
        store.setBaseUrl("https://api.openai.com")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.baseUrl).toBe("https://api.openai.com")
    })
    it("saves all fields", async() => {
        store.setModel("m")
        store.setProcessingType("conversation")
        store.setOutputFormat("text")
        store.setLanguage("fr")
        store.setChunkSize(1500)
        store.setConcurrency(2)
        store.setTemperature(0.3)
        store.setCustomPrompt("p")
        await store.savePreset()
        let saved = JSON.parse(localStorage.getItem("train-generator-settings") || "{}")
        expect(saved.model).toBe("m")
        expect(saved.processingType).toBe("conversation")
        expect(saved.outputFormat).toBe("text")
        expect(saved.language).toBe("fr")
        expect(saved.chunkSize).toBe(1500)
        expect(saved.concurrency).toBe(2)
        expect(saved.temperature).toBe(0.3)
        expect(saved.customPrompt).toBe("p")
    })
})
describe("SettingsStore app settings persistence", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("loads theme", () => {
        localStorage.setItem("training-generator-app-settings", JSON.stringify({ theme: "dark" }))
        store.loadAppSettings()
        expect(store.appSettings.theme).toBe("dark")
    })
    it("loads font size", () => {
        localStorage.setItem("training-generator-app-settings", JSON.stringify({ fontSize: "small" }))
        store.loadAppSettings()
        expect(store.appSettings.fontSize).toBe("small")
    })
    it("loads boolean flags", () => {
        localStorage.setItem("training-generator-app-settings", JSON.stringify({ autoSave: false, autoCheckOllama: false, startMaximized: true, rememberWindowSize: false, smartSizing: false }))
        store.loadAppSettings()
        expect(store.appSettings.autoSave).toBe(false)
        expect(store.appSettings.autoCheckOllama).toBe(false)
        expect(store.appSettings.startMaximized).toBe(true)
        expect(store.appSettings.rememberWindowSize).toBe(false)
        expect(store.appSettings.smartSizing).toBe(false)
    })
    it("clamps numeric app settings", () => {
        localStorage.setItem("training-generator-app-settings", JSON.stringify({ maxFileSize: 5, maxOutputItems: 500, maxChunks: 5, maxParallelFiles: 0 }))
        store.loadAppSettings()
        expect(store.appSettings.maxFileSize).toBe(100)
        expect(store.appSettings.maxOutputItems).toBe(100000)
        expect(store.appSettings.maxChunks).toBe(500)
        expect(store.appSettings.maxParallelFiles).toBe(1)
    })
    it("loads valid numeric app settings", () => {
        localStorage.setItem("training-generator-app-settings", JSON.stringify({ maxFileSize: 200, maxOutputItems: 50000, maxChunks: 1000, maxParallelFiles: 3 }))
        store.loadAppSettings()
        expect(store.appSettings.maxFileSize).toBe(200)
        expect(store.appSettings.maxOutputItems).toBe(50000)
        expect(store.appSettings.maxChunks).toBe(1000)
        expect(store.appSettings.maxParallelFiles).toBe(3)
    })
    it("loads ui language", () => {
        localStorage.setItem("train-generator-ui-lang", "ko")
        store.loadAppSettings()
        expect(document.documentElement.lang).toBe("ko")
    })
    it("saves app settings", () => {
        store.setTheme("light")
        store.saveAppSettings()
        let saved = JSON.parse(localStorage.getItem("training-generator-app-settings") || "{}")
        expect(saved.theme).toBe("light")
    })
    it("resets app settings", () => {
        store.setTheme("dark")
        store.setFontSize("large")
        store.resetAppSettings()
        expect(store.appSettings.theme).toBe("auto")
        expect(store.appSettings.fontSize).toBe("medium")
        let saved = JSON.parse(localStorage.getItem("training-generator-app-settings") || "{}")
        expect(saved.theme).toBe("auto")
    })
})
describe("SettingsStore appearance", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("applies light theme", () => {
        store.applyTheme("light")
        expect(document.body.classList.contains("theme-light")).toBe(true)
        expect(document.body.classList.contains("theme-dark")).toBe(false)
    })
    it("applies dark theme", () => {
        store.applyTheme("dark")
        expect(document.body.classList.contains("theme-dark")).toBe(true)
        expect(document.body.classList.contains("theme-light")).toBe(false)
    })
    it("applies auto theme", () => {
        stubMatchMedia(true)
        store.applyTheme("auto")
        expect(document.body.classList.contains("theme-dark")).toBe(true)
    })
    it("applies small font size", () => {
        store.applyFontSize("small")
        expect(document.body.classList.contains("font-small")).toBe(true)
    })
    it("applies medium font size", () => {
        store.applyFontSize("medium")
        expect(document.body.classList.contains("font-medium")).toBe(true)
    })
    it("applies large font size", () => {
        store.applyFontSize("large")
        expect(document.body.classList.contains("font-large")).toBe(true)
    })
})
describe("SettingsStore language", () => {
    beforeEach(() => {
        document.body.innerHTML = `<span data-i18n="app.title"></span>`
        document.documentElement.lang = "en"
        store = createSettingsStore()
    })
    it("applies language", () => {
        store.applyLanguage("es")
        expect(document.documentElement.lang).toBe("es")
    })
    it("stores language in localStorage", () => {
        store.applyLanguage("de")
        expect(localStorage.getItem("train-generator-ui-lang")).toBe("de")
    })
})
describe("SettingsStore temperature display", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("calculates display for zero", () => {
        let result = store.updateTemperatureDisplay(0)
        expect(result.text).toBe("0.0")
        expect(result.rangeFill).toBe("0%")
    })
    it("calculates display for midpoint", () => {
        let result = store.updateTemperatureDisplay(0.5)
        expect(result.text).toBe("0.5")
        expect(result.rangeFill).toBe("50%")
    })
    it("calculates display for maximum", () => {
        let result = store.updateTemperatureDisplay(1)
        expect(result.text).toBe("1.0")
        expect(result.rangeFill).toBe("100%")
    })
    it("clamps above maximum", () => {
        let result = store.updateTemperatureDisplay(5)
        expect(result.rangeFill).toBe("100%")
    })
    it("clamps below minimum", () => {
        let result = store.updateTemperatureDisplay(-2)
        expect(result.rangeFill).toBe("0%")
    })
    it("returns hsl color values", () => {
        let result = store.updateTemperatureDisplay(0.5)
        expect(result.temperatureColor).toContain("hsl")
        expect(result.temperatureColorHover).toContain("hsl")
        expect(result.temperatureShadow).toContain("hsla")
    })
})
describe("SettingsStore profiles", () => {
    beforeEach(() => {
        store = createSettingsStore()
    })
    it("lists profiles", async() => {
        await store.saveCurrentProfile("p1")
        await store.refreshProfiles()
        expect(store.profiles.length).toBeGreaterThan(0)
    })
    it("applies profile", async() => {
        store.setModel("base")
        await store.saveCurrentProfile("p1")
        store.setModel("changed")
        await store.applyProfile("p1")
        expect(store.settings.model).toBe("base")
        expect(store.selectedProfile()).toBe("p1")
    })
    it("ignores empty profile name", async() => {
        store.setModel("base")
        await store.applyProfile("")
        expect(store.settings.model).toBe("base")
    })
    it("ignores missing profile", async() => {
        await store.applyProfile("missing")
        expect(store.selectedProfile()).toBe("")
    })
    it("deletes current profile", async() => {
        await store.saveCurrentProfile("p1")
        await store.deleteCurrentProfile()
        expect(store.selectedProfile()).toBe("")
        expect(store.profiles.find(p => p.name === "p1")).toBeUndefined()
    })
    it("does nothing when deleting with no selection", async() => {
        await expect(store.deleteCurrentProfile()).resolves.not.toThrow()
    })
    it("saves profile with all fields", async() => {
        store.setModel("m")
        store.setProcessingType("conversation")
        store.setOutputFormat("csv")
        store.setLanguage("fr")
        store.setChunkSize(1500)
        store.setConcurrency(2)
        store.setProvider("openai")
        store.setBaseUrl("https://api.example.com")
        store.setSmartSizing(false)
        await store.saveCurrentProfile("full")
        let profile = store.profiles.find(p => p.name === "full")
        expect(profile).toBeDefined()
        expect(profile!.model).toBe("m")
        expect(profile!.processingType).toBe("conversation")
        expect(profile!.outputFormat).toBe("csv")
        expect(profile!.language).toBe("fr")
        expect(profile!.chunkSize).toBe("1500")
        expect(profile!.concurrency).toBe("2")
        expect(profile!.provider).toBe("openai")
        expect(profile!.baseUrl).toBe("https://api.example.com")
        expect(profile!.smartSizing).toBe(false)
    })
})
