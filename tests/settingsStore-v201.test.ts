// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createSettingsStore, type SettingsStore } from "../src/renderer/stores/settingsStore.js"
import { withRoot } from "./setup.js"

let disposes: Array<() => void> = []
function makeSettingsStore(): SettingsStore {
    return withRoot((dispose) => {
        const store = createSettingsStore()
        disposes.push(dispose)
        return store
    })
}

const APP_SETTINGS_KEY = "training-generator-app-settings"

function putAppSettings(data: Record<string, unknown>): void {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(data))
}

let store: SettingsStore
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    localStorage.clear()
    document.body.className = ""
    document.documentElement.lang = "en"
    vi.stubGlobal("window", {
        ...window,
        matchMedia: vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    })
})
afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
    vi.restoreAllMocks()
})

describe("SettingsStore v2.0.1 defaults", () => {
    it("has default output mode and export fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.outputFileMode).toBe("combined")
        expect(store.appSettings.outputFilenameTemplate).toBe("{source}")
        expect(store.appSettings.confirmBeforeExport).toBe(false)
        expect(store.appSettings.autoExportOnCompletion).toBe(false)
        expect(store.appSettings.maxItemsPerFile).toBe(50000)
        expect(store.appSettings.stripPiiBeforeExport).toBe(false)
        expect(store.appSettings.includeSourceMetadata).toBe(false)
    })

    it("has default appearance and accessibility fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.fontScale).toBe(100)
        expect(store.appSettings.compactMode).toBe(false)
        expect(store.appSettings.reducedMotion).toBe(false)
        expect(store.appSettings.highContrast).toBe(false)
        expect(store.appSettings.customCssPath).toBe("")
        expect(store.appSettings.verboseDashboard).toBe(false)
    })

    it("has default telemetry and update fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.disableTelemetry).toBe(false)
        expect(store.appSettings.disableCrashReports).toBe(false)
        expect(store.appSettings.disableAutoUpdate).toBe(false)
        expect(store.appSettings.updateCheckIntervalHours).toBe(24)
    })

    it("has default system and window fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.gpuAcceleration).toBe(true)
        expect(store.appSettings.sendToTrayOnClose).toBe(false)
        expect(store.appSettings.startOnLogin).toBe(false)
    })

    it("has default cache fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.cacheDir).toBe("")
        expect(store.appSettings.cacheMaxSizeMB).toBe(500)
        expect(store.appSettings.cacheTtlSeconds).toBe(86400)
        expect(store.appSettings.clearCacheOnExit).toBe(false)
    })

    it("has default generation tuning fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.retryCount).toBe(3)
        expect(store.appSettings.retryBackoffStrategy).toBe("exponential")
        expect(store.appSettings.requestTimeoutMs).toBe(60000)
        expect(store.appSettings.streamTimeoutMs).toBe(600000)
        expect(store.appSettings.abortOnError).toBe(false)
        expect(store.appSettings.topP).toBe(0.9)
        expect(store.appSettings.topK).toBe(40)
        expect(store.appSettings.repeatPenalty).toBe(1.1)
        expect(store.appSettings.seed).toBe(-1)
        expect(store.appSettings.systemPromptOverride).toBe("")
        expect(store.appSettings.stopSequences).toEqual([])
        expect(store.appSettings.bannedPhrases).toEqual([])
        expect(store.appSettings.requiredPhrases).toEqual([])
    })

    it("has default chunking fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.minChunkLength).toBe(200)
        expect(store.appSettings.maxChunkLength).toBe(8000)
        expect(store.appSettings.chunkOverlap).toBe(100)
        expect(store.appSettings.sentenceAwareChunking).toBe(true)
        expect(store.appSettings.preserveCodeBlocks).toBe(true)
        expect(store.appSettings.languageDetection).toBe(false)
        expect(store.appSettings.outputLanguageOverride).toBe("")
    })

    it("has default validation fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.skipDedup).toBe(false)
        expect(store.appSettings.dedupSimilarityThreshold).toBe(0.92)
        expect(store.appSettings.minQaPairsPerFile).toBe(1)
        expect(store.appSettings.maxQaPairsPerFile).toBe(1000)
        expect(store.appSettings.validationStrictness).toBe("normal")
        expect(store.appSettings.autoRegenerateOnLowQuality).toBe(false)
        expect(store.appSettings.regenerateThreshold).toBe(0.6)
        expect(store.appSettings.maxRegenerationAttempts).toBe(2)
    })

    it("has default logging fields", () => {
        store = makeSettingsStore()
        expect(store.appSettings.logToFile).toBe(false)
        expect(store.appSettings.logFilePath).toBe("")
    })
})

describe("SettingsStore v2.0.1 load valid values", () => {
    it("loads output mode and export fields", () => {
        putAppSettings({
            outputFileMode: "perFile",
            outputFilenameTemplate: "{source}-{format}",
            confirmBeforeExport: true,
            autoExportOnCompletion: true,
            maxItemsPerFile: 10000,
            stripPiiBeforeExport: true,
            includeSourceMetadata: true
        })
        store = makeSettingsStore()
        expect(store.appSettings.outputFileMode).toBe("perFile")
        expect(store.appSettings.outputFilenameTemplate).toBe("{source}-{format}")
        expect(store.appSettings.confirmBeforeExport).toBe(true)
        expect(store.appSettings.autoExportOnCompletion).toBe(true)
        expect(store.appSettings.maxItemsPerFile).toBe(10000)
        expect(store.appSettings.stripPiiBeforeExport).toBe(true)
        expect(store.appSettings.includeSourceMetadata).toBe(true)
    })

    it("loads appearance and accessibility fields", () => {
        putAppSettings({
            fontScale: 150,
            compactMode: true,
            reducedMotion: true,
            highContrast: true,
            customCssPath: "/path/to/custom.css",
            verboseDashboard: true
        })
        store = makeSettingsStore()
        expect(store.appSettings.fontScale).toBe(150)
        expect(store.appSettings.compactMode).toBe(true)
        expect(store.appSettings.reducedMotion).toBe(true)
        expect(store.appSettings.highContrast).toBe(true)
        expect(store.appSettings.customCssPath).toBe("/path/to/custom.css")
        expect(store.appSettings.verboseDashboard).toBe(true)
    })

    it("loads telemetry and update fields", () => {
        putAppSettings({
            disableTelemetry: true,
            disableCrashReports: true,
            disableAutoUpdate: true,
            updateCheckIntervalHours: 168
        })
        store = makeSettingsStore()
        expect(store.appSettings.disableTelemetry).toBe(true)
        expect(store.appSettings.disableCrashReports).toBe(true)
        expect(store.appSettings.disableAutoUpdate).toBe(true)
        expect(store.appSettings.updateCheckIntervalHours).toBe(168)
    })

    it("loads system and window fields", () => {
        putAppSettings({
            gpuAcceleration: false,
            sendToTrayOnClose: true,
            startOnLogin: true
        })
        store = makeSettingsStore()
        expect(store.appSettings.gpuAcceleration).toBe(false)
        expect(store.appSettings.sendToTrayOnClose).toBe(true)
        expect(store.appSettings.startOnLogin).toBe(true)
    })

    it("loads cache fields", () => {
        putAppSettings({
            cacheDir: "/custom/cache",
            cacheMaxSizeMB: 2000,
            cacheTtlSeconds: 3600,
            clearCacheOnExit: true
        })
        store = makeSettingsStore()
        expect(store.appSettings.cacheDir).toBe("/custom/cache")
        expect(store.appSettings.cacheMaxSizeMB).toBe(2000)
        expect(store.appSettings.cacheTtlSeconds).toBe(3600)
        expect(store.appSettings.clearCacheOnExit).toBe(true)
    })

    it("loads generation tuning fields", () => {
        putAppSettings({
            retryCount: 5,
            retryBackoffStrategy: "linear",
            requestTimeoutMs: 120000,
            streamTimeoutMs: 300000,
            abortOnError: true,
            topP: 0.8,
            topK: 50,
            repeatPenalty: 1.2,
            seed: 42,
            systemPromptOverride: "Custom system prompt",
            stopSequences: ["END", "STOP"],
            bannedPhrases: ["spam", "junk"],
            requiredPhrases: ["important"]
        })
        store = makeSettingsStore()
        expect(store.appSettings.retryCount).toBe(5)
        expect(store.appSettings.retryBackoffStrategy).toBe("linear")
        expect(store.appSettings.requestTimeoutMs).toBe(120000)
        expect(store.appSettings.streamTimeoutMs).toBe(300000)
        expect(store.appSettings.abortOnError).toBe(true)
        expect(store.appSettings.topP).toBe(0.8)
        expect(store.appSettings.topK).toBe(50)
        expect(store.appSettings.repeatPenalty).toBe(1.2)
        expect(store.appSettings.seed).toBe(42)
        expect(store.appSettings.systemPromptOverride).toBe("Custom system prompt")
        expect(store.appSettings.stopSequences).toEqual(["END", "STOP"])
        expect(store.appSettings.bannedPhrases).toEqual(["spam", "junk"])
        expect(store.appSettings.requiredPhrases).toEqual(["important"])
    })

    it("loads chunking fields", () => {
        putAppSettings({
            minChunkLength: 500,
            maxChunkLength: 16000,
            chunkOverlap: 200,
            sentenceAwareChunking: false,
            preserveCodeBlocks: false,
            languageDetection: true,
            outputLanguageOverride: "fr"
        })
        store = makeSettingsStore()
        expect(store.appSettings.minChunkLength).toBe(500)
        expect(store.appSettings.maxChunkLength).toBe(16000)
        expect(store.appSettings.chunkOverlap).toBe(200)
        expect(store.appSettings.sentenceAwareChunking).toBe(false)
        expect(store.appSettings.preserveCodeBlocks).toBe(false)
        expect(store.appSettings.languageDetection).toBe(true)
        expect(store.appSettings.outputLanguageOverride).toBe("fr")
    })

    it("loads validation fields", () => {
        putAppSettings({
            skipDedup: true,
            dedupSimilarityThreshold: 0.95,
            minQaPairsPerFile: 5,
            maxQaPairsPerFile: 5000,
            validationStrictness: "strict",
            autoRegenerateOnLowQuality: true,
            regenerateThreshold: 0.8,
            maxRegenerationAttempts: 4
        })
        store = makeSettingsStore()
        expect(store.appSettings.skipDedup).toBe(true)
        expect(store.appSettings.dedupSimilarityThreshold).toBe(0.95)
        expect(store.appSettings.minQaPairsPerFile).toBe(5)
        expect(store.appSettings.maxQaPairsPerFile).toBe(5000)
        expect(store.appSettings.validationStrictness).toBe("strict")
        expect(store.appSettings.autoRegenerateOnLowQuality).toBe(true)
        expect(store.appSettings.regenerateThreshold).toBe(0.8)
        expect(store.appSettings.maxRegenerationAttempts).toBe(4)
    })

    it("loads logging fields", () => {
        putAppSettings({
            logToFile: true,
            logFilePath: "/var/log/tg"
        })
        store = makeSettingsStore()
        expect(store.appSettings.logToFile).toBe(true)
        expect(store.appSettings.logFilePath).toBe("/var/log/tg")
    })
})

describe("SettingsStore v2.0.1 load invalid numeric values clamps to defaults", () => {
    it("clamps fontScale below minimum to default", () => {
        putAppSettings({ fontScale: 10 })
        store = makeSettingsStore()
        expect(store.appSettings.fontScale).toBe(100)
    })

    it("clamps fontScale above maximum to default", () => {
        putAppSettings({ fontScale: 500 })
        store = makeSettingsStore()
        expect(store.appSettings.fontScale).toBe(100)
    })

    it("clamps maxItemsPerFile below minimum to default", () => {
        putAppSettings({ maxItemsPerFile: 5 })
        store = makeSettingsStore()
        expect(store.appSettings.maxItemsPerFile).toBe(50000)
    })

    it("clamps updateCheckIntervalHours below minimum to default", () => {
        putAppSettings({ updateCheckIntervalHours: 0 })
        store = makeSettingsStore()
        expect(store.appSettings.updateCheckIntervalHours).toBe(24)
    })

    it("clamps cacheMaxSizeMB above maximum to default", () => {
        putAppSettings({ cacheMaxSizeMB: 999999 })
        store = makeSettingsStore()
        expect(store.appSettings.cacheMaxSizeMB).toBe(500)
    })

    it("clamps cacheTtlSeconds below minimum to default", () => {
        putAppSettings({ cacheTtlSeconds: 5 })
        store = makeSettingsStore()
        expect(store.appSettings.cacheTtlSeconds).toBe(86400)
    })

    it("clamps retryCount above maximum to default", () => {
        putAppSettings({ retryCount: 99 })
        store = makeSettingsStore()
        expect(store.appSettings.retryCount).toBe(3)
    })

    it("clamps requestTimeoutMs below minimum to default", () => {
        putAppSettings({ requestTimeoutMs: 100 })
        store = makeSettingsStore()
        expect(store.appSettings.requestTimeoutMs).toBe(60000)
    })

    it("clamps streamTimeoutMs above maximum to default", () => {
        putAppSettings({ streamTimeoutMs: 999999999 })
        store = makeSettingsStore()
        expect(store.appSettings.streamTimeoutMs).toBe(600000)
    })

    it("clamps topP above maximum to default", () => {
        putAppSettings({ topP: 5 })
        store = makeSettingsStore()
        expect(store.appSettings.topP).toBe(0.9)
    })

    it("clamps topK below minimum to default", () => {
        putAppSettings({ topK: 0 })
        store = makeSettingsStore()
        expect(store.appSettings.topK).toBe(40)
    })

    it("clamps repeatPenalty below minimum to default", () => {
        putAppSettings({ repeatPenalty: 0.1 })
        store = makeSettingsStore()
        expect(store.appSettings.repeatPenalty).toBe(1.1)
    })

    it("clamps minChunkLength above maximum to default", () => {
        putAppSettings({ minChunkLength: 99999 })
        store = makeSettingsStore()
        expect(store.appSettings.minChunkLength).toBe(200)
    })

    it("clamps maxChunkLength below minimum to default", () => {
        putAppSettings({ maxChunkLength: 10 })
        store = makeSettingsStore()
        expect(store.appSettings.maxChunkLength).toBe(8000)
    })

    it("clamps chunkOverlap above maximum to default", () => {
        putAppSettings({ chunkOverlap: 5000 })
        store = makeSettingsStore()
        expect(store.appSettings.chunkOverlap).toBe(100)
    })

    it("clamps dedupSimilarityThreshold below minimum to default", () => {
        putAppSettings({ dedupSimilarityThreshold: 0.1 })
        store = makeSettingsStore()
        expect(store.appSettings.dedupSimilarityThreshold).toBe(0.92)
    })

    it("clamps minQaPairsPerFile above maximum to default", () => {
        putAppSettings({ minQaPairsPerFile: 99999 })
        store = makeSettingsStore()
        expect(store.appSettings.minQaPairsPerFile).toBe(1)
    })

    it("clamps maxQaPairsPerFile below minimum to default", () => {
        putAppSettings({ maxQaPairsPerFile: 0 })
        store = makeSettingsStore()
        expect(store.appSettings.maxQaPairsPerFile).toBe(1000)
    })

    it("clamps regenerateThreshold above maximum to default", () => {
        putAppSettings({ regenerateThreshold: 5 })
        store = makeSettingsStore()
        expect(store.appSettings.regenerateThreshold).toBe(0.6)
    })

    it("clamps maxRegenerationAttempts below minimum to default", () => {
        putAppSettings({ maxRegenerationAttempts: -1 })
        store = makeSettingsStore()
        expect(store.appSettings.maxRegenerationAttempts).toBe(2)
    })

    it("rejects NaN numeric values and uses default", () => {
        putAppSettings({ fontScale: "not-a-number" })
        store = makeSettingsStore()
        expect(store.appSettings.fontScale).toBe(100)
    })
})

describe("SettingsStore v2.0.1 load invalid enum values fall back to default", () => {
    it("rejects invalid outputFileMode and keeps default", () => {
        putAppSettings({ outputFileMode: "invalid" })
        store = makeSettingsStore()
        expect(store.appSettings.outputFileMode).toBe("combined")
    })

    it("rejects invalid retryBackoffStrategy and keeps default", () => {
        putAppSettings({ retryBackoffStrategy: "unknown" })
        store = makeSettingsStore()
        expect(store.appSettings.retryBackoffStrategy).toBe("exponential")
    })

    it("rejects invalid validationStrictness and keeps default", () => {
        putAppSettings({ validationStrictness: "ultra" })
        store = makeSettingsStore()
        expect(store.appSettings.validationStrictness).toBe("normal")
    })

    it("rejects non-array stopSequences and keeps default", () => {
        putAppSettings({ stopSequences: "not-an-array" })
        store = makeSettingsStore()
        expect(store.appSettings.stopSequences).toEqual([])
    })

    it("rejects non-array bannedPhrases and keeps default", () => {
        putAppSettings({ bannedPhrases: "not-an-array" })
        store = makeSettingsStore()
        expect(store.appSettings.bannedPhrases).toEqual([])
    })

    it("rejects non-array requiredPhrases and keeps default", () => {
        putAppSettings({ requiredPhrases: 123 })
        store = makeSettingsStore()
        expect(store.appSettings.requiredPhrases).toEqual([])
    })

    it("rejects non-string customCssPath and keeps default", () => {
        putAppSettings({ customCssPath: 123 })
        store = makeSettingsStore()
        expect(store.appSettings.customCssPath).toBe("")
    })

    it("rejects non-string logFilePath and keeps default", () => {
        putAppSettings({ logFilePath: false })
        store = makeSettingsStore()
        expect(store.appSettings.logFilePath).toBe("")
    })
})

describe("SettingsStore v2.0.1 save and reload preserves values", () => {
    it("saves and reloads output mode fields", () => {
        store = makeSettingsStore()
        store.setAppSetting("outputFileMode", "perFile")
        store.setAppSetting("outputFilenameTemplate", "{source}-{date}")
        store.setAppSetting("confirmBeforeExport", true)
        store.setAppSetting("maxItemsPerFile", 25000)
        store.saveAppSettings()
        const saved = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}")
        expect(saved.outputFileMode).toBe("perFile")
        expect(saved.outputFilenameTemplate).toBe("{source}-{date}")
        expect(saved.confirmBeforeExport).toBe(true)
        expect(saved.maxItemsPerFile).toBe(25000)
    })

    it("saves and reloads generation tuning fields", () => {
        store = makeSettingsStore()
        store.setAppSetting("retryCount", 7)
        store.setAppSetting("retryBackoffStrategy", "fixed")
        store.setAppSetting("topP", 0.5)
        store.setAppSetting("topK", 100)
        store.setAppSetting("seed", 12345)
        store.saveAppSettings()
        const saved = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}")
        expect(saved.retryCount).toBe(7)
        expect(saved.retryBackoffStrategy).toBe("fixed")
        expect(saved.topP).toBe(0.5)
        expect(saved.topK).toBe(100)
        expect(saved.seed).toBe(12345)
    })

    it("saves and reloads validation fields", () => {
        store = makeSettingsStore()
        store.setAppSetting("validationStrictness", "strict")
        store.setAppSetting("dedupSimilarityThreshold", 0.98)
        store.setAppSetting("autoRegenerateOnLowQuality", true)
        store.saveAppSettings()
        const saved = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}")
        expect(saved.validationStrictness).toBe("strict")
        expect(saved.dedupSimilarityThreshold).toBe(0.98)
        expect(saved.autoRegenerateOnLowQuality).toBe(true)
    })

    it("saves and reloads array fields", () => {
        store = makeSettingsStore()
        store.setAppSetting("stopSequences", ["<end>", "</s>"])
        store.setAppSetting("bannedPhrases", ["foo"])
        store.setAppSetting("requiredPhrases", ["bar", "baz"])
        store.saveAppSettings()
        const saved = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}")
        expect(saved.stopSequences).toEqual(["<end>", "</s>"])
        expect(saved.bannedPhrases).toEqual(["foo"])
        expect(saved.requiredPhrases).toEqual(["bar", "baz"])
    })
})

describe("SettingsStore v2.0.1 migration from v2.0.0", () => {
    it("uses defaults when v2.0.0 settings have no v2.0.1 fields", () => {
        // Simulate a v2.0.0 settings object with only legacy fields
        putAppSettings({
            theme: "dark",
            fontSize: "large",
            autoSave: true,
            autoCheckOllama: true,
            startMaximized: true,
            rememberWindowSize: false
        })
        store = makeSettingsStore()
        // Legacy fields should load
        expect(store.appSettings.theme).toBe("dark")
        expect(store.appSettings.fontSize).toBe("large")
        expect(store.appSettings.autoSave).toBe(true)
        expect(store.appSettings.startMaximized).toBe(true)
        expect(store.appSettings.rememberWindowSize).toBe(false)
        // v2.0.1 fields should be defaults
        expect(store.appSettings.outputFileMode).toBe("combined")
        expect(store.appSettings.outputFilenameTemplate).toBe("{source}")
        expect(store.appSettings.fontScale).toBe(100)
        expect(store.appSettings.compactMode).toBe(false)
        expect(store.appSettings.retryCount).toBe(3)
        expect(store.appSettings.retryBackoffStrategy).toBe("exponential")
        expect(store.appSettings.validationStrictness).toBe("normal")
        expect(store.appSettings.dedupSimilarityThreshold).toBe(0.92)
        expect(store.appSettings.cacheMaxSizeMB).toBe(500)
        expect(store.appSettings.cacheTtlSeconds).toBe(86400)
        expect(store.appSettings.logToFile).toBe(false)
        expect(store.appSettings.stopSequences).toEqual([])
    })

    it("uses defaults when localStorage is empty", () => {
        store = makeSettingsStore()
        expect(store.appSettings.outputFileMode).toBe("combined")
        expect(store.appSettings.fontScale).toBe(100)
        expect(store.appSettings.retryCount).toBe(3)
        expect(store.appSettings.validationStrictness).toBe("normal")
    })

    it("handles corrupted JSON gracefully and uses defaults", () => {
        localStorage.setItem(APP_SETTINGS_KEY, "{corrupted json")
        store = makeSettingsStore()
        expect(store.appSettings.outputFileMode).toBe("combined")
        expect(store.appSettings.fontScale).toBe(100)
        expect(store.appSettings.retryCount).toBe(3)
    })
})

describe("SettingsStore v2.0.1 resetAppSettings restores defaults", () => {
    it("resets all v2.0.1 fields to defaults", () => {
        store = makeSettingsStore()
        store.setAppSetting("outputFileMode", "perFile")
        store.setAppSetting("fontScale", 150)
        store.setAppSetting("retryCount", 10)
        store.setAppSetting("validationStrictness", "strict")
        store.setAppSetting("compactMode", true)
        store.setAppSetting("gpuAcceleration", false)
        store.setAppSetting("cacheMaxSizeMB", 2000)
        store.setAppSetting("logToFile", true)
        store.resetAppSettings()
        expect(store.appSettings.outputFileMode).toBe("combined")
        expect(store.appSettings.fontScale).toBe(100)
        expect(store.appSettings.retryCount).toBe(3)
        expect(store.appSettings.validationStrictness).toBe("normal")
        expect(store.appSettings.compactMode).toBe(false)
        expect(store.appSettings.gpuAcceleration).toBe(true)
        expect(store.appSettings.cacheMaxSizeMB).toBe(500)
        expect(store.appSettings.logToFile).toBe(false)
    })
})
