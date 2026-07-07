import { createStore } from "solid-js/store"
import { createSignal, createMemo, createEffect } from "solid-js"
import type { AppSettings, FullAppSettings } from "../../types/index.js"
import { applyLanguage } from "../i18n.js"
import { encryptKey, decryptKey } from "../security.js"
import { listProfiles, saveProfile, loadProfile, deleteProfile } from "../configProfiles.js"
import type { ConfigProfile } from "../configProfiles.js"
const SETTINGS_KEY = "train-generator-settings"
const APP_SETTINGS_KEY = "training-generator-app-settings"
const UI_LANG_KEY = "train-generator-ui-lang"
const VALID_PROCESSING_TYPES = ["instruction", "conversation", "chunking", "custom"]
const VALID_OUTPUT_FORMATS = ["jsonl", "chatml", "text", "csv"]
const VALID_LANGUAGES = ["en", "zh-Hans", "zh-Hant", "es", "fr", "de", "ja", "ko"]
const VALID_PROVIDERS = ["ollama", "openai", "anthropic", "gemini"]
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
    applyLanguage: (lang: string) => void
    updateTemperatureDisplay: (temp: number) => { rangeFill: string; temperatureColor: string; temperatureColorHover: string; temperatureShadow: string; text: string }
}
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null
export function createSettingsStore(): SettingsStore {
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
        temperature: 0.7
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
        maxParallelFiles: 1
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
                const n = Number(saved.chunkSize)
                if (Number.isFinite(n) && n >= 500 && n <= 10000) setSettings("chunkSize", n)
            }
            if (saved.concurrency != null) {
                const n = Number(saved.concurrency)
                if (Number.isFinite(n) && n >= 1 && n <= 10) setSettings("concurrency", n)
            }
            if (saved.provider && VALID_PROVIDERS.includes(saved.provider)) setSettings("provider", saved.provider)
            if (saved.baseUrl && typeof saved.baseUrl === "string" && /^https?:\/\//.test(saved.baseUrl)) setSettings("baseUrl", saved.baseUrl)
            if (saved.temperature != null) {
                const n = Number(saved.temperature)
                if (Number.isFinite(n) && n >= 0 && n <= 1) setSettings("temperature", n)
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
            console.error("Failed to load settings:", error)
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
            console.error("Error in savePreset:", error)
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
            const boolKeys: Array<keyof FullAppSettings> = ["autoSave", "autoCheckOllama", "startMaximized", "rememberWindowSize", "smartSizing"]
            for (const key of boolKeys) {
                if (saved[key] !== undefined) {
                    setAppSettings(key, saved[key] as boolean)
                }
            }
            const numKeys: Array<{ key: keyof FullAppSettings, min: number, max: number, def: number }> = [
                { key: "maxFileSize", min: 10, max: 1000, def: 100 },
                { key: "maxOutputItems", min: 1000, max: 1000000, def: 100000 },
                { key: "maxChunks", min: 10, max: 5000, def: 500 },
                { key: "maxParallelFiles", min: 1, max: 10, def: 1 }
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
            const savedLang = localStorage.getItem(UI_LANG_KEY)
            if (savedLang) {
                applyLanguageLocal(savedLang)
            }
        }
        catch (error) {
            console.error("Failed to load application settings:", error)
        }
    }
    function saveAppSettings(): void {
        try {
            applyTheme(appSettings.theme || "auto")
            applyFontSize(appSettings.fontSize || "medium")
            localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings))
        }
        catch (error) {
            console.error("Failed to save application settings:", error)
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
            maxParallelFiles: 1
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
            chunkSize: parseInt(profile.chunkSize) || 2000,
            concurrency: parseInt(profile.concurrency) || 3,
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
        setChunkSize: (size: number) => setSettings("chunkSize", size),
        setConcurrency: (concurrency: number) => setSettings("concurrency", concurrency),
        setProvider: (provider: string) => setSettings("provider", provider),
        setApiKey: (key: string) => {
            setApiKeyPlain(key)
            if (!key) setSettings("apiKey", "")
        },
        setBaseUrl: (url: string) => setSettings("baseUrl", url),
        setTemperature: (temp: number) => setSettings("temperature", temp),
        setTheme: (theme: string) => setAppSettings("theme", theme),
        setFontSize: (size: string) => setAppSettings("fontSize", size),
        setAutoSave: (value: boolean) => setAppSettings("autoSave", value),
        setAutoCheckOllama: (value: boolean) => setAppSettings("autoCheckOllama", value),
        setStartMaximized: (value: boolean) => setAppSettings("startMaximized", value),
        setRememberWindowSize: (value: boolean) => setAppSettings("rememberWindowSize", value),
        setSmartSizing: (value: boolean) => setAppSettings("smartSizing", value),
        setMaxFileSize: (size: number) => setAppSettings("maxFileSize", size),
        setMaxOutputItems: (count: number) => setAppSettings("maxOutputItems", count),
        setMaxChunks: (count: number) => setAppSettings("maxChunks", count),
        setMaxParallelFiles: (count: number) => setAppSettings("maxParallelFiles", count),
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
        applyLanguage: applyLanguageLocal,
        updateTemperatureDisplay
    }
}
