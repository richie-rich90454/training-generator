import { describe, test, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { ConfigPanel } from "../src/renderer/components/ConfigPanel.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import type { RecentPresetEntry } from "../src/types/index.js"
import { t } from "../src/renderer/i18n.js"

interface StubOpts {
    provider?: string
    processingType?: string
    availableModels?: string[]
    recentPresets?: RecentPresetEntry[]
}
function makeStub(opts: StubOpts = {}) {
    const provider = opts.provider ?? "ollama"
    const processingType = opts.processingType ?? "instruction"
    const isCloud = provider !== "ollama"
    const settings = {
        model: "",
        provider,
        apiKey: "",
        baseUrl: "",
        ollamaHost: "localhost",
        ollamaPort: 11434,
        processingType,
        customPrompt: "",
        outputFormat: "jsonl",
        language: "en",
        chunkSize: 2000,
        concurrency: 3,
        temperature: 0.7
    }
    const setProvider = vi.fn()
    const setApiKey = vi.fn()
    const setBaseUrl = vi.fn()
    const setOllamaHost = vi.fn()
    const setOllamaPort = vi.fn()
    const setProcessingType = vi.fn()
    const setCustomPrompt = vi.fn()
    const setOutputFormat = vi.fn()
    const setLanguage = vi.fn()
    const setChunkSize = vi.fn()
    const setConcurrency = vi.fn()
    const setTemperature = vi.fn()
    const setModel = vi.fn()
    // v2.0.1 — Recent presets quick-access (Task 6.8). The stub returns a
    // fixed list (no signal) because the ConfigPanel tests don't need to
    // observe live updates — they re-render with a new stub if they need a
    // different list.
    const recentPresetsList = opts.recentPresets ?? []
    const loadPreset = vi.fn(async () => {})
    const settingsStore = {
        settings,
        appSettings: {},
        profiles: [],
        selectedProfile: () => "",
        apiKeyPlain: () => "",
        isCloudProvider: () => isCloud,
        setProvider,
        setApiKey,
        setBaseUrl,
        setOllamaHost,
        setOllamaPort,
        setProcessingType,
        setCustomPrompt,
        setOutputFormat,
        setLanguage,
        setChunkSize,
        setConcurrency,
        setTemperature,
        setModel,
        recentPresets: () => recentPresetsList,
        loadPreset,
        updateTemperatureDisplay: vi.fn(() => ({ rangeFill: "", temperatureColor: "", temperatureColorHover: "", temperatureShadow: "", text: "0.7" }))
    }
    const initProvider = vi.fn()
    const refreshOllamaModels = vi.fn(async () => {})
    const openPromptEditor = vi.fn()
    const savePreset = vi.fn(async () => {})
    const uiStore = {
        availableOllamaModels: () => opts.availableModels ?? [],
        openPromptEditor
    }
    const appStore = {
        settingsStore,
        savePreset,
        initProvider,
        refreshOllamaModels,
        uiStore
    } as unknown as AppStore
    return {
        appStore, setProvider, setApiKey, setBaseUrl, setOllamaHost, setOllamaPort,
        setProcessingType, setCustomPrompt, setOutputFormat, setLanguage,
        setChunkSize, setConcurrency, setTemperature, setModel,
        initProvider, openPromptEditor, savePreset, loadPreset
    }
}
function renderComponent(opts: StubOpts = {}) {
    const stub = makeStub(opts)
    const result = render(() => <ConfigPanel appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("ConfigPanel", () => {
    test("renders config card and provider select", () => {
        const { container } = renderComponent()
        expect(container.querySelector("#config-provider")).not.toBeNull()
        expect(container.querySelector("#config-output-format")).not.toBeNull()
        expect(container.querySelector("#config-chunk-size")).not.toBeNull()
    })
    test("changing provider dropdown calls settingsStore.setProvider and initProvider", () => {
        const { setProvider, initProvider, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-provider") as HTMLSelectElement, { target: { value: "openai" } })
        expect(setProvider).toHaveBeenCalledWith("openai")
        expect(initProvider).toHaveBeenCalledTimes(1)
    })
    test("cloud provider shows api key field and typing calls setApiKey", () => {
        const { setApiKey, container } = renderComponent({ provider: "openai" })
        const apiKeyInput = container.querySelector("#config-api-key") as HTMLInputElement
        expect(apiKeyInput).not.toBeNull()
        fireEvent.input(apiKeyInput, { target: { value: "sk-test-123" } })
        expect(setApiKey).toHaveBeenCalledWith("sk-test-123")
    })
    test("cloud provider shows base url field and typing calls setBaseUrl", () => {
        const { setBaseUrl, container } = renderComponent({ provider: "openai" })
        const baseUrlInput = container.querySelector("#config-base-url") as HTMLInputElement
        expect(baseUrlInput).not.toBeNull()
        fireEvent.input(baseUrlInput, { target: { value: "https://api.openai.com" } })
        expect(setBaseUrl).toHaveBeenCalledWith("https://api.openai.com")
    })
    test("ollama provider shows host and port fields", () => {
        const { container } = renderComponent({ provider: "ollama" })
        expect(container.querySelector("#config-ollama-host")).not.toBeNull()
        expect(container.querySelector("#config-ollama-port")).not.toBeNull()
        // Cloud-only fields should not be present for ollama
        expect(container.querySelector("#config-api-key")).toBeNull()
    })
    test("typing in ollama host calls setOllamaHost", () => {
        const { setOllamaHost, container } = renderComponent({ provider: "ollama" })
        fireEvent.input(container.querySelector("#config-ollama-host") as HTMLInputElement, { target: { value: "192.168.1.5" } })
        expect(setOllamaHost).toHaveBeenCalledWith("192.168.1.5")
    })
    test("changing ollama port calls setOllamaPort", () => {
        const { setOllamaPort, container } = renderComponent({ provider: "ollama" })
        fireEvent.change(container.querySelector("#config-ollama-port") as HTMLInputElement, { target: { value: "8080" } })
        expect(setOllamaPort).toHaveBeenCalledWith(8080)
    })
    test("changing processing type calls setProcessingType", () => {
        const { setProcessingType, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-processing-type") as HTMLSelectElement, { target: { value: "conversation" } })
        expect(setProcessingType).toHaveBeenCalledWith("conversation")
    })
    test("custom processing type shows custom prompt textarea and typing calls setCustomPrompt", () => {
        const { setCustomPrompt, container } = renderComponent({ processingType: "custom" })
        const textarea = container.querySelector("#config-custom-prompt") as HTMLTextAreaElement
        expect(textarea).not.toBeNull()
        fireEvent.input(textarea, { target: { value: "Custom instruction here" } })
        expect(setCustomPrompt).toHaveBeenCalledWith("Custom instruction here")
    })
    test("changing output format calls setOutputFormat", () => {
        const { setOutputFormat, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-output-format") as HTMLSelectElement, { target: { value: "csv" } })
        expect(setOutputFormat).toHaveBeenCalledWith("csv")
    })
    test("changing language calls setLanguage", () => {
        const { setLanguage, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-language") as HTMLSelectElement, { target: { value: "fr" } })
        expect(setLanguage).toHaveBeenCalledWith("fr")
    })
    test("changing chunk size calls setChunkSize", () => {
        const { setChunkSize, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-chunk-size") as HTMLSelectElement, { target: { value: "4000" } })
        expect(setChunkSize).toHaveBeenCalledWith(4000)
    })
    test("changing concurrency calls setConcurrency", () => {
        const { setConcurrency, container } = renderComponent()
        fireEvent.change(container.querySelector("#config-concurrency") as HTMLSelectElement, { target: { value: "5" } })
        expect(setConcurrency).toHaveBeenCalledWith(5)
    })
    test("changing temperature calls setTemperature", () => {
        const { setTemperature, container } = renderComponent()
        fireEvent.input(container.querySelector("#config-temperature") as HTMLInputElement, { target: { value: "0.9" } })
        expect(setTemperature).toHaveBeenCalledWith(0.9)
    })
    test("clicking save preset calls appStore.savePreset", () => {
        const { savePreset, container } = renderComponent()
        fireEvent.click(container.querySelector('button[aria-label="' + t("config.savePresetAria") + '"]') as HTMLButtonElement)
        expect(savePreset).toHaveBeenCalledTimes(1)
    })
    test("unmounts without throwing", () => {
        const utils = renderComponent()
        expect(() => utils.unmount()).not.toThrow()
    })
    // v2.0.1 — Recent presets quick-access dropdown (Task 6.8)
    // Tests use [role="menu"] / [role="menuitem"] selectors instead of class
    // names because CSS module class hashing can vary between build and test
    // environments. Role attributes are stable and a11y-correct.
    test("recent presets dropdown toggle opens and closes the menu", () => {
        const { container } = renderComponent()
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        expect(toggle).not.toBeNull()
        // Initially closed
        expect(toggle.getAttribute("aria-expanded")).toBe("false")
        expect(container.querySelector('[role="menu"]')).toBeNull()
        // Click opens
        fireEvent.click(toggle)
        expect(toggle.getAttribute("aria-expanded")).toBe("true")
        expect(container.querySelector('[role="menu"]')).not.toBeNull()
        // Click again closes
        fireEvent.click(toggle)
        expect(toggle.getAttribute("aria-expanded")).toBe("false")
        expect(container.querySelector('[role="menu"]')).toBeNull()
    })
    test("recent presets dropdown shows empty state when no presets", () => {
        const { container } = renderComponent({ recentPresets: [] })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        const menu = container.querySelector('[role="menu"]')
        expect(menu).not.toBeNull()
        expect(menu?.textContent).toContain(t("config.recentPresets.empty"))
        // The empty state menuitem has aria-disabled="true"
        const emptyItem = container.querySelector('[role="menuitem"][aria-disabled="true"]')
        expect(emptyItem).not.toBeNull()
    })
    test("recent presets dropdown lists saved presets with name and timestamp", () => {
        const recentPresets = [
            { name: "ollama/llama3", path: "train-generator-preset-snapshot-ollama/llama3", savedAt: 1717200000000 },
            { name: "openai/gpt-4", path: "train-generator-preset-snapshot-openai/gpt-4", savedAt: 1717286400000 }
        ]
        const { container } = renderComponent({ recentPresets })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        // Items have role="menuitem" WITHOUT aria-disabled
        const items = container.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
        expect(items.length).toBe(2)
        expect(items[0].textContent).toContain("ollama/llama3")
        expect(items[1].textContent).toContain("openai/gpt-4")
    })
    test("clicking a recent preset calls settingsStore.loadPreset with its path", async() => {
        const recentPresets = [
            { name: "ollama/llama3", path: "train-generator-preset-snapshot-ollama/llama3", savedAt: 1717200000000 }
        ]
        const { loadPreset, container } = renderComponent({ recentPresets })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        const item = container.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement
        expect(item).not.toBeNull()
        await fireEvent.click(item)
        expect(loadPreset).toHaveBeenCalledWith("train-generator-preset-snapshot-ollama/llama3")
    })
    test("dropdown closes on Escape key", () => {
        const { container } = renderComponent({
            recentPresets: [{ name: "ollama/llama3", path: "snap1", savedAt: 1717200000000 }]
        })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        expect(container.querySelector('[role="menu"]')).not.toBeNull()
        fireEvent.keyDown(document, { key: "Escape" })
        expect(container.querySelector('[role="menu"]')).toBeNull()
    })
    test("dropdown closes on outside click", () => {
        const { container } = renderComponent({
            recentPresets: [{ name: "ollama/llama3", path: "snap1", savedAt: 1717200000000 }]
        })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        expect(container.querySelector('[role="menu"]')).not.toBeNull()
        // Click outside the dropdown — create a detached element and click it
        const outside = document.createElement("div")
        document.body.appendChild(outside)
        fireEvent.click(outside)
        expect(container.querySelector('[role="menu"]')).toBeNull()
        document.body.removeChild(outside)
    })
    test("dropdown closes after selecting a preset", async() => {
        const recentPresets = [
            { name: "ollama/llama3", path: "snap1", savedAt: 1717200000000 }
        ]
        const { container } = renderComponent({ recentPresets })
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        fireEvent.click(toggle)
        expect(container.querySelector('[role="menu"]')).not.toBeNull()
        const item = container.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement
        await fireEvent.click(item)
        expect(container.querySelector('[role="menu"]')).toBeNull()
    })
    test("dropdown toggle button has aria-haspopup and aria-expanded attributes", () => {
        const { container } = renderComponent()
        const toggle = container.querySelector('button[aria-label="' + t("config.recentPresets.aria") + '"]') as HTMLButtonElement
        expect(toggle.getAttribute("aria-haspopup")).toBe("menu")
        expect(toggle.getAttribute("aria-expanded")).toBe("false")
    })
})
