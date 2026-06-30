// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import UIManager from "../src/renderer/uiManager.js"
function setupDom(): void {
    document.body.innerHTML=`
        <div id="progress-text"></div>
        <div id="progress-percent"></div>
        <div id="progress-fill" role="progressbar" aria-valuenow="0"></div>
        <div id="processing-log"></div>
        <div id="output-preview"></div>
        <button id="export-btn"></button>
        <button id="copy-btn"></button>
        <select id="export-format"></select>
        <div id="ollama-status"><span></span></div>
        <button id="settings-btn"></button>
        <div id="settings-modal" style="display:none"><div class="modal-body"></div></div>
        <button class="modal-close"></button>
        <button id="help-btn"></button>
        <select id="model-select"><option value="">--</option><option value="mistral">mistral</option><option value="llama3">llama3</option></select>
        <select id="processing-type"><option value="instruction">instruction</option><option value="conversation">conversation</option></select>
        <select id="output-format"><option value="jsonl">jsonl</option><option value="chatml">chatml</option></select>
        <select id="language-select"><option value="en">en</option><option value="zh-Hans">zh-Hans</option></select>
        <input id="chunk-size" value="2000" />
        <select id="concurrency"></select>
        <button id="save-preset"></button>
        <button id="demo-btn"></button>
        <select id="provider"><option value="ollama">ollama</option><option value="openai">openai</option></select>
        <input id="api-key" />
        <input id="base-url" />
        <div id="api-key-group"></div>
        <div id="base-url-group"></div>
        <input id="smart-sizing" type="checkbox" />
        <select id="profile-select"></select>
        <button id="save-profile-btn"></button>
        <button id="delete-profile-btn"></button>
        <button id="edit-templates-btn"></button>
        <button id="dashboard-btn"></button>
        <select id="max-parallel-files"></select>
        <input id="temperature" type="range" min="0" max="1" step="0.1" value="0.7" />
        <span id="temperature-value"></span>
        <select id="theme-select"><option value="auto">auto</option><option value="light">light</option><option value="dark">dark</option></select>
        <select id="font-size"><option value="small">small</option><option value="medium">medium</option><option value="large">large</option></select>
    `
}
describe("UIManager helpers", () => {
    beforeEach(()=>{
        setupDom()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("escapes html special characters", () => {
        let ui=new UIManager({})
        expect(ui.escapeHtml("<script>alert('x')</script>")).not.toContain("<script>")
        expect(ui.escapeHtml("&")).toContain("&amp;")
        expect(ui.escapeHtml("<div>")).toContain("&lt;")
    })
    it("escapeHtml handles null", () => {
        let ui=new UIManager({})
        expect(ui.escapeHtml(null as any)).toBe("")
    })
    it("sanitizeText removes control characters", () => {
        let ui=new UIManager({})
        expect(ui.sanitizeText("hello\x00world")).not.toContain("\x00")
        expect(ui.sanitizeText("hello\x1bworld")).not.toContain("\x1b")
    })
    it("sanitizeText preserves whitespace", () => {
        let ui=new UIManager({})
        expect(ui.sanitizeText("hello world")).toContain("hello")
        expect(ui.sanitizeText("hello world")).toContain("world")
    })
    it("escapeCsvField escapes quotes", () => {
        let ui=new UIManager({})
        expect(ui.escapeCsvField('say "hello"')).toBe('say ""hello""')
    })
    it("escapeCsvField prefixes formula characters", () => {
        let ui=new UIManager({})
        expect(ui.escapeCsvField("=SUM(A1)")).toBe("'=SUM(A1)")
        expect(ui.escapeCsvField("+123")).toBe("'+123")
        expect(ui.escapeCsvField("-123")).toBe("'-123")
        expect(ui.escapeCsvField("@user")).toBe("'@user")
    })
    it("getLogIcon returns correct icons", () => {
        let ui=new UIManager({})
        expect(ui.getLogIcon("info")).toBe("info-circle")
        expect(ui.getLogIcon("success")).toBe("check-circle")
        expect(ui.getLogIcon("warning")).toBe("exclamation-triangle")
        expect(ui.getLogIcon("error")).toBe("times-circle")
        expect(ui.getLogIcon("unknown")).toBe("info-circle")
    })
    it("setProgress clamps values", () => {
        let ui=new UIManager({})
        ui.setProgress(-10, "test")
        expect(ui.progressFill.style.width).toBe("0%")
        ui.setProgress(110, "test")
        expect(ui.progressFill.style.width).toBe("100%")
        ui.setProgress(NaN, "test")
        expect(ui.progressFill.style.width).toBe("0%")
    })
    it("setProgress updates aria values", () => {
        let ui=new UIManager({})
        ui.setProgress(50, "halfway")
        let bar=ui.progressFill.closest('[role="progressbar"]') as HTMLElement
        expect(bar.getAttribute("aria-valuenow")).toBe("50")
        expect(bar.getAttribute("aria-valuetext")).toBe("halfway")
    })
    it("addLog creates log entry", () => {
        let ui=new UIManager({})
        ui.addLog("hello", "info")
        expect(ui.processingLog.querySelectorAll(".log-entry").length).toBe(1)
        expect(ui.logCount).toBe(1)
    })
    it("addLog truncates old entries", () => {
        let ui=new UIManager({})
        for(let i=0;i<55;i++){
            ui.addLog(`msg ${i}`, "info")
        }
        expect(ui.processingLog.querySelectorAll(".log-entry").length).toBeLessThanOrEqual(50)
    })
})
describe("UIManager settings persistence", () => {
    beforeEach(()=>{
        setupDom()
        localStorage.clear()
    })
    afterEach(()=>{
        localStorage.clear()
        vi.restoreAllMocks()
    })
    it("loads settings from localStorage", async() => {
        let settings={
            model:"mistral",
            processingType:"conversation",
            outputFormat:"chatml",
            language:"zh-Hans",
            chunkSize:"1500",
            provider:"openai",
            baseUrl:"http://localhost:11434",
            temperature:"0.5"
        }
        localStorage.setItem("train-generator-settings", JSON.stringify(settings))
        let ui=new UIManager({})
        await ui.loadSettings()
        expect(ui.modelSelect.value).toBe("mistral")
        expect(ui.processingType.value).toBe("conversation")
        expect(ui.outputFormat.value).toBe("chatml")
        expect(ui.languageSelect.value).toBe("zh-Hans")
        expect(ui.chunkSize.value).toBe("1500")
        expect(ui.providerSelect.value).toBe("openai")
        expect(ui.baseUrlInput.value).toBe("http://localhost:11434")
        expect(ui.temperatureInput.value).toBe("0.5")
    })
    it("ignores invalid settings", async() => {
        localStorage.setItem("train-generator-settings", "not json")
        let ui=new UIManager({})
        await expect(ui.loadSettings()).resolves.not.toThrow()
    })
    it("saves preset to localStorage", async() => {
        let ui=new UIManager({})
        ui.modelSelect.value="llama3"
        ui.processingType.value="instruction"
        ui.outputFormat.value="jsonl"
        ui.languageSelect.value="en"
        ui.chunkSize.value="2000"
        ui.concurrencySelect.value="3"
        ui.providerSelect.value="ollama"
        ui.baseUrlInput.value=""
        ui.temperatureInput.value="0.7"
        await ui.savePreset()
        let saved=JSON.parse(localStorage.getItem("train-generator-settings")||"{}")
        expect(saved.model).toBe("llama3")
        expect(saved.outputFormat).toBe("jsonl")
    })
    it("applies theme classes", () => {
        let ui=new UIManager({})
        ui.applyTheme("light")
        expect(document.body.classList.contains("theme-light")).toBe(true)
        ui.applyTheme("dark")
        expect(document.body.classList.contains("theme-dark")).toBe(true)
        ui.applyTheme("auto")
        expect(document.body.classList.contains("theme-light")||document.body.classList.contains("theme-dark")).toBe(true)
    })
    it("applies font size classes", () => {
        let ui=new UIManager({})
        ui.applyFontSize("small")
        expect(document.body.classList.contains("font-small")).toBe(true)
        ui.applyFontSize("large")
        expect(document.body.classList.contains("font-large")).toBe(true)
        ui.applyFontSize("medium")
        expect(document.body.classList.contains("font-medium")).toBe(true)
    })
    it("resets settings to defaults", () => {
        let ui=new UIManager({})
        ui.resetSettings()
        let saved=JSON.parse(localStorage.getItem("training-generator-app-settings")||"{}")
        expect(saved.theme).toBe("auto")
        expect(saved.fontSize).toBe("medium")
    })
})
describe("UIManager language", () => {
    beforeEach(()=>{
        setupDom()
        document.body.innerHTML+='<span data-i18n="app.title"></span><input data-i18n-placeholder="config.apiKey.placeholder" />'
        document.documentElement.lang="en"
    })
    it("applies translations", () => {
        let ui=new UIManager({})
        ui.applyLanguage("en")
        expect(document.documentElement.lang).toBe("en")
        let el=document.querySelector('[data-i18n="app.title"]') as HTMLElement
        expect(el.textContent).toBe("Training Generator")
    })
    it("updates temperature display", () => {
        let ui=new UIManager({})
        ui.temperatureInput.value="0.5"
        ui.updateTemperatureDisplay()
        expect(ui.temperatureValue.textContent).toBe("0.5")
        expect(ui.temperatureInput.style.getPropertyValue("--range-fill")).toContain("50")
    })
})
describe("UIManager modal focus", () => {
    beforeEach(()=>{
        setupDom()
    })
    it("shows and hides modal", () => {
        let ui=new UIManager({})
        ui.showModal(true)
        expect(ui.settingsModal.classList.contains("active")).toBe(true)
        ui.showModal(false)
        expect(ui.settingsModal.classList.contains("active")).toBe(false)
    })
    it("shows custom modal content", () => {
        let ui=new UIManager({})
        ui.showCustomModal("<p>help</p>")
        let body=ui.settingsModal.querySelector(".modal-body")
        expect(body!.innerHTML).toContain("help")
    })
})
