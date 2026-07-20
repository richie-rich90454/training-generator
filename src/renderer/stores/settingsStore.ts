import { createStore } from "solid-js/store"
import { createSignal, createMemo, createEffect } from "solid-js"
import type { AppSettings, FullAppSettings } from "../../types/index.js"
import { applyLanguage } from "../i18n.js"
import { encryptKey, decryptKey } from "../security.js"
import { listProfiles, saveProfile, loadProfile, deleteProfile } from "../configProfiles.js"
import type { ConfigProfile } from "../configProfiles.js"
import { logger } from "../logger.js"
const SETTINGS_KEY = "train-generator-settings"
const APP_SETTINGS_KEY = "training-generator-app-settings"
const UI_LANG_KEY = "train-generator-ui-lang"
const VALID_PROCESSING_TYPES = ["instruction", "conversation", "chunking", "custom"]
const VALID_OUTPUT_FORMATS = ["jsonl", "json", "chatml", "text", "csv"]
const VALID_LANGUAGES = ["en", "zh-Hans", "zh-Hant", "es", "fr", "de", "ja", "ko"]
const VALID_PROVIDERS = ["ollama", "openai", "anthropic", "gemini"]
function clamp(n: number, min: number, max: number, def: number): number {
    const value = Number(n)
    if (!Number.isFinite(value)) return def
    return Math.min(max, Math.max(min, value))
}
export interface SettingsStore {
    settings: AppSettings
    appSettings: FullAppSettings
    profiles: ConfigProfile[]
    selectedProfile: () => string
    apiKeyPlain: () => string
    isCloudProvider: () => boolean
    setModel: (model: string) => void
    setProcessingType: (type: string) => void
    setOutputFormat: (format: string) => void
    setLanguage: (lang: string) => void
    setChunkSize: (size: number) => void
    setConcurrency: (concurrency: number) => void
    setProvider: (provider: string) => void
    setApiKey: (key: string) => void
    setBaseUrl: (url: string) => void
    setTemperature: (temp: number) => void
    setCustomPrompt: (prompt: string) => void
    setOllamaHost: (host: string) => void
    setOllamaPort: (port: number) => void
    setTheme: (theme: string) => void
    setFontSize: (size: string) => void
    setAutoSave: (value: boolean) => void
    setAutoCheckOllama: (value: boolean) => void
    setStartMaximized: (value: boolean) => void
    setRememberWindowSize: (value: boolean) => void
    setSmartSizing: (value: boolean) => void
    setMaxFileSize: (size: number) => void
    setMaxOutputItems: (count: number) => void
    setMaxChunks: (count: number) => void
    setMaxParallelFiles: (count: number) => void
    setEnableThinking: (value: boolean) => void
    setAppSetting: <K extends keyof FullAppSettings>(key: K, value: FullAppSettings[K]) => void
    setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
    loadSettings: () => Promise<void>
    savePreset: () => Promise<void>
    loadAppSettings: () => void
    saveAppSettings: () => void
    resetAppSettings: () => void
    applyProfile: (name: string) => Promise<void>
    saveCurrentProfile: (name: string) => Promise<void>
    deleteCurrentProfile: () => Promise<void>
    refreshProfiles: () => Promise<void>
    applyTheme: (theme: string) => void
    applyFontSize: (size: string) => void
    applyReducedMotion: (enabled: boolean) => void
    applyLanguage: (lang: string) => void
    updateTemperatureDisplay: (temp: number) => { rangeFill: string; temperatureColor: string; temperatureColorHover: string; temperatureShadow: string; text: string }
}
export function createSettingsStore(): SettingsStore {
    // Per-instance media listener so multiple settingsStore instances don't
    // remove each other's matchMedia change listeners.
    let mediaListener: ((e: MediaQueryListEvent) => void) | null = null
    const [settings, setSettings] = createStore<AppSettings>({
        model: "",
        processingType: "instruction",
        outputFormat: "jsonl",
        language: "en",
        chunkSize: 2000,
        concurrency: 3,
        provider: "ollama",
        apiKey: "",
        baseUrl: "",
        temperature: 0.7,
        customPrompt: "",
        ollamaHost: "localhost",
        ollamaPort: 11434,
        // v2.0.1 defaults — output mode & export
        outputFileMode: "combined",
        outputFilenameTemplate: "{source}",
        confirmBeforeExport: false,
        autoExportOnCompletion: false,
        maxItemsPerFile: 50000,
        stripPiiBeforeExport: false,
        includeSourceMetadata: false,
        // v2.0.1 defaults — appearance & accessibility
        fontScale: 100,
        compactMode: false,
        reducedMotion: false,
        highContrast: false,
        customCssPath: "",
        verboseDashboard: false,
        // v2.0.1 defaults — telemetry & updates
        disableTelemetry: false,
        disableCrashReports: false,
        disableAutoUpdate: false,
        updateCheckIntervalHours: 24,
        // v2.0.1 defaults — system & window
        gpuAcceleration: true,
        sendToTrayOnClose: false,
        startOnLogin: false,
        // v2.0.1 defaults — cache
        cacheDir: "",
        cacheMaxSizeMB: 500,
        cacheTtlSeconds: 86400,
        clearCacheOnExit: false,
        // v2.0.1 defaults — generation tuning
        retryCount: 3,
        retryBackoffStrategy: "exponential",
        requestTimeoutMs: 60000,
        streamTimeoutMs: 600000,
        abortOnError: false,
        topP: 0.9,
        topK: 40,
        repeatPenalty: 1.1,
        seed: -1,
        systemPromptOverride: "",
        stopSequences: [],
        bannedPhrases: [],
        requiredPhrases: [],
        // v2.0.1 defaults — chunking
        minChunkLength: 200,
        maxChunkLength: 8000,
        chunkOverlap: 100,
        sentenceAwareChunking: true,
        preserveCodeBlocks: true,
        languageDetection: false,
        outputLanguageOverride: "",
        // v2.0.1 defaults — validation
        skipDedup: false,
        dedupSimilarityThreshold: 0.92,
        minQaPairsPerFile: 1,
        maxQaPairsPerFile: 1000,
        validationStrictness: "normal",
        autoRegenerateOnLowQuality: false,
        regenerateThreshold: 0.6,
        maxRegenerationAttempts: 2,
        // v2.0.1 defaults — logging
        logToFile: false,
        logFilePath: ""
    })
    const [appSettings, setAppSettings] = createStore<FullAppSettings>({
        theme: "auto",
        fontSize: "medium",
        autoSave: true,
        autoCheckOllama: true,
        startMaximized: false,
        rememberWindowSize: true,
        smartSizing: true,
        maxFileSize: 100,
        maxOutputItems: 100000,
        maxChunks: 500,
        maxParallelFiles: 1,
        enableThinking: false,
        // v2.0.1 defaults — output mode & export
        outputFileMode: "combined",
        outputFilenameTemplate: "{source}",
        confirmBeforeExport: false,
        autoExportOnCompletion: false,
        maxItemsPerFile: 50000,
        stripPiiBeforeExport: false,
        includeSourceMetadata: false,
        // v2.0.1 defaults — appearance & accessibility
        fontScale: 100,
        compactMode: false,
        reducedMotion: false,
        highContrast: false,
        customCssPath: "",
        verboseDashboard: false,
        // v2.0.1 defaults — telemetry & updates
        disableTelemetry: false,
        disableCrashReports: false,
        disableAutoUpdate: false,
        updateCheckIntervalHours: 24,
        // v2.0.1 defaults — system & window
        gpuAcceleration: true,
        sendToTrayOnClose: false,
        startOnLogin: false,
        // v2.0.1 defaults — cache
        cacheDir: "",
        cacheMaxSizeMB: 500,
        cacheTtlSeconds: 86400,
        clearCacheOnExit: false,
        // v2.0.1 defaults — generation tuning
        retryCount: 3,
        retryBackoffStrategy: "exponential",
        requestTimeoutMs: 60000,
        streamTimeoutMs: 600000,
        abortOnError: false,
        topP: 0.9,
        topK: 40,
        repeatPenalty: 1.1,
        seed: -1,
        systemPromptOverride: "",
        stopSequences: [],
        bannedPhrases: [],
        requiredPhrases: [],
        // v2.0.1 defaults — chunking
        minChunkLength: 200,
        maxChunkLength: 8000,
        chunkOverlap: 100,
        sentenceAwareChunking: true,
        preserveCodeBlocks: true,
        languageDetection: false,
        outputLanguageOverride: "",
        // v2.0.1 defaults — validation
        skipDedup: false,
        dedupSimilarityThreshold: 0.92,
        minQaPairsPerFile: 1,
        maxQaPairsPerFile: 1000,
        validationStrictness: "normal",
        autoRegenerateOnLowQuality: false,
        regenerateThreshold: 0.6,
        maxRegenerationAttempts: 2,
        // v2.0.1 defaults — logging
        logToFile: false,
        logFilePath: ""
    })
    const [profiles, setProfiles] = createStore<ConfigProfile[]>([])
    const [selectedProfile, setSelectedProfile] = createSignal<string>("")
    const [apiKeyPlain, setApiKeyPlain] = createSignal<string>("")
    const isCloudProvider = createMemo(() => settings.provider !== "ollama")
    function applyTheme(theme: string): void {
        if (mediaListener) {
            const mql = window.matchMedia("(prefers-color-scheme:dark)")
            mql.removeEventListener("change", mediaListener)
            mediaListener = null
        }
        document.body.classList.remove("theme-light", "theme-dark")
        const apply = (isDark: boolean) => {
            document.body.classList.add(isDark ? "theme-dark" : "theme-light")
        }
        if (theme === "light") {
            apply(false)
        }
        else if (theme === "dark") {
            apply(true)
        }
        else {
            const mql = window.matchMedia("(prefers-color-scheme:dark)")
            apply(mql.matches)
            mediaListener = (e: MediaQueryListEvent) => apply(e.matches)
            mql.addEventListener("change", mediaListener)
        }
    }
    function applyFontSize(size: string): void {
        document.body.classList.remove("font-small", "font-medium", "font-large")
        if (size === "small") {
            document.body.classList.add("font-small")
        }
        else if (size === "large") {
            document.body.classList.add("font-large")
        }
        else {
            document.body.classList.add("font-medium")
        }
    }
    function applyReducedMotion(enabled: boolean): void {
        // Mirrors the OS-level `prefers-reduced-motion: reduce` media query
        // so users can opt in via settings even when their OS doesn't signal it.
        if (enabled) {
            document.body.classList.add("reduced-motion")
        }
        else {
            document.body.classList.remove("reduced-motion")
        }
    }
    function applyLanguageLocal(lang: string): void {
        applyLanguage(lang)
        localStorage.setItem(UI_LANG_KEY, lang)
    }
    function updateTemperatureDisplay(temp: number): { rangeFill: string; temperatureColor: string; temperatureColorHover: string; temperatureShadow: string; text: string } {
        const value = Math.max(0, Math.min(1, temp))
        const percentage = value * 100
        const normalized = value
        const hue = 220 - normalized * 190
        const saturation = 80
        const lightness = 55
        const color = "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)"
        const hover = "hsl(" + hue + ", " + saturation + "%, " + (lightness - 8) + "%)"
        const shadow = "hsla(" + hue + ", " + saturation + "%, " + lightness + "%, .25)"
        return {
            rangeFill: percentage + "%",
            temperatureColor: color,
            temperatureColorHover: hover,
            temperatureShadow: shadow,
            text: value.toFixed(1)
        }
    }
    async function loadSettings(): Promise<void> {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY)
            const saved: AppSettings = raw ? JSON.parse(raw) : {}
            if (saved.model && typeof saved.model === "string") setSettings("model", saved.model)
            if (saved.processingType && VALID_PROCESSING_TYPES.includes(saved.processingType)) setSettings("processingType", saved.processingType)
            if (saved.outputFormat && VALID_OUTPUT_FORMATS.includes(saved.outputFormat)) setSettings("outputFormat", saved.outputFormat)
            if (saved.language && VALID_LANGUAGES.includes(saved.language)) setSettings("language", saved.language)
            if (saved.chunkSize != null) {
                setSettings("chunkSize", clamp(saved.chunkSize, 500, 10000, 2000))
            }
            if (saved.concurrency != null) {
                setSettings("concurrency", clamp(saved.concurrency, 1, 10, 3))
            }
            if (saved.provider && VALID_PROVIDERS.includes(saved.provider)) setSettings("provider", saved.provider)
            if (saved.baseUrl && typeof saved.baseUrl === "string" && /^https?:\/\//.test(saved.baseUrl)) setSettings("baseUrl", saved.baseUrl)
            if (saved.temperature != null) {
                setSettings("temperature", clamp(saved.temperature, 0, 1, 0.7))
            }
            if (saved.customPrompt && typeof saved.customPrompt === "string") setSettings("customPrompt", saved.customPrompt)
            if (saved.ollamaHost && typeof saved.ollamaHost === "string" && saved.ollamaHost.trim().length > 0) {
                setSettings("ollamaHost", saved.ollamaHost.trim())
            }
            if (saved.ollamaPort != null) {
                setSettings("ollamaPort", clamp(saved.ollamaPort, 1, 65535, 11434))
            }
            if (saved.apiKey) {
                const decrypted = await decryptKey(saved.apiKey)
                if (decrypted != null) {
                    setApiKeyPlain(decrypted)
                    if (decrypted === saved.apiKey && decrypted.length > 0) {
                        const encrypted = await encryptKey(decrypted)
                        setSettings("apiKey", encrypted)
                        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, apiKey: encrypted }))
                    }
                    else {
                        setSettings("apiKey", saved.apiKey)
                    }
                }
                else {
                    setApiKeyPlain("")
                }
            }
        }
        catch (error) {
            logger.error("Failed to load settings:", error)
        }
    }
    async function savePreset(): Promise<void> {
        try {
            let encryptedApiKey = ""
            const key = apiKeyPlain()
            if (key) {
                encryptedApiKey = await encryptKey(key)
            }
            let provider = settings.provider
            if (!VALID_PROVIDERS.includes(provider || "")) {
                provider = "ollama"
            }
            let baseUrl = settings.baseUrl || ""
            if (provider !== "ollama" && baseUrl && !/^https?:\/\//.test(baseUrl)) {
                baseUrl = ""
            }
            const toSave: AppSettings = {
                ...settings,
                provider,
                apiKey: encryptedApiKey,
                baseUrl
            }
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave))
        }
        catch (error) {
            logger.error("Error in savePreset:", error)
        }
    }
    function loadAppSettings(): void {
        try {
            const raw = localStorage.getItem(APP_SETTINGS_KEY)
            const saved: FullAppSettings = raw ? JSON.parse(raw) : {}
            if (saved.theme) {
                setAppSettings("theme", saved.theme)
                applyTheme(saved.theme)
            }
            if (saved.fontSize) {
                setAppSettings("fontSize", saved.fontSize)
                applyFontSize(saved.fontSize)
            }
            const boolKeys: Array<keyof FullAppSettings> = [
                "autoSave", "autoCheckOllama", "startMaximized", "rememberWindowSize", "smartSizing", "enableThinking",
                // v2.0.1 — output mode & export
                "confirmBeforeExport", "autoExportOnCompletion", "stripPiiBeforeExport", "includeSourceMetadata",
                // v2.0.1 — appearance & accessibility
                "compactMode", "reducedMotion", "highContrast", "verboseDashboard",
                // v2.0.1 — telemetry & updates
                "disableTelemetry", "disableCrashReports", "disableAutoUpdate",
                // v2.0.1 — system & window
                "gpuAcceleration", "sendToTrayOnClose", "startOnLogin",
                // v2.0.1 — cache
                "clearCacheOnExit",
                // v2.0.1 — generation tuning
                "abortOnError",
                // v2.0.1 — chunking
                "sentenceAwareChunking", "preserveCodeBlocks", "languageDetection",
                // v2.0.1 — validation
                "skipDedup", "autoRegenerateOnLowQuality",
                // v2.0.1 — logging
                "logToFile"
            ]
            for (const key of boolKeys) {
                if (saved[key] !== undefined) {
                    setAppSettings(key, saved[key] as boolean)
                }
            }
            const numKeys: Array<{ key: keyof FullAppSettings, min: number, max: number, def: number }> = [
                { key: "maxFileSize", min: 10, max: 1000, def: 100 },
                { key: "maxOutputItems", min: 1000, max: 1000000, def: 100000 },
                { key: "maxChunks", min: 10, max: 5000, def: 500 },
                { key: "maxParallelFiles", min: 1, max: 10, def: 1 },
                // v2.0.1 — output mode & export
                { key: "maxItemsPerFile", min: 100, max: 1000000, def: 50000 },
                // v2.0.1 — appearance & accessibility
                { key: "fontScale", min: 50, max: 200, def: 100 },
                // v2.0.1 — telemetry & updates
                { key: "updateCheckIntervalHours", min: 1, max: 720, def: 24 },
                // v2.0.1 — cache
                { key: "cacheMaxSizeMB", min: 10, max: 10000, def: 500 },
                { key: "cacheTtlSeconds", min: 60, max: 604800, def: 86400 },
                // v2.0.1 — generation tuning
                { key: "retryCount", min: 0, max: 10, def: 3 },
                { key: "requestTimeoutMs", min: 1000, max: 600000, def: 60000 },
                { key: "streamTimeoutMs", min: 1000, max: 3600000, def: 600000 },
                { key: "topP", min: 0, max: 1, def: 0.9 },
                { key: "topK", min: 1, max: 1000, def: 40 },
                { key: "repeatPenalty", min: 0.5, max: 2, def: 1.1 },
                { key: "seed", min: -1, max: 2147483647, def: -1 },
                // v2.0.1 — chunking
                { key: "minChunkLength", min: 50, max: 10000, def: 200 },
                { key: "maxChunkLength", min: 500, max: 100000, def: 8000 },
                { key: "chunkOverlap", min: 0, max: 1000, def: 100 },
                // v2.0.1 — validation
                { key: "dedupSimilarityThreshold", min: 0.5, max: 1, def: 0.92 },
                { key: "minQaPairsPerFile", min: 1, max: 10000, def: 1 },
                { key: "maxQaPairsPerFile", min: 1, max: 100000, def: 1000 },
                { key: "regenerateThreshold", min: 0, max: 1, def: 0.6 },
                { key: "maxRegenerationAttempts", min: 0, max: 10, def: 2 }
            ]
            for (const { key, min, max, def } of numKeys) {
                if (saved[key] !== undefined) {
                    const n = Number(saved[key])
                    if (Number.isFinite(n) && n >= min && n <= max) {
                        setAppSettings(key, n)
                    }
                    else {
                        setAppSettings(key, def)
                    }
                }
            }
            // v2.0.1 — string fields
            const strKeys: Array<keyof FullAppSettings> = [
                "customCssPath", "cacheDir", "systemPromptOverride", "outputLanguageOverride", "logFilePath", "outputFilenameTemplate"
            ]
            for (const key of strKeys) {
                if (typeof saved[key] === "string") {
                    setAppSettings(key, saved[key] as string)
                }
            }
            // v2.0.1 — enum fields
            if (saved.outputFileMode === "combined" || saved.outputFileMode === "perFile") {
                setAppSettings("outputFileMode", saved.outputFileMode)
            }
            if (saved.retryBackoffStrategy === "fixed" || saved.retryBackoffStrategy === "linear" || saved.retryBackoffStrategy === "exponential") {
                setAppSettings("retryBackoffStrategy", saved.retryBackoffStrategy)
            }
            if (saved.validationStrictness === "lenient" || saved.validationStrictness === "normal" || saved.validationStrictness === "strict") {
                setAppSettings("validationStrictness", saved.validationStrictness)
            }
            // v2.0.1 — array fields
            if (Array.isArray(saved.stopSequences)) setAppSettings("stopSequences", saved.stopSequences)
            if (Array.isArray(saved.bannedPhrases)) setAppSettings("bannedPhrases", saved.bannedPhrases)
            if (Array.isArray(saved.requiredPhrases)) setAppSettings("requiredPhrases", saved.requiredPhrases)
            // Migration: if v2.0.0 settings had no outputFileMode, default to "combined" (already the createStore default)
            const savedLang = localStorage.getItem(UI_LANG_KEY)
            if (savedLang) {
                applyLanguageLocal(savedLang)
            }
        }
        catch (error) {
            logger.error("Failed to load application settings:", error)
        }
    }
    function saveAppSettings(): void {
        try {
            applyTheme(appSettings.theme || "auto")
            applyFontSize(appSettings.fontSize || "medium")
            localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings))
        }
        catch (error) {
            logger.error("Failed to save application settings:", error)
        }
    }
    function resetAppSettings(): void {
        setAppSettings({
            theme: "auto",
            fontSize: "medium",
            autoSave: true,
            autoCheckOllama: true,
            startMaximized: false,
            rememberWindowSize: true,
            smartSizing: true,
            maxFileSize: 100,
            maxOutputItems: 100000,
            maxChunks: 500,
            maxParallelFiles: 1,
            enableThinking: false,
            // v2.0.1 — output mode & export
            outputFileMode: "combined",
            outputFilenameTemplate: "{source}",
            confirmBeforeExport: false,
            autoExportOnCompletion: false,
            maxItemsPerFile: 50000,
            stripPiiBeforeExport: false,
            includeSourceMetadata: false,
            // v2.0.1 — appearance & accessibility
            fontScale: 100,
            compactMode: false,
            reducedMotion: false,
            highContrast: false,
            customCssPath: "",
            verboseDashboard: false,
            // v2.0.1 — telemetry & updates
            disableTelemetry: false,
            disableCrashReports: false,
            disableAutoUpdate: false,
            updateCheckIntervalHours: 24,
            // v2.0.1 — system & window
            gpuAcceleration: true,
            sendToTrayOnClose: false,
            startOnLogin: false,
            // v2.0.1 — cache
            cacheDir: "",
            cacheMaxSizeMB: 500,
            cacheTtlSeconds: 86400,
            clearCacheOnExit: false,
            // v2.0.1 — generation tuning
            retryCount: 3,
            retryBackoffStrategy: "exponential",
            requestTimeoutMs: 60000,
            streamTimeoutMs: 600000,
            abortOnError: false,
            topP: 0.9,
            topK: 40,
            repeatPenalty: 1.1,
            seed: -1,
            systemPromptOverride: "",
            stopSequences: [],
            bannedPhrases: [],
            requiredPhrases: [],
            // v2.0.1 — chunking
            minChunkLength: 200,
            maxChunkLength: 8000,
            chunkOverlap: 100,
            sentenceAwareChunking: true,
            preserveCodeBlocks: true,
            languageDetection: false,
            outputLanguageOverride: "",
            // v2.0.1 — validation
            skipDedup: false,
            dedupSimilarityThreshold: 0.92,
            minQaPairsPerFile: 1,
            maxQaPairsPerFile: 1000,
            validationStrictness: "normal",
            autoRegenerateOnLowQuality: false,
            regenerateThreshold: 0.6,
            maxRegenerationAttempts: 2,
            // v2.0.1 — logging
            logToFile: false,
            logFilePath: ""
        })
        saveAppSettings()
        applyTheme("auto")
        applyFontSize("medium")
    }
    async function refreshProfiles(): Promise<void> {
        const list = await listProfiles()
        setProfiles(list)
    }
    async function applyProfile(name: string): Promise<void> {
        if (!name) return
        const profile = await loadProfile(name)
        if (!profile) return
        setSettings({
            model: profile.model || "",
            processingType: profile.processingType || "instruction",
            outputFormat: profile.outputFormat || "jsonl",
            language: profile.language || "en",
            chunkSize: clamp(parseInt(profile.chunkSize), 500, 10000, 2000),
            concurrency: clamp(parseInt(profile.concurrency), 1, 10, 3),
            provider: profile.provider || "ollama",
            baseUrl: profile.baseUrl || "",
            temperature: settings.temperature,
            apiKey: settings.apiKey
        })
        if (profile.smartSizing !== undefined) {
            setAppSettings("smartSizing", profile.smartSizing)
        }
        setSelectedProfile(name)
    }
    async function saveCurrentProfile(name: string): Promise<void> {
        const profile: ConfigProfile = {
            name,
            model: settings.model || "",
            processingType: settings.processingType || "instruction",
            outputFormat: settings.outputFormat || "jsonl",
            language: settings.language || "en",
            chunkSize: String(settings.chunkSize || 2000),
            concurrency: String(settings.concurrency || 3),
            provider: settings.provider || "ollama",
            baseUrl: settings.baseUrl || "",
            smartSizing: appSettings.smartSizing,
            createdAt: new Date().toISOString()
        }
        await saveProfile(profile)
        await refreshProfiles()
        setSelectedProfile(name)
    }
    async function deleteCurrentProfile(): Promise<void> {
        const name = selectedProfile()
        if (!name) return
        await deleteProfile(name)
        await refreshProfiles()
        setSelectedProfile("")
    }
    createEffect(() => {
        const theme = appSettings.theme
        applyTheme(theme || "auto")
    })
    createEffect(() => {
        const size = appSettings.fontSize
        applyFontSize(size || "medium")
    })
    createEffect(() => {
        applyReducedMotion(Boolean(appSettings.reducedMotion))
    })
    loadAppSettings()
    return {
        get settings() { return settings },
        get appSettings() { return appSettings },
        get profiles() { return profiles },
        selectedProfile,
        apiKeyPlain,
        isCloudProvider,
        setModel: (model: string) => setSettings("model", model),
        setProcessingType: (type: string) => setSettings("processingType", type),
        setOutputFormat: (format: string) => setSettings("outputFormat", format),
        setLanguage: (lang: string) => setSettings("language", lang),
        setChunkSize: (size: number) => setSettings("chunkSize", clamp(size, 500, 10000, 2000)),
        setConcurrency: (concurrency: number) => setSettings("concurrency", clamp(concurrency, 1, 10, 3)),
        setProvider: (provider: string) => setSettings("provider", provider),
        setApiKey: (key: string) => {
            setApiKeyPlain(key)
            if (!key) setSettings("apiKey", "")
        },
        setBaseUrl: (url: string) => setSettings("baseUrl", url),
        setTemperature: (temp: number) => setSettings("temperature", clamp(temp, 0, 1, 0.7)),
        setCustomPrompt: (prompt: string) => setSettings("customPrompt", prompt),
        setOllamaHost: (host: string) => setSettings("ollamaHost", host || "localhost"),
        setOllamaPort: (port: number) => setSettings("ollamaPort", clamp(port, 1, 65535, 11434)),
        setTheme: (theme: string) => setAppSettings("theme", theme),
        setFontSize: (size: string) => setAppSettings("fontSize", size),
        setAutoSave: (value: boolean) => setAppSettings("autoSave", value),
        setAutoCheckOllama: (value: boolean) => setAppSettings("autoCheckOllama", value),
        setStartMaximized: (value: boolean) => setAppSettings("startMaximized", value),
        setRememberWindowSize: (value: boolean) => setAppSettings("rememberWindowSize", value),
        setSmartSizing: (value: boolean) => setAppSettings("smartSizing", value),
        setMaxFileSize: (size: number) => setAppSettings("maxFileSize", clamp(size, 10, 1000, 100)),
        setMaxOutputItems: (count: number) => setAppSettings("maxOutputItems", clamp(count, 1000, 1000000, 100000)),
        setMaxChunks: (count: number) => setAppSettings("maxChunks", clamp(count, 10, 5000, 500)),
        setMaxParallelFiles: (count: number) => setAppSettings("maxParallelFiles", clamp(count, 1, 10, 1)),
        setEnableThinking: (value: boolean) => setAppSettings("enableThinking", value),
        setAppSetting: <K extends keyof FullAppSettings>(key: K, value: FullAppSettings[K]) => setAppSettings(key, value as any),
        setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setSettings(key, value as any),
        loadSettings,
        savePreset,
        loadAppSettings,
        saveAppSettings,
        resetAppSettings,
        applyProfile,
        saveCurrentProfile,
        deleteCurrentProfile,
        refreshProfiles,
        applyTheme,
        applyFontSize,
        applyReducedMotion,
        applyLanguage: applyLanguageLocal,
        updateTemperatureDisplay
    }
}
